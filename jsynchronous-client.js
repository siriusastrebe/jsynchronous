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
      var variables = json[3];

      newJsynchronousVariable(name, counter, variables);
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
        return jsyncs[name].root;
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
      return primaryJsync.root;
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
console.log('a');
      if (standInPrimaryVariable) {
console.log('b');
        return standInPrimaryVariable;
      } else {
console.log('c');
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

  function newJsynchronousVariable(name, counter, variables) {
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
      primaryJsync = jsync;
    }

    processInitialDescription(name, variables, jsync);
  }

  function processInitialDescription(name, data, jsync) {
    var root;
    if (name && standInNamedVariables[name]) {
      root = standInNamedVariables[name];
    } else if (primaryJsync === jsync && standInPrimaryVariable) {
      root = standInPrimaryVariable;
    }

    for (var i=0; i<data.length; i++) {
      var d = data[i];
      var hash = d[0];
      var type = TYPE_ENCODINGS[d[1]];
      var each = d[2];
      var description = createSyncedVariable(i === 0 ? root : undefined, hash, type, each, jsync); 

      if (i === 0) {  // Convention is 0th element is root
        jsync.root = description;
      }
    }

    resolveReferences(jsync);

    return jsync.root;
  }

  function createSyncedVariable(defaultVariable, hash, type, each, jsync) {
    // This function expects resolveReferences() to be called after all syncedVariables in the payload are processed
    var details = {
      hash: hash,
      type: type,
      linked: {},   // key->value corresponds to prop->childDetails
      parents: {},  // key->value corresponds to parentHash->[properties]
      variable: defaultVariable || newCollection(type)
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

    return details.variable;
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
        newObject(hash, type, each, jsync);
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
      value = details.variable;
    }

    object[prop] = value;
    // TODO: Trigger .on() changes here
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
  function newObject(hash, type, each, jsync) {
    createSyncedVariable(undefined, hash, TYPE_ENCODINGS[type], each, jsync); 
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
      return new Array(sampleObj.length);
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
