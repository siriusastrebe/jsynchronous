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
    'end',
    'snapshot',
    'handshake',
    'resync',
    'error',
  ]

  var clientReservedWords = {
    '$info': true,
    '$on': true,
    '$rewind': true,
    '$copy': true
  }

  var jsyncs = {}
  var standIns = {}
  var backoffs = {}

  function onmessage(data) {
    var json = JSON.parse(data);
    var op = OP_ENCODINGS[json[0]]; 
    var name = json[1];

    if (op === 'initial') {
      var counter = json[2];
      var settings = json[3]
      var variableData = json[4];

      var jsync = newJsynchronous(name, counter, settings, variableData);
      triggerChanges(jsync);
    } else if (op === 'changes') {
      var minCounter = json[2];
      var maxCounter = json[3];
      var changes = json[4];
      var jsync = jsyncs[name];

      if (jsync) {
        processChanges(minCounter, maxCounter, changes, jsync);
      } else {
        if (jsynchronous.send) {
          var uniqueId = 'initial' + name;
          communicateWithBackoff(uniqueId, ['initial', name], function () {
            console.log('Unknown jsynchronous variable, requesting initial' + name);
            return jsyncs[name] === undefined;
          }, 2000);
        } else {
          throw "JSynchronous server changes for unknown variable with name '" + name + "'";
        }
      }
    } else if (op === 'handshake') {
      var secret = json[2];
      var jsync = jsyncs[name];
      if (jsync === undefined) {
        throw "JSynchronous server handshake for unknown variable with name '" + name + "'";
      }
      jsync.secret = secret;
    }
  }

  function get(type, name) {
    var existing;
    if (!name) {
      name = '';
    }

    if (jsyncs[name]) {
      return jsyncs[name].root.variable;
    } else if (type) {
      return standInVariable(type, name);
    } else {
      var errorString = "jsynchronous() error - No synchronized variable available by name '" + name + "'. ";
      if (Object.keys(jsyncs).length === 0) {
        errorString += "Either connection has not been established, or .$sync has not yet been called on the server for this client. ";
      }
      errorString += "Use jsynchronous('array', name) to create a stand-in array or jsynchronous('object', name) to create a stand-in object. This stand-in variable will be automatically populated once synchronization succeeds.";
      throw errorString;
    }
  }
  function variables() {
    var variables = {}
    for (var name in jsyncs) {
      variables[name] = jsyncs[name].root.variable;
    }
    return variables;
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
      changesEvents: [],
      snapshotEvents: [],
      standIn: standIn || false,
      rewind: settings.rewind || false,
      one_way: settings.one_way || false,
      client_history: settings.client_history || false,
      history: [],
      secret: undefined,
      startTime: new Date().getTime(),
      snapshots: {},
      staging: {
        references: []
      },
      storedChanges: [],
      resyncs: []
    }

    if (settings.rewound === true) {
      jsync.rewound = true;
    }

    return jsync;
  }

  function newJsynchronous(name, counter, settings, data) {
    var rootType = TYPE_ENCODINGS[data[0][1]];
    var jsync = jsyncObject(name, counter, settings);
    var reserved;
    if (settings) reserved = settings.reserved;

    if (jsyncs[name] && rootType === detailedType(jsyncs[name].root.variable) && !jsync.rewound) {
      jsync.root = jsyncs[name].root;  // If init is called multiple times, just update the original
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

    addSynchronizedVariableMethods(jsync, jsync.root.variable, reserved);

    resolveReferences(jsync);

    if (settings.rewind) {
      jsync.initial = {
        name: name, 
        counter: counter, 
        settings: settings, 
        data: data
      }
    }

    if (jsync.rewound !== true) {
      jsyncs[name] = jsync;

      if (jsync.one_way !== true) {
        var rootHash = data[0][0];
        handshake(jsync, rootHash);
      }
    }

    return jsync;
  }

  function standInVariable(type, name) {
    if (standIns[name]) {
      return standIns[name].variable;
    } else {
      standIns[name] = jsyncObject(name, -1, {}, true);

      if (detailedType(type) === 'array') {
        type = 'array';
      } else if (detailedType(type) === 'object') {
        type = 'object';
      }

      standIns[name].variable = newCollection(type);
      addSynchronizedVariableMethods(standIns[name], standIns[name].variable);
      return standIns[name].variable;
    }
  }

  function standInMatch(isRoot, type, jsync) {
    var standIn;
    if (isRoot && jsync.rewound !== true) {
      var name = jsync.name;
      if (standIns[name]) {
        standIn = standIns[name];
      }

      if (standIn && detailedType(standIn.variable) !== type) {
        console.error("jsynchronous('" + detailedType(standIn.variable) + ", '" + name + "') is the wrong variable type, the type originating from the server is '" + type + "'. Your stand-in variable is unable to reference the synchronized variable.")
        standIn = undefined;
      }
    }

    if (standIn) {
      // Copy events assigned to standIn while waiting on the synchronized variable
      copyEvents(standIn, jsync);
    }

    return standIn;
  }
  function copyEvents(source, target) {
    var eventTypes = {'changes': 'changesEvents', 'snapshot': 'snapshotEvents'};

    for (var eventName in eventTypes) {
      for (var i=0; i<source[eventTypes[eventName]].length; i++) {
        var ev = source[eventTypes[eventName]][i];
        if (target[eventTypes[eventName]].indexOf(ev) === -1) {
          target[eventTypes[eventName]].push(ev);
        }
      }
    }
  }

  function createSyncedVariable(hash, type, each, jsync, isRoot) {
    // This function relies on resolveReferences() being called after all syncedVariables in the payload are processed
    var existing = jsync.objects[hash];
    if (!existing && isRoot) existing = jsync.root;

    var standIn = standInMatch(isRoot, type, jsync)

    var details = {
      hash: hash,
      type: type,
      variable: undefined,
      descendants: {}, // key->value corresponds to descendant.hash->[properties]. Follow properties to find descendant
      parents: {},     // key->value corresponds to parentHash->{details: parent, props: []}
      children: {}     // key->value corresponds to childHash->{details: child, props: []}
    }

    if (existing && detailedType(existing.variable) === type) {
      strip(existing.variable);  // Start variable fresh
      details.variable = existing.variable;  // If init is called multiple times, update the original references
    } else if (standIn) {
      details.variable = standIn.variable;
    } else {
      details.variable = newCollection(type);
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
      //link(r.details, childDetails, r.prop);
      r.details.variable[r.prop] = childDetails.variable;
    }
    jsync.staging.references.length = 0;
  }


  function processChanges(minCounter, maxCounter, changes, jsync) {
    if (minCounter < jsync.counter) {
      console.error("Jsynchronous duplicate receipt of changes, expected " + jsync.counter + ", got " + minCounter);
      // throw "Jsynchronous duplicate receipt of changes, expected " + jsync.counter + ", got " + minCounter;
    } else if (minCounter > jsync.counter) {
      if (jsync.one_way !== true) {
        requestMissingRanges(jsync, minCounter, maxCounter, changes);
        return // Hold off on applying changes that are too far ahead 
      } else if (jsync.rewind || jsync.client_history) {
        while (jsync.history.length < minCounter) {
          jsync.history.push(null);
        }
      }
    }

    var triggerEvents = false;

    for (var i=jsync.counter - minCounter; i<changes.length; i++) {
      var change = changes[i];

      if (change === null) { continue }

      var op = OP_ENCODINGS[change[0]];
      var hash = change[1];
      var details;
      var pt;

      if (op === 'set' || op === 'delete' || op === 'end') {
        details = jsync.objects[hash];
        if (details === undefined) {
          if (op !== 'end') {
            console.error("Jsynchronous error - " + op + " for an object hash " + hash + " that is not registered with the synchronized variable by name '" + jsync.name + "'");
          }
          continue
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
      } else if (op === 'snapshot') {
        var counter = change[1];
        var name = change[2];
        createSnapshot(counter, name, jsync);
      } else {
        throw "Jsynchronous error - Unidentified operation coming from server: " + op;
      }

      if (op === 'set' || op === 'delete') {
        triggerEvents = true;
      }

      if (jsync.rewind || jsync.client_history) { 
        jsync.history.push(change);
      }
    }

    jsync.counter = maxCounter+1;

    if (jsync.client_history && jsync.client_history < jsync.history.length) {
      jsync.history = jsync.history.slice(Math.floor(jsync.history.length / 2));
    }

    resolveReferences(jsync);

    cleanStorage(jsync);

    var stored = jsync.storedChanges[0];
    if (stored && stored.min === jsync.counter) {
      jsync.storedChanges.shift();
      processChanges(stored.min, stored.max, stored.changes, jsync);
    }

    if (triggerEvents) {
      triggerChanges(jsync);
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
  }
  function endObject(details, jsync) {
    // Memento mori
    delete jsync.objects[details.hash];
  }

  function rewind(jsync, snapshot, counter) {
    if (typeof snapshot !== 'string' && typeof snapshot !== 'number' && isNaN(counter)) {
      throw "$rewind() requires a snapshot name as the first argument, or a counter number as the second."
    }

    if (typeof snapshot === 'string' || typeof snapshot === 'number') {
      if (jsync.snapshots[snapshot]) {
        counter = jsync.snapshots[snapshot].counter;
      } else {
        throw "No snapshot with the name " + snapshot;
      }
    } 

    if (typeof counter !== 'number' || counter === null) {
      throw "$rewind() requires a snapshot name as the first argument, or a counter number as the second."
    }

    if (jsync.rewind === true) {
      var settings = {};
      var initial = jsync.initial;

      for (var key in initial.settings) {
        settings[key] = initial.settings[key];
      }

      settings.rewound = true;
      settings.rewind = false;  // Rewound jsyncs don't keep separate history and can't have $rewind() called.
      settings.client_history = 0;

      var rewound = newJsynchronous(initial.name, initial.counter, settings, initial.data);
      var changes = jsync.history.slice(0, counter);
      processChanges(0, counter, changes, rewound);
      return rewound.root.variable;
    } else {
      throw "This synchronized variable is not set up for rewind mode";
    }
  }

  function nearestCachedRewind(counter) {
    // TODO: implement reverseChanges, implement this, cache rewinds, refactor rewinds to reverse if it's faster than processing changes forwards. All performance considerations.
  }

  function createSnapshot(counter, name, jsync) {
    jsync.snapshots[name] = {counter: counter, name: name};

    for (var i=0; i<jsync.snapshotEvents.length; i++) {
      const ev = jsync.snapshotEvents[i];
      ev.callback(name);
    }
  }

  function sortedSnapshots(jsync) {
    var snapshots = [];
    for (var name in jsync.snapshots) {
      snapshots.push(jsync.snapshots[name]);
    }
    snapshots.sort(function (a, b) {
      return a.counter - b.counter;
    });

    return snapshots;
  }

  function requestMissingRanges(jsync, minCounter, maxCounter, changes) {
    if (jsynchronous.send === undefined) {
      throw "Jsynchronous client is out of sync, unable to resynchronize without a user-specified jsynchronous.send = (data) => {} function";
    }
  
    if (jsync.secret === undefined && new Date() - jsync.startTime > 10000) {
      throw "Jsynchronous is out of sync, cannot resync without a successful handshake";
    }

    if (jsync.secret) {

      // TODO: Request only missing ranges
      var uniqueId = 'resync' + jsync.name;
      var payload = ['resync', jsync.name, jsync.secret, jsync.counter, minCounter];
      communicateWithBackoff(uniqueId, payload, function () {
        return jsync.counter < maxCounter;
      });
      jsync.resyncs.push({t: new Date().getTime(), min: minCounter, max: jsync.counter});
    }
  
    jsync.storedChanges.push({
      min: minCounter,
      max: maxCounter,
      changes: changes,
    });
  }
  function cleanStorage(jsync) {
    var splices = 0;
    for (var i=0; i<jsync.storedChanges.length; i++) {
      var change = jsync.storedChanges[i];

      if (change.min < jsync.counter) {
        splices++;
      } else {
        break;
      }
    }

    if (splices > 0) {
      jsync.storedChanges.splice(0, splices);
    }

    delete backoffs['resync' + jsync.name];
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

  function strip(enumerable) {
    var type = detailedType(enumerable);
    if (type === 'array') {
      enumerable.length = 0;
    } else if (type === 'object') {
      for (var key in enumerable) {
        delete enumerable[key];  
      }
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

  function copy(target, visited, mirrored) {
    if (visited === undefined) visited = [];
    if (mirrored === undefined) mirrored = [];

    var index = visited.indexOf(target);
    if (index !== -1) {
      return mirrored[index];
    }

    const type = detailedType(target);

    if (isPrimitive(type)) {
      return target;
    } else {
      const mirror = newCollection(type, target);

      visited.push(target);
      mirrored.push(mirror);

      enumerate(target, type, (value, prop) => {
        mirror[prop] = copy(value, visited, mirrored);
      });

      return mirror;
    }
  }


  function addSynchronizedVariableMethods(jsync, targetVariable, reservedWords) {
    // targetVariable will be details.variable if it's synced. Otherwise it should be a stand-in variable
    if (reservedWords === undefined) reservedWords = {}
    for (var key in clientReservedWords) { 
      if (!reservedWords[key]) {
        reservedWords[key] = key;
      }
    }

    Object.defineProperty(targetVariable, reservedWords['$on'], { 
      value: function $on(event, firstArg, secondArg, thirdArg) {
        var props;
        var options;
        var callback;

        for (var i=0; i<3; i++) {
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
        if (e.event === 'changes') {
          jsync.changesEvents.push(e);
        } else if (e.event === 'snapshot') {
          jsync.snapshotEvents.push(e);
        } else {
          throw "Jsynchronous doesn't have an event trigger for event type '" + e.event + "'";
        }
      },
      writable: true,
    });

    Object.defineProperty(targetVariable, reservedWords['$copy'], { 
      value: function $copy() {
        return copy(jsync.root.variable);
      },
      writable: true,
    });

    Object.defineProperty(targetVariable, reservedWords['$info'], { 
      value: function $info() {
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
            rewound: jsync.rewound === true,
            one_way: jsync.one_way === true,
            client_history: jsync.client_history,
            history_length: jsync.history.length,
            snapshots: sortedSnapshots(jsync),
            standIn: false,
            resyncs: jsync.resyncs.length,
            handshake: jsync.secret !== undefined,
          }
        }
      },
      writable: true,
    });

    if (jsync.rewind === true) {
      Object.defineProperty(targetVariable, reservedWords['$rewind'], {
        value: function $rewind(snapshot, counter) {
          return rewind(jsync, snapshot, counter);
        },
        writable: true,
      });
    }
  }
  function triggerChanges(jsync, callback) {
    for (var j=0; j<jsync.changesEvents.length; j++) {
      var e = jsync.changesEvents[j];
      var variable = jsync.root.variable;
      e.callback(variable);
    }
  }

  // ----------------------------------------------------------------
  // Resyncing and communication
  // ----------------------------------------------------------------
  function communicate(op, a, b, c, d) {
    var payload = []
    payload.push(OP_ENCODINGS.indexOf(op));
    if (a !== undefined) payload.push(a);
    if (b !== undefined) payload.push(b);
    if (c !== undefined) payload.push(c);
    if (d !== undefined) payload.push(d);

    jsynchronous.send(JSON.stringify(payload));
  }

  function communicateWithBackoff(uniqueId, args, resendFunc, timeout) {
    var defaultTimeout = 1000;
    timeout = timeout || defaultTimeout;

    if (jsynchronous.send !== undefined) {
      if (backoffs[uniqueId] === undefined || backoffs[uniqueId] <= new Date().getTime()) {
        backoffs[uniqueId] = new Date().getTime() + timeout - 20;
        communicate(args[0], args[1], args[2], args[3], args[4]);
        setTimeout(() => {
          if (resendFunc()) {
            communicateWithBackoff(uniqueId, args, resendFunc, timeout * 2);
          }
        }, timeout);
      }
    }
  }

  function handshake(jsync, rootHash, timeout) {
    if (jsynchronous.send === undefined) {
      console.warn("Jsynchronous client hasn't been provided a jsynchronous.send = (data) => {}  function. This jsynchronous client will not be able to re-synchronize in the event of a TCP/IP connection interrupt.");
      return
    }

    if (jsync.one_way === true) {
      return;
    }

    var uniqueId = 'handshake-' + jsync.name;
    communicateWithBackoff(uniqueId, ['handshake', jsync.name, rootHash], function () {
      return jsync.secret === undefined;
    });

    setTimeout(() => {
      if (jsync.secret === undefined) {
        console.warn("Jsynchronous client->server handshake left hanging for over 20 seconds. This usually means haven't set up the server to call jsynchronous.onmessage(websocket, data). Resynchronization is impossible without a successful handshake. Use the option {one_way: true} on the server side call to jsynchronous() to disable this warning.");
      }
    }, 20000);
  }


  // ----------------------------------------------------------------
  // Entry point
  // ----------------------------------------------------------------
  jsynchronous = get;
  jsynchronous.onmessage = onmessage;
  jsynchronous.list = list;
  jsynchronous.variables = variables;
}
jsynchronousSetup();

exports = jsynchronous;
if (typeof module === 'object') {
  module.exports = jsynchronous;
}
