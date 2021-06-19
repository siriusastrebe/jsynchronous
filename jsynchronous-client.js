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
  var primaryJsync;

  var standInPrimaryVariable;
  var standInNamedVariables = {}

  function onmessage(data) {
    var json = JSON.parse(data);
    var op = OP_ENCODINGS[json[0]]; 

    if (op === 'initial') {
      var name = json[1];
      var counter = json[2];
      var variableData = json[3];

      newJsynchronousVariable(name, counter, variableData);
    } else if (op === 'changes') {
      var name = json[1];
      var minCounter = json[2];
      var maxCounter = json[3];
      var changes = json[4];
      processChanges(name, minCounter, maxCounter, changes);
    }
  }

  function get(name, standInType) {
    var existing;

    if (name) {
      if (jsyncs[name]) {
        return jsyncs[name].root.variable;
      } else if (standInType) {
        return standInVariable(name, standInType);
      } else {
        var errorString = "jsynchronous() error - No synchronized variable available by name " + name + ". ";
        if (primaryJsync) {
          errorString += "Either connection has not been established, or .$sync has not yet been called on the server for this client. ";
        }
        errorString += "Use jsynchronous(name, 'array') to create a stand-in array or jsynchronous(name, 'object') to create a stand-in object. This stand-in variable will be automatically populated once synchronization succeeds.";
        throw errorString;
      }
    } else if (primaryJsync) {
      return primaryJsync.root.variable;
    } else if (standInType) {
      return standInVariable(name, standInType);
    } else {
      throw "jsynchronous() error - No synchronized variable available. Either connection has not been established, or .$sync has not yet been called on the server for this client. Use jsynchronous('', 'array') to generate a stand-in array or jsynchronous('', 'object') to create a stand-in object. This stand-in variable will be automatically populated once synchronization succeeds.";
    }
  }
  function list() {
    return Object.keys(jsyncs);
  }

  function standInVariable(name, type) {
    if (!name) {
      if (standInPrimaryVariable) {
        return standInPrimaryVariable;
      } else {
        standInPrimaryVariable = newCollection(type);
        // TODO: Assign methods to variable
        return standInPrimaryVariable;
      }
    } else {
      if (standInNamedVariables[name]) {
        return standInNamedVariable[name];
      } else {
        standInNamedVariables[name] = newCollection(type);
        return standInNamedVariables[name];
      }
    }
  }

  function newJsynchronousVariable(name, counter, data) {
    var jsync = {
      name: name,
      counter: counter,  // Counter will always be 1 above the last packet
      objects: {},  // key-> value corresponds to details.hash->details
      root: undefined,
      staging: {
        references: []
      }
    }

    jsyncs[name] = jsync;
    if (primaryJsync === undefined) {  
      // TODO: This makes the primary variable determined by first-to-arrive. The server should determine primary variable first-to-send.
      primaryJsync = jsync;
    }

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

  function createSyncedVariable(hash, type, each, jsync, isRoot) {
    // This function expects resolveReferences() to be called after all syncedVariables in the payload are processed
    var standIn;
    if (isRoot) {
      var name = jsync.name;
      var standInName = '';
      if (name && standInNamedVariables[name]) {
        standIn = standInNamedVariables[name];
        standInName = jsync.name;
      } else if (primaryJsync === jsync && standInPrimaryVariable) {
        standIn = standInPrimaryVariable;
      }

      var standInType = detailedType(standIn)
      if (standIn && standInType !== type) {
        standIn = undefined;
        console.error( "jsynchronous('" + standInName + "', '" + standInType + "') is the wrong variable type, the type originating from the server is '" + type + "'. Your stand-in variable is unable to reference the synchronized variable." )
      }
    }

    var details = {
      hash: hash,
      type: type,
      linked: {},   // key->value corresponds to prop->childDetails
      parents: {},  // key->value corresponds to parentHash->[properties]
      variable: standIn || newCollection(type)
    }

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
      linkParent(r.details, childDetails, r.prop);
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

    for (let i=0; i<changes.length; i++) {
      var change = changes[i];
      var op = OP_ENCODINGS[change[0]];
      var hash = change[1];

      if (op === 'set') {
        var prop = change[2];
        var newDetails = change[3];
        var oldDetails = change[4];
        set(hash, prop, newDetails, oldDetails, jsync);
      } else if (op === 'del') {
        var prop = change[2];        
        var oldDetails =  change[4];
        del(hash, prop, oldDetails, jsync);
      } else if (op === 'new') {
        var type = change[2];
        var each = change[3];
        createSyncedVariable(hash, TYPE_ENCODINGS[type], each, jsync); 
      } else if (op === 'end') {
        endObject(hash, jsync);
      } else {
        throw "Jsynchronous error - Unidentified operation coming from server.";
      }
    }

    resolveReferences(jsync);
  }

  function set(hash, prop, newDetails, oldDetails, jsync) {
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - Set for an object hash " + hash + " that is not registered with the synchronized variable by name " + jsync.name;
    }

    var object = details.variable;
    var type = TYPE_ENCODINGS[newDetails[0]];
    var value;

    if (isPrimitive(type)) {
      value = resolvePrimitive(type, newDetails[1]);
    } else {
      var childDetails = resolveSyncedVariable(newDetails[1], jsync);
      linkParent(details, childDetails, prop);
      value = childDetails.variable;
    }

    object[prop] = value;

    // TODO: support oldValue
    triggerEvents('set', details, prop, value, jsync);
  }
  function del(hash, prop, jsync) {
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - Prop deletion for an object hash " + hash + " that is not registered with the synchronized variable by name " + jsync.name;
    }

    //unlinkParent(details, prop);

    var object = details.variable;

    delete object[prop];

    // TODO: Trigger .on() changes here. If we're going to link/unlink parent on the client side, here would be the place.
  }
  function endObject(hash, jsync) {
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - End for an object hash " + hash + " that is not registered with the synchronized variable by name " + jsync.name;
    }

    // Memento mori
    delete jsync.objects[hash];
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
  function addSynchronizedVariableMethods(details) {
    details.changeEvents = [];
    details.setEvents = [];
    details.delEvents = [];
    details.variable.$on = function (event, firstArg, secondArg, thirdArg) {
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

      var e = {props: props, options: options, callback: callback};
      if (event === 'change') {
        changeEvents.push(e)
      } else if (event === 'set') {
        setEvents.push(e);
      } else if (event === 'del') {
        delEvents.push(e);
      }
    }
  }

  function triggerEvents(event, details, prop, value, jsync) {
    var ancestryTree = findAncestryTree(jsync, details)
    var propertyTree = findPropertyTree(ancestryTree, jsync.root.hash, details.hash, prop, event);
    console.log(event, propertyTree);
  }

  function findAncestryTree(jsync, details, from, prop, visited) {
    // Walks up the ancestry, collecting visited hashes, its properties and referenced hashes
    var startOfRecursion = (prop === undefined && from === undefined);
    var recur = true;

    if (visited == undefined) {
      visited = {};  // key->value corresponds to hash->{prop: value's-hash}
    }

    if (visited[details.hash] === undefined) {
      visited[details.hash] = {};
    } else {
      recur = false;  // Visited already
    }

    if (startOfRecursion === false) {
      visited[details.hash][prop] = from.hash;
    }

    if (recur) {
      for (var hash in details.parents) {
        var parent = jsync.objects[hash];
        var properties = details.parents[hash];

        if (parent === undefined) {
          throw "Jsynchronous sanity error - finding ancestry tree encountered a parent that is not present in the synchronized objects list.";
        }

        for (let i=0; i<properties.length; i++) {
          var property = properties[i];
          findAncestryTree(jsync, parent, details, property, visited);
        }
      }
    }

    return visited;
  }

  function findPropertyTree(ancestryTree, currentHash, targetHash, targetProp, targetValue, hashesSeen) {
    // Walks down descendants of provided hash, creating a nested object with each of its keys as properties that lead to targetHash.
    var props = {}; 
    var propsValues = ancestryTree[currentHash];

    if (currentHash === targetHash) {
      return {targetProp: targetValue};
    }

    if (hashesSeen === undefined) hashesSeen = [currentHash];

    for (var prop in propsValues) {
      var childHash = propsValues[prop];
      if (hashesSeen.indexOf(childHash) === -1) {
        var hashesSeenCopy = hashesSeen.slice();
        hashesSeenCopy.push(childHash);

        props[prop] = findPropertyTree(ancestryTree, childHash, targetHash, targetProp, targetValue, hashesSeenCopy);
      }
    }

    return props;
  }

  function linkParent(parentDetails, childDetails, prop) {
    parentDetails.linked[prop] = childDetails;

    if (childDetails.parents[parentDetails.hash] === undefined) {
      childDetails.parents[parentDetails.hash] = [prop];
    } else if (childDetails.parents[parentHash].indexOf(prop) === -1) {
      childDetails.parents[parentDetails.hash].push(prop);
    }
  }
  function unlinkParent(parentDetails, prop) {
    var childDetails = parentDetails.linked[prop];

    var properties = childDetails.parents[parentHash];
    if (properties) {
      var index = properties.indexOf(prop);
      if (index !== -1) {
        properties.splice(index, 1);
      }
    }

    delete parentDetails.linked[prop];

    if (properties.length === 0) {
      delete this.parents[parentHash];
    }

    // We don't have to garbage collect the child, that should be triggered by the 'end' operation coming from the server
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
