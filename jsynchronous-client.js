var jsynchronous = function () {
  var TYPE_ENCODINGS = [
    'array',
    'object',
    'number',
    'string',
    'boolean',
    'undefined',
    'null',
    'empty',
    'bigint'
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
  var recentJsync;

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

  function get(name) {
    if (name) {
      return jsyncs[name];
    } else if (recentJsync) {
      return recentJsync.root;
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
    recentJsync = jsync;

    processInitialDescription(variables, jsync);
  }

  function processInitialDescription(data, jsync) {
    for (var i=0; i<data.length; i++) {
      var d = data[i];
      var hash = d[0];
      var type = TYPE_ENCODINGS[d[1]];
      var each = d[2];
      var variable = createSyncedVariable(hash, type, each, jsync); 

      if (i === 0) {  // Convention is 0th element is root
        jsync.root = variable;
      }
    }

    resolveReferences(jsync);

    return jsync.root;
  }

  function createSyncedVariable(hash, type, each, jsync) {
    // This function expects resolveReferences() to be called after all syncedVariables in the payload are processed
    var variable = newCollection(type, each); 

    var details = {
      hash: hash,
      type: type,
      variable: variable
    }

    jsync.objects[hash] = details;

    enumerate(each, type, function (prop, encoded) {
      var t = TYPE_ENCODINGS[encoded[0]]
      var v = encoded[1];

      if (isPrimitive(t)) {
        if (t !== 'empty') {
          variable[prop] = resolvePrimitive(t, v);
        }
      } else {  
        var reference = {
          variable: variable,
          prop: prop,
          hash: v
        }
        jsync.staging.references.push(reference);  // We need to wait for all variables to be registered, esp in circular data structures
      }
    });

    return variable;
  }


  function resolveReferences(jsync) {
    var references = jsync.staging.references;
    for (var j=0; j<references.length; j++) {
      var r = references[j];
      var variable = resolveSyncedVariable(r.hash, jsync);
      r.variable[r.prop] = variable;
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
      value = resolveSyncedVariable(newDetails[1], jsync);
    }

    object[prop] = value;
    // TODO: Trigger .on() changes here
  }
  function del(hash, prop, jsync) {
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - Prop deletion for an object hash " + hash + " that is not registered with the synchronized variable by name " + jsync.name;
    }

    var object = details.variable;

    delete object[prop];

    // TODO: Trigger .on() changes here. If we're going to link/unlink parent on the client side, here would be the place.
  }
  function newObject(hash, type, each, jsync) {
    createSyncedVariable(hash, TYPE_ENCODINGS[type], each, jsync); 
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
    }
  }
  function resolveSyncedVariable(hash, jsync) {
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - Referenced variable can't be found with hash " + hash;
    }
    return details.variable;
  }
  function isPrimitive(type) {
    if (type === 'number'     || 
        type === 'number'     || 
        type === 'string'    || 
        type === 'boolean'   || 
        type === 'undefined' || 
        type === 'null'      || 
        type === 'empty'     || 
        type === 'bigint') {
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

  // ----------------------------------------------------------------
  // Entry point
  // ----------------------------------------------------------------
  return {
    onmessage: onmessage,
    get: get
  }
};

exports = jsynchronous;
