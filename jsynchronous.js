'use strict';

const ACRONYMS = {
  'boolean': 'b',
  'string': 's',
  'number': 'n',
  'bigint': 'b',
  'null': 'n',
  'undefined': 'u',
  'empty': 'e',
  'object': 'o',
  'array': 'a'
}

const syncedNames = {};


class Change {
  constructor(jsync, objectHash, operation, prop, oldValue, oldType, value, type) {
    // A change exists in the space of two snapshots in time for objects that may not exist earlier or later.
    // It's important for garbage collection that a change does not directly reference any objects or arrays, only hashes.
    this.id = jsync.changeCounter++;
    this.time = new Date().getTime();
    this.jsync = jsync;
    this.objectHash = objectHash;
    this.operation = operation;  // set, delete, pop, shift, unshift, etc.
    this.prop = prop;
    this.oldValue = oldValue;
    this.value = value;
    this.type = type;
    this.oldType = oldType;
  }
  serialize() {
  }
}

class Creation {
  constructor(jsync, ) {
  }
}

class Deletion {
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
          return true  // Indicate Success
        }

        if (referencesAnotherJsynchronousVariable(value, syncedObject.jsync)) {
          throw `Cannot reference a jsynchronous variable that's already being tracked by another synchronized variable.`;
        }

        let syncedValue = value[jsynchronous.reserved_property];
        if (syncedValue === undefined) {
          syncedValue = new SyncedObject(syncedObject.jsync, value);
          obj[prop] = syncedValue.proxy;
          syncedValue.linkParent(this, prop);
        } else {
          obj[prop] = syncedValue.proxy;
          syncedValue.linkParent(this, prop);
        }
        
        if (!isPrimitive(oldType)) {
          let syncedOld = oldValue[jsynchronous.reserved_property];
          // TODO: comment these throws out. They aren't errors, they're sanity checks
          if (syncedOld === undefined) {
            throw `Jsynchronous sanity error - previously referenced variable was not being tracked.`
          }

          syncedOld.unlinkParent(syncedObject, prop);
        }

        // TODO: communicate these changes to client
        //syncedObject.jsync.communicate({set: prop, value});

        return true

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

        // TODO: communicate these changes to client
        //syncedObject.jsync.communicate({set: prop, value});

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
        delete this.jsync.objects[this.hash];
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
      const type = detailedType(value);
      const primitive = isPrimitive(type);

      if (primitive) {
        state.e[prop] = {t: ACRONYMS[type]}

        if (type === 'string' || type === 'number') state.e[prop].v = value;
        if (type === 'boolean') state.e[prop].v = !!value ? 1 : 0;
        if (type === 'bigint')  state.e[prop].v = String(value) + 'n';
      } else {
        const syncedObject = value[jsynchronous.reserved_property];

        if (syncedObject === undefined) {
          throw `Jsynchronous sanity error - synced object is referencing a non-synced variable.`;
        }

        state.e[prop] = [syncedObject.hash];  // Via convention any syncedObject reference is wrapped in an array to indicate it's not a primitive.
      }
    });

    if (this.type === 'array') {
      // We need to specify which array elements are empty, and which are undefined. They both end up as 'null' in JSON.stringify();
      let allKeys;
      for (let i=0; i<this.proxy.length; i++) {
        const value = this.proxy[i];
        if (value === undefined) {
          allKeys = allKeys || Object.keys(this.proxy).map(k => Number(k));
          if (binarySearch(allKeys, i) >= 0) { 
            state.e[i] = ACRONYMS['undefined'];
          } else {
            state.e[i] = ACRONYMS['empty'];
          }
        }
      }
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
    this.changeCounter = 0;  // changeCounter is always 1 more than the latest change's id.
    this.send = options.send || jsynchronous.send;
    this.wait = options.wait || false;
    this.buffer_time = options.buffer_time || 0;

    // You can reference jsynchronized variables from other places in your app. Be careful however, when assigning object and arrays to synchronized variables. The ALL of the contents will become visible to the connected clients.

    // These variables are special method names on the root of a jsynchronized variable. They will throw an error if you reassign these methods, so you can rename these methods by passing them into the options.
    this.jsyncReservedWord = options.jsync || 'jsync';
    this.resyncReservedWord = options.resync || 'resync';
    this.unsyncReservedWord = options.unsync || 'unsync';
    this.startsyncReservedWord = options.startsync || 'startsync';

    // Cerce this. to refer to this jsynchronous instance
    this.jsync = ((a) => this.j_sync(a));
    this.resync = ((a) => this.re_sync(a));
    this.unsync = ((a) => this.un_sync(a));
    this.startsync = ((a) => this.start_sync(a));

    this.reserved = {}
    this.reserved[this.jsyncReservedWord] = this.jsync;
    this.reserved[this.resyncReservedWord] = this.resync;
    this.reserved[this.unsyncReservedWord] = this.unsync;
    this.reserved[this.startsyncReservedWord] = this.startsync; 

    this.bufferTimeout = undefined;
    this.queuedCommunications = [];
    this.root = undefined;

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
    this.queuedCommunications.push(change);

    if (this.wait === false && this.bufferTimeout === undefined) {

      this.bufferTimeout = setTimeout(() => this.sendPackets(), this.buffer_time);
    }
  }
  sendPackets() {
    this.bufferTimeout = undefined;
    this.send(this.listeners[0], this.queuedCommunications.map((a) => JSON.stringify(a)));
    //const payload = this.queuedCommunications.map((change) => c.serialize());
    //if (payload.length > 0) {
    //}
  }
  start_sync(jsync) {
    return (websocket) => {
      // If the constructor option {wait: true} was passed, starts sending packets to connected clients. 
      if (this.send === undefined) {
        throw `jsynchronize requires you to define a jsynchronous.send = (websocket, data) => {} function which will be called by jsynchronous every time data needs to be transmitied to connected clients. Use syncedVariable.jsync(websocket) to add a websocket to connected clients.`;
      }

      this.wait = false;
      this.sendPackets();
    }
  }
  j_sync(websocket) {
    // Adds the websocket client to a list of websockets to call send(websocket, data) to
    const index = this.listeners.indexOf(websocket);
    if (index === -1) {
      this.listeners.push(websocket);
    } else {
      throw 'jsynchronous Error in .jsync(websocket), websocket is already being listened on: ' + websocket;
    }
  }
  un_sync() {
    const index = this.listeners.indexOf(websocket);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    } else {
      throw 'jsynchronous Error in .unsync(websocket), no websocket registered that matches ' + websocket;
    }
  }
  re_sync() {
  }
  describe() {
    const fullState = {
      name: this.name,
      c: this.changeCounter
    }

    const variables = recurse(this.root, true);

    fullState.nodes = variables.map((v) => {
      const syncedObject = v[jsynchronous.reserved_property];
      if (syncedObject === undefined) {
         throw `Jsynchronous sanity error - describe encountered a variable that was not being tracked.`;
      }
      return syncedObject.describe();
    });

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
