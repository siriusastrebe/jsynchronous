var jsynchronous = function () {
  var ACRONYMS = {
    'a': 'array',
    'b': 'boolean',
    'bi': 'bigint',
    'e': 'empty',
    'o': 'object',
    'n': 'number',
    's': 'string',
    'u': 'undefined',
    'null': null
  }

  var jsyncs = {}
  var recentJsync;

  function onmessage(data) {
console.log('onmessage', data);
    var json = JSON.parse(data);

    if (Array.isArray(json)) {
      processUpdates(json);
    } else {
      newJsynchronousVariable(json);
    }
  }

  function get(name) {
    if (name) {
      return jsyncs[name];
    } else if (recentJsync) {
      return recentJsync.root;
    }
  }

  function newJsynchronousVariable(data) {
    var jsync = {
      name: data.name,
      counter: data.c,  // Counter will always be 1 above the last packet
      objects: {},  // key-> value corresponds to details.hash->details
      root: undefined,
      staging: {
        references: []
      }
    }

    jsyncs[data.name] = jsync;
    recentJsync = jsync;

    processInitialDescription(data.e, jsync);
  }

  function processInitialDescription(data, jsync) {
    for (var i=0; i<data.length; i++) {
      var d = data[i];
      var hash = d.h;
      var type = ACRONYMS[d.t];
      var each = d.e;
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

    enumerate(each, type, function (prop, value) {
      if (Array.isArray(value)) {  // Via convention references to other objects/arrays are wrapped inside []
        // We need to wait for all variables to be registered, esp in circular data structures
        var reference = {
          variable: variable,
          prop: prop,
          hash: value[0]
        }
        jsync.staging.references.push(reference);
      } else {  // Primitives will be wrapped inside an object
        if (value !== 'e') {  // Skip empty array elements
          variable[prop] = resolvePrimitive(ACRONYMS[value.t], value.v);
        }
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
  function processUpdates(data) {
    var name = data[0];
    var jsync = jsyncs[name];
    if (jsync === undefined) {
      throw "JSynchronous error - Server provided changes for a variable not registered with this client with the name " + name;
    }

    var changes = data[1];
    for (let i=0; i<changes.length; i++) {
      var change = changes[i];
      var id = change[0];
      var op = change[1];
      var hash = change[2];

      if (id !== jsync.counter) {  // TODO: Handle missing ranges (broken TCP/IP connection)
        throw "Jsynchronous error - Updates came out of order. Expected " + jsync.counter + " got " + id + ". This means your TCP/IP connection was reset in your transport";
      } else {
        jsync.counter++;
      }

      if (op === 'set') {
        var prop = change[3];
        var newDetails =  change[4];
        var oldDetails =  change[4];
        set(hash, prop, newDetails, oldDetails, jsync);
      } else if (op === 'del') {
        var prop = change[3];        
        var oldDetails =  change[5];
        del(hash, prop, oldDetails, jsync);
      } else if (op === 'new') {
        var type = change[3];
        var each = change[4];
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
    console.log('setting', hash, prop, newDetails, oldDetails)
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - Set for an object hash " + hash + " that is not registered with the synchronized variable by name " + jsync.name;
    }

    var object = details.variable;
    var type = ACRONYMS[newDetails.t];

    var value;

    if (Array.isArray(newDetails)) {  // Via convention if a description is wrapped in an array, it's a reference to another object
      value = resolveSyncedVariable(newDetails[0], jsync);
    } else {
      value = resolvePrimitive(type, newDetails.v);
    }


    object[prop] = value;
    // TODO: Trigger .on() changes here
  }
  function del(hash, prop, jsync) {
    console.log('deleting', hash, prop)
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - Prop deletion for an object hash " + hash + " that is not registered with the synchronized variable by name " + jsync.name;
    }

    var object = details.variable;

    delete object[prop];

    // TODO: Trigger .on() changes here. If we're going to link/unlink parent on the client side, here would be the place.
  }
  function newObject(hash, type, each, jsync) {
    console.log('new obj', hash, type, each, jsync)
    createSyncedVariable(hash, ACRONYMS[type], each, jsync); 
  }
  function endObject(hash, jsync) {
    console.log('end obj', hash)
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
      return new BigInt(value);
    } else if (type === 'number') {
      return value;
    } else if (type === 'string') {
      return value;
    } else if (type === 'undefined') {
      return undefined;
    } else if (type === null) {
      return null;
    }
  }
  function resolveSyncedVariable(hash, jsync) {
    var details = jsync.objects[hash];
    if (details === undefined) {
      throw "Jsynchronous error - Referenced variable can't be found with hash " + r.hash;
    }
    return details.variable;
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
