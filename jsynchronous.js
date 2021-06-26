'use strict';

const TYPE_ENCODINGS = {
  'array': 0,
  'object': 1,
  'number': 2,
  'string': 3,
  'boolean': 4,
  'undefined': 5,
  'null': 6,
  'empty': 7,
  'bigint': 8,
  'function': 9
}

const OP_ENCODINGS = {
  'initial': 0,
  'changes': 1,
  'set': 2,
  'delete': 3,
  'new': 4,
  'end': 5
}

const syncedNames = {};


class Change {
  constructor(syncedObject, operation, prop, value, type, oldValue, oldType) {
    // A change exists in the space of two snapshots in time for objects that may not exist earlier or presently.
    // It's important for garbage collection that a change does not directly reference any synced variables, only hashes.
    const jsync = syncedObject.jsync

    this.id = jsync.counter++;
    this.time = new Date().getTime();
    this.hash = syncedObject.hash;
    this.operation = operation;  // set, delete, pop, shift, unshift, etc.
    this.prop = prop;
    this.value = value;
    this.oldValue = oldValue;
    this.type = flat(type);
    this.oldType = flat(oldType);

    if (Array.isArray(syncedObject.proxy) && !isNaN(prop) && Number.isInteger(Number(prop))) {
      this.prop = Number(prop);  // Coerce prop to a number if it belongs to an array
    }

    jsync.communicate(this);
  }
  encode() {
    const change = [
      OP_ENCODINGS[this.operation],
      this.hash,
      this.prop,
      encode(this.value, this.type),
      encode(this.oldValue, this.oldType),
    ]

    return change;
  }
}

class Creation {
  constructor(jsync, syncedObject) {
    this.id = jsync.counter++;
    this.time = new Date().getTime();
    this.operation = 'new';
    this.description = syncedObject.describe();  // Description is stored in short-hand format. There is no long-hand format for a syncedObject description.

    jsync.communicate(this);
  }
  encode() {
    const creation = [
      OP_ENCODINGS[this.operation],
      this.description[0],
      this.description[1],
      this.description[2]
    ]
    return creation;
  }
}

class Deletion {
  constructor(jsync, syncedObject) {
    // We are expecting that no references exist to this variable any longer
    this.id = jsync.counter++;
    this.operation = 'end'; 
    this.time = new Date().getTime();
    this.hash = syncedObject.hash;

    jsync.communicate(this);

    delete jsync.objects[this.hash];
  }
  encode() {
    const deletion = [
      OP_ENCODINGS[this.operation],
      this.hash
    ]
    return deletion;
  }
}

class SyncedObject {
  constructor(jsync, original, visited) {
    this.hash = noCollisionHash(jsync.objects);
    this.jsync = jsync;
    this.type = detailedType(original);
    this.reference = newCollection(this.type, original);
    this.parents = {};  // parents key->value corresponds to parentHash->[properties]
    this.proxy = new Proxy(this.reference, this.handler(this));

    jsync.objects[this.hash] = this;

    if (visited === undefined) {
      visited = new Map();
    }
    visited.set(original, this);

    enumerate(original, (value, prop) => {
      const type = detailedType(value);
      const primitive = isPrimitive(type);

      if (primitive) { 
        this.reference[prop] = value;
      } else if (type === 'object' || type === 'array') {  // TODO: Support more enumerable types
        let syncedChild = value[jsynchronous.reserved_property];
        if (syncedChild === undefined) {
          if (visited.has(value)) {
            syncedChild = visited.get(value);
          } else {
            syncedChild = new SyncedObject(jsync, value, visited);
          }
          this.reference[prop] = syncedChild.proxy;
          syncedChild.linkParent(this, prop);
        } else {
          this.reference[prop] = syncedChild.proxy;
          syncedChild.linkParent(this, prop);
        }
      }
    });

    if (jsync.wait === false) {
      new Creation(jsync, this);
    }
  }
  handler(syncedObject) {
    return {
      get(obj, prop) {
        if (prop === jsynchronous.reserved_property) {
          return syncedObject;
        }

        if (isRoot(syncedObject)) {
          const reserved = syncedObject.jsync.reserved[prop];
          if (reserved) {
            return reserved;
          }
        }

        return obj[prop];
      },
      set(obj, prop, value) {
        const oldValue = obj[prop];
        const oldType = detailedType(oldValue);
        const type = detailedType(value);

        if (prop === 'length' && syncedObject.type === 'array' && obj.length === value) {
          return true  // Array lengths trigger every time the array is modified. We can ignore them
        }

        if (isRoot(syncedObject)) {
          if (syncedObject.jsync.reserved[prop]) {
            throw `Cannot reassign the jsynchronous reserved word ${prop}. If you need to use this property, you can reassign it by specifying {${prop}: 'reassigned-${prop}'} in the options when calling jsynchronous() on a newly synchronized variable.`;
          }
        }

        let syncedValue;

        if (isPrimitive(type) || type === 'function') {
          obj[prop] = value;
        } else {
          if (referencesAnotherJsynchronousVariable(value, syncedObject.jsync)) {
            throw `Cannot reference a jsynchronous variable that's already being tracked by another synchronized variable.`;
          }

          syncedValue = value[jsynchronous.reserved_property];
          if (syncedValue === undefined) {
            syncedValue = new SyncedObject(syncedObject.jsync, value);
            obj[prop] = syncedValue.proxy;
            syncedValue.linkParent(syncedObject, prop);
          } else {
            obj[prop] = syncedValue.proxy;
            syncedValue.linkParent(syncedObject, prop);
          }
        }

        // TODO: Detect array operations: splice, shift, unshift, length
        const operation = 'set';
        new Change(syncedObject, operation, prop, obj[prop], type, oldValue, oldType);

        if (!isPrimitive(oldType)) {
          let syncedOld = oldValue[jsynchronous.reserved_property];
          // TODO: comment these throws out. They aren't errors, they're sanity checks
          if (syncedOld === undefined) {
            throw `Jsynchronous sanity error - previously referenced variable was not being tracked.`
          }

          syncedOld.unlinkParent(syncedObject, prop);
        }

        return true;
      },
      deleteProperty(obj, prop) {
        const value = obj[prop]
        const type = detailedType(value);

        const operation = 'delete';
        const change = new Change(syncedObject, operation, prop, undefined, 'undefined', value, type);

        if (!isPrimitive(type)) {
          let deadManWalking = value[jsynchronous.reserved_property];
          // TODO: comment these throws out. They aren't errors, they're sanity checks
          if (deadManWalking === undefined) {
            throw `Jsynchronous sanity error - previously referenced variable was not being tracked.`
          }

          deadManWalking.unlinkParent(syncedObject, prop);
        }

        delete obj[prop];
        return true  // Indicate Success
      }
    }
  }
  linkParent(syncedParent, prop) {
    const parentHash = syncedParent.hash;

    if (this.parents[parentHash] === undefined) {
      this.parents[parentHash] = [prop];
    } else if (this.parents[parentHash].indexOf(prop) === -1) {
      this.parents[parentHash].push(prop);
    }
  }
  unlinkParent(syncedParent, prop) {
    const parentHash = syncedParent.hash;

    const properties = this.parents[parentHash];
    if (properties) {
      const index = properties.indexOf(prop);
      if (index !== -1) {
        properties.splice(index, 1);
      } else {
        throw `Unlinking a jsynchronous variable from its parent, this.parent's properties is missing the unlinked prop.`;
      }

      if (properties.length === 0) {
        delete this.parents[parentHash];
      }

      if (Object.keys(this.parents).length === 0) {
        // Prep for garbage collection
        new Deletion(this.jsync, this);
      }
    } else {
      throw `Unlinking a jsynchronous variable from its parent, this.parents is missing unlinked parent's properties.`;
    }
  }
  describe() {
    const state = [
      this.hash,
      TYPE_ENCODINGS[this.type],
      newCollection(this.type, this.proxy)
    ]

    enumerate(this.proxy, (value, prop) => {
      const type = detailedType(value);
      state[2][prop] = encode(value, type);
    });

    if (this.type === 'array') {
      labelEmpty(this.proxy, state[2]);  // We need to specify which array elements are empty, and which are undefined. They both end up as 'null' in JSON.stringify();
    }

    return state;
  }
}

class JSynchronous {
  // JSynchronous handles a group of proxied objects starting at the root.
  // all of the socket communication and authentication is handled through JSynchronous
  constructor(initial, options) {
    initial = initial || {}
    options = options || {}

    this.name = options.name || syncedNames[''] === undefined ? '' : noCollisionHash(syncedNames);
    this.startTime = undefined;
    this.objects = {};
    this.listeners = options.listeners || [];
    this.counter = 0;  // counter is always 1 more than the latest change's id.
    this.send = options.send || jsynchronous.send;
    this.buffer_time = options.buffer_time || 0;
    this.rewind = options.rewind || false;
    this.client_history = options.client_history || 0;
    this.history_limit = options.history_limit || 100000;
    this.wait = true;  // Ignore proxy setters while jsynchronous handles creation of the data structure
    this.history = [];
    this.rewindInitial = undefined;

    // You can reference jsynchronized variables from other places in your app. Be careful however, when assigning object and arrays to synchronized variables. The ALL of the contents will become visible to the connected clients.

    // These variables are special method names on the root of a jsynchronized variable. They will throw an error if you reassign these methods, so you can rename these methods by passing them into the options.
    this.jsyncReservedWord = options.jsync || '$ync';
    this.onmessageReservedWord = options.onmessage || '$onmessage';
    this.unsyncReservedWord = options.unsync || '$unsync';
    this.startsyncReservedWord = options.startsync || '$tart';
    this.listenersReservedWord = options.listeners || '$listeners';
    this.infoReservedWord = options.listeners || '$info';

    // Cerce this. to refer to this jsynchronous instance
    this.reserved = {}
    this.reserved[this.jsyncReservedWord]     = ((a) => this.j_sync(a));
    this.reserved[this.onmessageReservedWord] = ((a) => this.on_message(a));
    this.reserved[this.unsyncReservedWord]    = ((a) => this.un_sync(a));
    this.reserved[this.startsyncReservedWord] = ((a) => this.start_sync(a));
    this.reserved[this.listenersReservedWord] = (() => this.listeners);
    this.reserved[this.infoReservedWord]      = (() => this.info());

    this.bufferTimeout = undefined;
    this.queuedCommunications = [];
    this.root = undefined;

    this.cachedDescription = undefined;

    if (!enumerable(initial)) {
      throw `Cannot jsynchronize variables of type ${detailedType(initial)}. Try placing it in an object, or an array and then calling jsynchronous().`;
    }

    if (initial[jsynchronous.reserved_property]) {
      throw `Cannot jsynchronize an already synchronized variable`;
    }

    if (alreadySynchronized(initial)) {
      throw `Cannot jsynchronize a variable that references an already synchronized variable`;
    }

    if (syncedNames[this.name]) {
      throw `Jsynchronous name ${this.name} is already in use!`;
    }
    syncedNames[this.name] = this;

    // Synchronize the variable
    this.root = new SyncedObject(this, initial).proxy;

    this.wait = options.wait || false;

    if (this.wait === false && this.send === undefined) {
      throw `jsynchronize requires you to define a jsynchronous.send = (websocket, data) => {} function which will be called by jsynchronous every time data needs to be transmittied to connected clients.\nUse syncedVariable.$ync(websocket) to add a websocket to connected clients.\nYou can also pass in as an option {send: () => {}} to jsynchronous()`;
    }

    this.start = new Date().getTime();

    if (this.rewind === true && this.wait === false) {
      this.rewindInitial = this.describe();
    }
  }
  info() {
    return {
      wait: this.wait,
      name: this.name,
      startTime: this.startTime,
      counter: this.counter,
      buffer_time: this.buffer_time,
      rewind: this.rewind,
      client_history: this.client_history,
      history_limit: this.history_limit,
      history_length: this.history.length,

      reserved_words: {
        $ync: this.jsyncReservedWord,
        $onmessage: this.onmessageReservedWord,
        $unsync: this.unsyncReservedWord,
        $tart: this.startsyncReservedWord,
        $listeners: this.listenersReservedWord,
        $info: this.infoReservedWord
      },
      listeners: this.listeners
    }
  }
  communicate(change) {
    if (this.wait === false) {
      this.queuedCommunications.push(change);

      if (this.bufferTimeout === undefined) {
        this.bufferTimeout = setTimeout(() => this.sendChanges(), this.buffer_time);
      }
    }
  }
  sendChanges() {
    this.bufferTimeout = undefined;

    let min;
    let counter;
    let max;

    const changes = this.queuedCommunications.map((c) => {
      if (min === undefined) {
        min = c.id;
      } else if (counter+1 !== c.id) {
        throw `Jsynchronous sanity error - Attempting to send changes but they're not ascending order. Got ${c.id}, expected ${counter+1}`;
      }

      counter = c.id;
      max = c.id;

      return c.encode();
    });

    if (changes.length-1 !== max-min) {
      throw `Jsynchronous sanity error - Attempting to send changes but size of changes doesn't match the final tally. Expected ${changes.length} got ${max - min}`;
    }

    this.listeners.forEach((listener) => {
      this.send(listener, JSON.stringify([OP_ENCODINGS['changes'], this.name, min, max, changes]));
    });

    // Now that it's sent, the rest is history
    this.queuedCommunications.forEach((c) => {
      this.history.push(c);
    });

    this.queuedCommunications.length = 0;

    if (this.rewind !== true && this.history.length > this.history_limit) {
      this.history = this.history.slice(Math.floor(this.history.length / 2));
    }
  }
  sendInitial(websocket) {
    if (this.rewind !== true) {
      this.send(websocket, JSON.stringify(this.describe()));
    } else {
      // With rewind mode enabled, we want all clients to have the initial+full history always
      const initial = JSON.stringify(this.rewindInitial);
      this.send(websocket, initial); 

      if (this.history.length > 0) {
        let min;
        let max;
        const changes = this.history.map((c) => {
          if (min === undefined) {
            min = c.id;
          }
          max = c.id;
          return c.encode();
        });

        this.send(websocket, JSON.stringify([OP_ENCODINGS['changes'], this.name, min, max, changes]));
      }
    }
  }
  start_sync(jsync) {
    // If the constructor option {wait: true} was passed, starts sending packets to connected clients. 
    if (this.send === undefined) {
      throw `jsynchronize requires you to define a jsynchronous.send = (websocket, data) => {} function which will be called by jsynchronous every time data needs to be transmittied to connected clients.\nUse syncedVariable.$ync(websocket) to add a websocket to connected clients.\nYou can also pass in as an option {send: () => {}} to jsynchronous()`;
    }

    if (wait === true) {
      this.start = new Date().getTime();
      this.rewindInitial = this.describe();
      this.listeners.forEach((websocket) => {
        this.sendInitial(websocket);
      });
      this.wait = false;
    }
  }
  j_sync(websocket) {
    if (Array.isArray(websocket)) {
      websocket.forEach(ws => this.j_sync(ws));
    } else {
      // Adds the websocket client to a list of websockets to call send(websocket, data) to
      const index = this.listeners.indexOf(websocket);
      if (index === -1) {
        this.listeners.push(websocket);
      } else {
        // TODO: Change this to a warn?
        throw 'jsynchronous Error in .jsync(websocket), websocket is already being listened on: ' + websocket;
      }

      if (this.wait === false) {
        this.sendInitial(websocket);
      }
    }
  }
  un_sync(websocket) {
    const index = this.listeners.indexOf(websocket);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    } else {
      // TODO: Change this to a warn?
      throw 'jsynchronous Error in .unsync(websocket), no websocket registered that matches ' + websocket;
    }
  }
  on_message() {
  }
  describe() {
    if (this.cachedDescription && this.cachedDescription[2] === this.counter) {
      return this.cachedDescription
    }

    const settings = {
      rewind: this.rewind,
      client_history: this.client_history > 0 ? this.client_history : undefined,
    }

    const fullState = [
      OP_ENCODINGS['initial'],
      this.name,
      this.counter,
      settings
    ]

    const variables = recurse(this.root, true);

    fullState.push(variables.map((v) => {
      const syncedObject = v[jsynchronous.reserved_property];
      if (syncedObject === undefined) {
         throw `Jsynchronous sanity error - describe encountered a variable that was not being tracked.`;
      }
      return syncedObject.describe();
    }));

    this.cachedDescription = fullState;

    return fullState;
  }
}

// ----------------------------------------------------------------
// Entrypoint into the jsynchronous library
// ----------------------------------------------------------------
function jsynchronous(initial, options) {
  let jsync = new JSynchronous(initial, options);
  return jsync.root;
}

jsynchronous.reserved_property = '__jsynchronous__'; 

module.exports = jsynchronous;

// ----------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------
function noCollisionHash(existingHashes) {
  // Expects existingHashes to be of type object with existing hash as keys
  let hash = randomHash();
  while (existingHashes[hash] !== undefined) {
    hash = randomHash();
  }
  return hash;
}
function randomHash() {
  // Returns a 0-9a-f string between 9-12 characters in length
  return Math.random().toString(36).substring(2, 10);
}
function binarySearch(sortedArray, key){
  let start = 0;
  let end = sortedArray.length - 1;
  while (start <= end) {
    let middle = Math.floor((start + end) / 2);
    if (sortedArray[middle] === key) {
      return middle;
    } else if (sortedArray[middle] < key) {
      start = middle + 1;
    } else {
      end = middle - 1;
    }
  }
  return -1;
}

function isPrimitive(detailed) {
  // TODO: I think regex would be considered a primitive
  // Expects a detailed type from detailedType();
  if (detailed === 'boolean'   ||
      detailed === 'string'    ||
      detailed === 'number'    ||
      detailed === 'bigint'    ||
      detailed === 'null'      ||  // Although null is in ECMA an object, we'll consider it a primitive for simplicity
      detailed === 'undefined' || 
      detailed === 'function') {   // For now, functions are just values as far as jsynchronous is concerned
    return true;
  } else {
    return false;
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

//  } else if (value instanceof Map) { 
//    return 'map';
//  } else if (value instanceof Set) { 
//    return 'set';
//  } else if (value instanceof weakMap) { 
//    return 'weakset';
//  } else if (value instanceof weakSet) { 
//    return 'weakmap';
//  }
}


function newCollection(type, original) {
  // TODO: support more enumerable types like sets or maps
  if (type === 'array') {
    return new Array(original.length);
  } else if (type === 'object') {
    return {};
  }
}

function alreadySynchronized(obj) {
  return findRecursively(obj, (v) => v[jsynchronous.reserved_property]);
}

function referencesAnotherJsynchronousVariable(obj, jsync) {
  // Expects object array proxy or other enumerable.
  return findRecursively(obj, (v) => {
    const syncedObject = v[jsynchronous.reserved_property];
    if (syncedObject) {
      return syncedObject.jsync !== jsync
    } else {
      return false;
    }
  });
}


function enumerable(obj) {
  // TODO: support more enumerable types like sets or maps
  const type = detailedType(obj);
  if (type === 'object' || type === 'array') {
    return true;
  }
}

function enumerate(obj, func) {
  // Calls func(value, prop) on each property in the object
  const type = detailedType(obj);

  if (type === 'object' || type === 'array') {
    for (let prop in obj) {
      func(obj[prop], prop);
    }
  } else {
    throw `Unsupported data type in jsynchronous, ${type}`;
  }
}

function recurse(obj, includeObj, terminateFunc, visited) {
  // Returns all nodes in breadth first order. Returns descendants only if includeObj is false. Terminates after adding if terminateFunc returns true
  visited = visited || [];

  if (includeObj) {
    visited.push(obj);
  }

  if (terminateFunc && terminateFunc(obj)) {
    return visited;
  }

  enumerate(obj, (value, prop) => {
    // TODO: indexOf() is an O(n) algorithm. Maybe more efficient as a Map? Only testing can truly say
    if (enumerable(value) && visited.indexOf(value) === -1) {
      recurse(value, true, terminateFunc, visited);
    }
  });

  return visited;
}
function findRecursively(obj, conditionFunc) {
  const visited = recurse(obj, true, conditionFunc);

  if (conditionFunc(visited[visited.length-1])) {
    return visited[visited.length-1];
  }
}
function isRoot(syncedObject) {
  return (syncedObject.jsync.root === syncedObject.proxy);
}
function flat(value) {
  // Turns variable into its hash, or returns a primitive's value. Expects a syncedObject Proxy if it's an object
  const type = detailedType(value);
  const primitive = isPrimitive(type);

  if (primitive) {
    return value;
  } else if (type === 'function') {
    return undefined;
  } else {
    const syncedObject = value[jsynchronous.reserved_property];
    if (syncedObject === undefined) {
      throw `Jsynchronous sanity error - syncedObject is referencing a non-synced variable.`;
    }
    return syncedObject.hash;
  }
}
function labelEmpty(source, target) {
  // We need to specify which array elements are empty, and which are undefined. They both end up as 'null' in JSON.stringify();
  let allKeys;
  for (let i=0; i<source.length; i++) {
    const value = source[i];
    if (value === undefined) {
      allKeys = allKeys || Object.keys(source).map(k => Number(k));
      if (binarySearch(allKeys, i) === -1) { 
        target[i] = [TYPE_ENCODINGS['empty']];
      }
    }
  }
}

function encode(value, type) {
  // Expects value to be either be a primitive or a syncedObject Proxy
  const encoded = [TYPE_ENCODINGS[type]];

  if (isPrimitive(type)) {
    const p = encodePrimitive(value, type)
    if (p !== '') {
      encoded.push(p);
    }
  } else if (typeof value === 'string' && value.length === 8) {
    encoded.push(value);  // It's already a 8 string hash
  } else {
    encoded.push(encodeEnumerable(value));
  }
  return encoded;
}
function encodePrimitive(value, type) {
  if (type === 'empty')     return '';
  if (type === 'null')      return '';
  if (type === 'undefined') return '';
  if (type === 'string')    return value;
  if (type === 'number')    return value;
  if (type === 'boolean')   return !!value ? 1 : 0;
  if (type === 'bigint')    return String(value);
  if (type === 'function')  return undefined;
  throw `Jsynchronous sanity error - Primitive is unserializable ${type}, ${value}`;
}
function encodeEnumerable(value) {
  const syncedObject = value[jsynchronous.reserved_property];
  if (syncedObject === undefined) {
    throw `Jsynchronous sanity error - encoding object is referencing a non-synced variable ${value}`;
  }
  return syncedObject.hash;
}
