var jsynchronous;

function jsynchronousSetup() {
  var TYPE_ENCODINGS = [
    'array',
    'object',
    'number',
    'string',
    'boolean',
    'undefined',
    'null',
    'empty',
    'bigint',
    'function'
  ]

  var OP_ENCODINGS = [
    'initial',
    'changes',
    'set',
    'delete',
    'new',
    'end'
  ]

  var jsyncs = {}
  var standIns = {}

  function onmessage(data) {
    var json = JSON.parse(data);
    var op = OP_ENCODINGS[json[0]]; 

    if (op === 'initial') {
      var name = json[1];
      var counter = json[2];
      var settings = json[3]
      var variableData = json[4];

console.log('New jsync', counter);
      newJsynchronous(name, counter, settings, variableData);
    } else if (op === 'changes') {
      var name = json[1];
      var minCounter = json[2];
      var maxCounter = json[3];
      var changes = json[4];
console.log('count likes to count', minCounter, maxCounter, changes);
      processChanges(name, minCounter, maxCounter, changes);
    }
  }

  function get(name, standInType) {
    var existing;
    if (!name) {
      name = '';
    }

    if (jsyncs[name]) {
      return jsyncs[name].root.variable;
    } else if (standInType) {
      return standInVariable(name, standInType);
    } else {
      var errorString = "jsynchronous() error - No synchronized variable available by name " + name + ". ";
      if (Object.keys(jsyncs).length === 0) {
        errorString += "Either connection has not been established, or .$sync has not yet been called on the server for this client. ";
      }
      errorString += "Use jsynchronous(name, 'array') to create a stand-in array or jsynchronous(name, 'object') to create a stand-in object. This stand-in variable will be automatically populated once synchronization succeeds.";
      throw errorString;
    }
  }
  function list() {
    return Object.keys(jsyncs);
  }

  function jsyncObject(name, counter, settings, standIn) {
    var jsync = {
      name: name,
      counter: counter,  // Counter will always be 1 above the last packet
      objects: {},  // key-> value corresponds to details.hash->details
      root: undefined,
      statefulEvents: [],
      changesEvents: [],
      standIn: standIn || false,
      rewind: settings.rewind || false,
      client_history: settings.client_history || false,
      history: [],
      staging: {
        references: []
      }
    }
    return jsync;
  }

  function newJsynchronous(name, counter, settings, data) {
    var jsync = jsyncObject(name, counter, settings);

    jsyncs[name] = jsync;

    for (var i=0; i<data.length; i++) {
      var d = data[i];
      var hash = d[0];
      var type = TYPE_ENCODINGS[d[1]];
      var each = d[2];
      var description = createSyncedVariable(hash, type, each, jsync, (i === 0)); 

      if (i === 0) {  // Convention is 0th element is root
        jsync.root = description;
      }
    }

    resolveReferences(jsync);

    return jsync.root;
  }

  function standInVariable(name, type) {
    if (standIns[name]) {
      return standIns[name].variable;
    } else {
      standIns[name] = jsyncObject(undefined, -1, {}, true);
      standIns[name].variable = newCollection(type);
      addSynchronizedVariableMethods(standIns[name], standIns[name].variable);
      return standIns[name].variable;
    }
  }

  function createSyncedVariable(hash, type, each, jsync, isRoot) {
    // This function relies on resolveReferences() being called after all syncedVariables in the payload are processed
    var standIn;
    if (isRoot) {
      var name = jsync.name;
      if (standIns[name]) {
        standIn = standIns[name];
      }
      var standInType = detailedType(standIn.variable)

      if (standIn && standInType !== type) {
        standIn = undefined;
        console.error( "jsynchronous('" + name + "', '" + standInType + "') is the wrong variable type, the type originating from the server is '" + type + "'. Your stand-in variable is unable to reference the synchronized variable." )
      }

      // Copy events assigned to standIn while waiting on the synchronized variable
      if (standIn) {
        jsync.statefulEvents = standIn.statefulEvents;
        jsync.changesEvents = standIn.changesEvents;
      }
    }

    var details = {
      hash: hash,
      type: type,
      variable: undefined,
      descendants: {}, // key->value corresponds to descendant.hash->[properties]. Follow properties to find descendant
      parents: {},     // key->value corresponds to parentHash->{details: parent, props: []}
      children: {}     // key->value corresponds to childHash->{details: child, props: []}
    }

    if (standIn) {
      details.variable = standIn.variable;
    } else {
      details.variable = newCollection(type);
    }

    addSynchronizedVariableMethods(jsync, details.variable);

    jsync.objects[hash] = details;

    enumerate(each, type, function (prop, encoded) {
      var t = TYPE_ENCODINGS[encoded[0]]
      var v = encoded[1];

      if (isPrimitive(t)) {
        if (t !== 'empty') {
          details.variable[prop] = resolvePrimitive(t, v);
        }
      } else {
        var reference = {
          details: details,
          prop: prop,
          hash: v
        }
        jsync.staging.references.push(reference);  // We need to wait for all variables to be registered, esp in circular data structures
      }
    });

    return details;
  }

  function resolveReferences(jsync) {
    var references = jsync.staging.references;
    for (var j=0; j<references.length; j++) {
      var r = references[j];
      var childDetails = resolveSyncedVariable(r.hash, jsync);
      //link(r.details, childDetails, r.prop);
      r.details.variable[r.prop] = childDetails.variable;
    }
    jsync.staging.references.length = 0;
  }

  function processChanges(name, minCounter, maxCounter, changes) {
    var jsync = jsyncs[name];
    if (jsync === undefined) {
      throw "JSynchronous error - Server provided changes for a variable not registered with this client with the name " + name;
    }

    if (minCounter !== jsync.counter) {
      throw "Jsynchronous error - Updates skipped. Expected " + jsync.counter + " got " + minCounter + ". This means your TCP/IP connection was reset in your transport";
    } else {
      jsync.counter = maxCounter+1;
    }

    var changesTriggered = [];

    for (var i=0; i<changes.length; i++) {
      var change = changes[i];
      var op = OP_ENCODINGS[change[0]];
      var hash = change[1];
      var details;
      var pt;
     
      if (op === 'set' || op === 'delete' || op === 'end') {
        details = jsync.objects[hash];
        if (details === undefined) {
          throw "Jsynchronous error - " + op + " for an object hash " + hash + " that is not registered with the synchronized variable by name '" + jsync.name + "'";
        }
      }

      if (op === 'set') {
        var prop = change[2];
        var newDetails = change[3];
        var oldDetails = change[4];
        set(details, prop, newDetails, oldDetails, jsync);
      } else if (op === 'delete') {
        var prop = change[2];        
        var oldDetails =  change[4];
        del(details, prop, oldDetails, jsync);
      } else if (op === 'new') {
        var type = change[2];
        var each = change[3];
        createSyncedVariable(hash, TYPE_ENCODINGS[type], each, jsync); 
      } else if (op === 'end') {
        endObject(details, jsync);
      } else {
        throw "Jsynchronous error - Unidentified operation coming from server: " + op;
      }

      if (op === 'set' || op === 'delete') {
        for (let j=0; j<jsync.changesEvents.length; j++) {
          var e = jsync.changesEvents[j];
          if (changesTriggered.indexOf(e) === -1) {  // Don't bother checking changes that are already triggered
            changesTriggered.push(e);
          }
        }
      }

      if (jsync.rewind || jsync.client_history) { 
        jsync.history.push();
      }
    }

    if (jsync.client_history && jsync.client_history < jsync.history.length) {
      jsync.history = jsync.history.slice(Math.floor(jsync.history.length / 2));
    }


    resolveReferences(jsync);

    for (var i=0; i<changesTriggered.length; i++) {
      var props = changesTriggered[i].props;
      triggerChangesEvent(jsync, props, changesTriggered[i].callback);
    }
  }
  function set(details, prop, newDetails, oldDetails, jsync) {
    var object = details.variable;
    var type = TYPE_ENCODINGS[newDetails[0]];
    var value;

    if (isPrimitive(type)) {
      value = resolvePrimitive(type, newDetails[1]);
    } else {
      var childDetails = resolveSyncedVariable(newDetails[1], jsync);
      //link(details, childDetails, prop, jsync);
      value = childDetails.variable;
    }

    var oldType = TYPE_ENCODINGS[oldDetails[0]];
    var oldValue;

    if (isPrimitive(oldType)) {
      oldValue = resolvePrimitive(oldType, oldDetails[1]);
    } else {
      var childDetails = resolveSyncedVariable(oldDetails[1], jsync);
      oldValue = childDetails.variable;
    }

    object[prop] = value;

    // return triggerStatefulEvents(details, prop, value, oldValue, jsync);
  }
  function del(details, prop, oldDetails, jsync) {
    var object = details.variable;
    var oldType = TYPE_ENCODINGS[oldDetails[0]];
    var oldValue = oldDetails[1];

    if (isPrimitive(oldType)) {
      oldValue = resolvePrimitive(oldType, oldDetails[1]);
    } else {
      var child = resolveSyncedVariable(oldDetails[1], jsync);
      //unlink(details, child, prop);
    }

    delete object[prop];

    // return triggerStatefulEvents(details, prop, undefined, oldValue, jsync);
  }
  function endObject(details, jsync) {
    // Memento mori
    delete jsync.objects[details.hash];
  }

  // ----------------------------------------------------------------
  // Helper functions
  // ----------------------------------------------------------------
  function resolvePrimitive(type, value) {
    if (type === 'boolean') {
      return Boolean(value);
    } else if (type === 'bigint') {
      return BigInt(value);
    } else if (type === 'number') {
      return value;
    } else if (type === 'string') {
      return value;
    } else if (type === 'undefined') {
      return undefined;
    } else if (type === 'null') {
      return null;
    } else if (type === 'function') {
      return undefined;  // Functions are, for now, read-only
    }
  }
  function detailedType(value) {
    const type = typeof value;
    if (type !== 'object') {
      return type;  // 'boolean' 'string' 'undefined' 'number' 'bigint' 'symbol'
    } else if (value === null) {
      return 'null';  // Special case made for typeof null === 'object'
    } else if (type === 'function') {
      return 'function';
    } else if (value.constructor && value.constructor() === 'object') {
      return 'object';  // Easy catch-all for object type
    } else if (value instanceof Date) {
      return 'date';
    } else if (value instanceof RegExp) {
      return 'regex';
    } else if (Array.isArray(value)) {
      return 'array';
    } else {
      return 'object'  // If we can't figure out what it is, most things in javascript are objects
    }
  }

  function resolveSyncedVariable(hash, jsync) {
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - Referenced variable can't be found with hash " + hash;
    }
    return details;
  }
  function isPrimitive(type) {
    if (type === 'number'    ||
        type === 'number'    ||
        type === 'string'    ||
        type === 'boolean'   ||
        type === 'undefined' ||
        type === 'null'      ||
        type === 'empty'     ||
        type === 'bigint'    ||
        type === 'function') {  // Functions are, for now, read-only
      return true
    } else {
      return false
    }
  }

  function newCollection(type, sampleObj) {
    if (type === 'array') {
      return new Array(sampleObj ? sampleObj.length : 0);
    } else if (type === 'object') {
      return {};
    } else {
      throw "Jsynchronous error - cannot create a varible of an unrecognized type " + type;
    }
  }

  function enumerate(obj, type, func) {
    if (type === 'array') {
      for (var j=0; j<obj.length; j++) {
        func(j, obj[j]);
      }
    } else if (type === 'object') {
      for (var prop in obj) {
        func(prop, obj[prop]);
      }
    }
  }

  function addSynchronizedVariableMethods(jsync, targetVariable) {
    // targetVariable will be details.variable if it's synced. Otherwise it should be a stand-in variable
    Object.defineProperty(targetVariable, '$on', { 
      value: function $on(event, firstArg, secondArg, thirdArg) {
        var props;
        var options;
        var callback;

        for (let i=0; i<3; i++) {
          var arg = [firstArg, secondArg, thirdArg][i];
          var argType = detailedType(arg);
          if (argType === 'array') {
            props = arg;
          } else if (argType === 'object') {
            options = arg;
          } else if (argType === 'function') {
            callback = arg;
          }
        }

        if (callback === undefined) {
          throw ".$on('" + event + "') needs to be provided a callback";
        }

        var e = {event: event, props: props, options: options, callback: callback};
        if (e.event === 'alter') {
          jsync.statefulEvents.push(e);
        } else if (e.event === 'changes') {
          jsync.changesEvents.push(e);
        } else {
          throw "Jsynchronous doesn't have an event trigger for event type '" + e.event + "'";
        }
      },
      writable: true,
    });

    Object.defineProperty(targetVariable, '$info', { 
      value: function $info(event, firstArg, secondArg, thirdArg) {
        if (jsync.standIn && jsync.jsync) {
          jsync = jsync.jsync; 
        }

        if (jsync.standIn) {
          return {
            name: jsync.name,
            standIn: true
          }
        } else {
          return {
            name: jsync.name,
            counter: jsync.counter,
            rewind: jsync.rewind,
            client_history: jsync.client_history,
            history_length: jsync.history.length,
            standIn: false,
          }
        }
      },
      writable: true,
    });
  }

  function triggerStatefulEvents(details, prop, value, oldValue, jsync) {
    for (var j=0; j<jsync.statefulEvents.length; j++) {
      var e = jsync.statefulEvents[j];
      var props = e.props;
      var options  = e.options;
      var callback = e.callback;
      var recursive = (options && options.recursive === true);

      if (recursive && jsync.root.descendants[details.hash]) {
        callback(value, oldValue, propertyTree, details.variable);
      }

      if (matchesPropertyTree(props, propertyTree, recursive)) {
        callback(value, oldValue, propertyTree, details.variable);
      }
    }
  }

  function triggerChangesEvent(jsync, props, callback) {
    var variable = jsync.root.variable;
    if (props) {
      // Provide the callback with variable relative to the properties they listed
      for (let j=0; j<props.length; j++) {
        variable = variable[props[j]];
      }
    }
    callback(variable);
  }

  // ----------------------------------------------------------------
  // Entry point
  // ----------------------------------------------------------------
  jsynchronous = get;
  jsynchronous.get = get;
  jsynchronous.onmessage = onmessage;
  jsynchronous.list = list;
}
jsynchronousSetup();

exports = jsynchronous;
if (typeof module === 'object') {
  module.exports = jsynchronous;
}
