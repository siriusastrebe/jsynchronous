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
      var type = ACRONYMS[d.t];
      var variable = newCollection(type); 

      var details = {
        hash: d.h,
        type: type,
        variable: variable
      }

      jsync.objects[details.hash] = details;

      enumerate(d.e, type, function (prop, value) {
        if (Array.isArray(value)) {  // Via convention references to other objects/arrays are wrapped inside []
          // We need to wait for all variables to be registered, esp in circular data structures
          const reference = {
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

      if (i === 0) {  // Convention is 0th element is root
        jsync.root = variable;
      }
    }

    var references = jsync.staging.references;
    for (var j=0; j<references.length; j++) {
      var r = references[j];
      var details = jsync.objects[r.hash];
      if (details === undefined) {
        throw "Jsynchronous sanity error - Referenced variable can't be found with hash " + r.hash;
      }
      var variable = details.variable
      r.variable[r.prop] = variable;
    }

    return jsync.root;
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

  function newCollection(type) {
    if (type === 'array') {
      return [];
    } else if (type === 'object') {
      return {};
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
