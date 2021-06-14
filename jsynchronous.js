'use strict';

const ACRONYMS = {
  'array': 'a',
  'boolean': 'b',
  'bigint': 'bi',
  'empty': 'e',
  'object': 'o',
  'number': 'n',
  'string': 's',
  'undefined': 'u',
  'null': null  // null is a valid JSON identifier
}

const syncedNames = {};


class Change {
  constructor(syncedObject, operation, prop, value, type, oldValue, oldType) {
    // A change exists in the space of two snapshots in time for objects that may not exist earlier or later.
    // It's important for garbage collection that a change does not directly reference any objects or arrays, only hashes.
    const jsync = syncedObject.jsync

    this.id = jsync.counter++;
    this.time = new Date().getTime();
    this.hash = syncedObject.hash;
    this.operation = operation;  // set, delete, pop, shift, unshift, etc.
    this.prop = prop;
    this.oldValue = oldValue;
    this.value = value;
    this.type = type;
    this.oldType = oldType;

    if (Array.isArray(syncedObject.proxy) && !isNaN(prop) && Number.isInteger(Number(prop))) {
      this.prop = Number(prop);  // Coerce prop to a number if it belongs to an array
    }

    jsync.communicate(this);
  }
  serialize() {
    const change = [
      this.id,
      this.operation.substring(0, 3),
      this.hash,
      this.prop,
      isPrimitive(this.type) ? serializePrimitive(this.value, this.type) : [this.value],
      isPrimitive(this.oldType) ? serializePrimitive(this.oldValue, this.oldType) : [this.oldValue]
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
  serialize() {
    const creation = [
      this.id,
      'new',
      this.description.h,
      this.description.t,
      this.description.e
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
  serialize() {
    const deletion = [
      this.id,
      'end',
      this.hash
    ]
    return deletion;
  }
}

class SyncedObject {
  constructor(jsync, original) {
    this.hash = noCollisionHash(jsync.objects);
    this.jsync = jsync;
    this.type = detailedType(original);
    this.reference = newCollection(this.type, original);
    this.parents = {};  // parents key->value corresponds to parentHash->[properties]
    this.proxy = undefined;

    jsync.objects[this.hash] = this;

    enumerate(original, (value, prop) => {
      const type = detailedType(value);
      const primitive = isPrimitive(type);

      if (primitive) { 
        this.reference[prop] = value;
      } else if (type === 'object' || type === 'array') {  // TODO: Support more enumerable types
        let syncedChild = value[jsynchronous.reserved_property];
        if (syncedChild === undefined) {
          syncedChild = new SyncedObject(jsync, value);
          this.reference[prop] = syncedChild.proxy;
          console.log(prop, this.reference);
          syncedChild.linkParent(this, prop);
        } else {
          this.reference[prop] = syncedChild.proxy;
          syncedChild.linkParent(this, prop);
        }
      }
    });

    this.proxy = new Proxy(this.reference, this.handler(this));

    new Creation(jsync, this);
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

        if (isRoot(syncedObject)) {
          if (syncedObject.jsync.reserved[prop]) {
            throw `Cannot reassign the jsynchronous reserved word ${prop}. If you need to use this property, you can reassign it by specifying {${prop}: 'reassigned-${prop}'} in the options when calling jsynchronous() on a newly synchronized variable.`;
          }
        }

        if (isPrimitive(type)) {
          obj[prop] = value;
        } else {
          if (referencesAnotherJsynchronousVariable(value, syncedObject.jsync)) {
            throw `Cannot reference a jsynchronous variable that's already being tracked by another synchronized variable.`;
          }

          let syncedValue = value[jsynchronous.reserved_property];
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
        new Change(syncedObject, operation, prop, flat(obj[prop]), type, flat(oldValue), oldType);

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
        if (!isPrimitive(type)) {
          let syncedObject = value[jsynchronous.reserved_property];
          // TODO: comment these throws out. They aren't errors, they're sanity checks
          if (syncedObject === undefined) {
            throw `Jsynchronous sanity error - previously referenced variable was not being tracked.`
          }

          syncedObject.unlinkParent(obj[jsynchronous.reserved_property], prop);
        }

        const operation = 'delete';
        const change = new Change(syncedObject, operation, prop, flat(value), type);

        delete obj[prop];
        return true  // Indicate Success
      }
    }
  }
  linkParent(syncedParent, prop) {
    const parentHash = syncedParent.hash;

    if (this.parents[parentHash] === undefined) {
      this.parents[parentHash] = [prop];
    } else {
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
    const state = {
      h: this.hash,
      t: ACRONYMS[this.type],
      e: newCollection(this.type, this.proxy)
    }

    enumerate(this.proxy, (value, prop) => {
      state.e[prop] = serialize(value);
    });

    if (this.type === 'array') {
      labelEmpty(this.proxy, state.e);  // We need to specify which array elements are empty, and which are undefined. They both end up as 'null' in JSON.stringify();
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

    this.name = options.name || noCollisionHash(syncedNames);
    this.startTime = new Date().getTime();
    this.objects = {};
    this.listeners = options.listeners || [];
    this.counter = 0;  // counter is always 1 more than the latest change's id.
    this.send = options.send || jsynchronous.send;
    this.wait = options.wait || false;
    this.buffer_time = options.buffer_time || 0;
    this.history = [];

    // You can reference jsynchronized variables from other places in your app. Be careful however, when assigning object and arrays to synchronized variables. The ALL of the contents will become visible to the connected clients.

    // These variables are special method names on the root of a jsynchronized variable. They will throw an error if you reassign these methods, so you can rename these methods by passing them into the options.
    this.jsyncReservedWord = options.jsync || '$sync';
    this.resyncReservedWord = options.resync || '$resync';
    this.unsyncReservedWord = options.unsync || '$unsync';
    this.startsyncReservedWord = options.startsync || '$startsync';
    this.listenersReservedWord = options.listeners || '$listeners';

    // Cerce this. to refer to this jsynchronous instance
    this.reserved = {}
    this.reserved[this.jsyncReservedWord]     = ((a) => this.j_sync(a));
    this.reserved[this.resyncReservedWord]    = ((a) => this.re_sync(a));
    this.reserved[this.unsyncReservedWord]    = ((a) => this.un_sync(a));
    this.reserved[this.startsyncReservedWord] = ((a) => this.start_sync(a));
    this.reserved[this.listenersReservedWord] = (() => this.listeners);

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

    if (this.wait === false && this.send === undefined) {
      throw `jsynchronize requires you to define a jsynchronous.send = (websocket, data) => {} function which will be called by jsynchronous every time data needs to be transmitied to connected clients. Use syncedVariable.jsync(websocket) to add a websocket to connected clients.`;
    }

    if (syncedNames[this.name]) {
      throw `Jsynchronous name ${this.name} is already in use!`;
    }
    syncedNames[this.name] = this;

    this.root = new SyncedObject(this, initial).proxy;
  }
  communicate(change) {
    if (this.wait === false) {
      this.history.push(change);
      this.queuedCommunications.push(change.serialize());

      if (this.bufferTimeout === undefined) {
        this.bufferTimeout = setTimeout(() => this.sendPackets(), this.buffer_time);
      }
    }
  }
  sendPackets() {
    this.bufferTimeout = undefined;

    console.log('Payload length ', JSON.stringify(this.queuedCommunications).length);

    this.listeners.forEach((listener) => {
      this.send(listener, JSON.stringify(this.queuedCommunications));
    });
    this.queuedCommunications.length = 0;
  }
  start_sync(jsync) {
    return (websocket) => {
      // If the constructor option {wait: true} was passed, starts sending packets to connected clients. 
      if (this.send === undefined) {
        throw `jsynchronize requires you to define a jsynchronous.send = (websocket, data) => {} function which will be called by jsynchronous every time data needs to be transmitied to connected clients. Use syncedVariable.jsync(websocket) to add a websocket to connected clients.`;
      }

      this.sendPackets();
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

      this.send(websocket, JSON.stringify(this.describe()));
    }
  }
  un_sync() {
    const index = this.listeners.indexOf(websocket);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    } else {
      // TODO: Change this to a warn?
      throw 'jsynchronous Error in .unsync(websocket), no websocket registered that matches ' + websocket;
    }
  }
  re_sync() {
  }
  describe() {
    if (this.cachedDescription && this.cachedDescription.c === this.counter) {
      return this.cachedDescription
    }

    const fullState = {
      name: this.name,
      c: this.counter
    }

    const variables = recurse(this.root, true);

    fullState.e = variables.map((v) => {
      const syncedObject = v[jsynchronous.reserved_property];
      if (syncedObject === undefined) {
         throw `Jsynchronous sanity error - describe encountered a variable that was not being tracked.`;
      }
      return syncedObject.describe();
    });

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
      detailed === 'undefined') {
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
  // Expects value to be either be a primitive or a syncedObject Proxy. Returns either the value if it's a primitive, or the variable's hash. 
  const type = detailedType(value);
  const primitive = isPrimitive(type);

  if (primitive) {
    return value;
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
      if (binarySearch(allKeys, i) >= 0) { 
        target[i] = ACRONYMS['undefined'];
      } else {
        target[i] = ACRONYMS['empty'];
      }
    }
  }
}
function serialize(value) {
  // Expects value to be either be a primitive or a syncedObject Proxy
  const type = detailedType(value);

  if (isPrimitive(type)) {
    return serializePrimitive(value, type);
  } else {
    return serializeEnumerable(value);
  }
}
function serializePrimitive(value, type) {
  const serialized = {t: ACRONYMS[type]}
  if (type === 'string' || type === 'number') serialized.v = value;
  if (type === 'boolean') serialized.v = !!value ? 1 : 0;
  if (type === 'bigint')  serialized.v = String(value) + 'n';
  return serialized;
}
function serializeEnumerable(value) {
  const syncedObject = value[jsynchronous.reserved_property];

  if (syncedObject === undefined) {
    throw `Jsynchronous sanity error - synced object is referencing a non-synced variable.`;
  }

  return [syncedObject.hash];  // Via convention any syncedObject reference is wrapped in an array to indicate it's not a primitive.
}
