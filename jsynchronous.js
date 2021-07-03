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
  'end': 5,
  'snapshot': 6,
  'handshake': 7,
  'resync': 8,
  'error': 9
}

const clientReservedWords = {
  '$info': true,
  '$on': true,
  '$rewind': true,
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

class Snapshot {
  constructor(jsync, name) {
    this.id = jsync.counter++;
    this.operation = 'snapshot';
    this.name = name;

    if (jsync.snapshots[name]) {
      throw `Jsynchronous snapshot by the name ${name} already exists!`;
    }

    jsync.snapshots[name] = this;

    jsync.communicate(this);
  } 
  encode() {
    const snapshot = [
       OP_ENCODINGS[this.operation],
       this.id,
       this.name
    ]
    return snapshot;
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
  constructor(initial, name, options) {
    initial = initial || {}
    options = options || {}

    this.name = name || '';
    this.startTime = 'Not yet started';
    this.objects = {};
    this.listeners = new Map();
    this.counter = 0;   // counter is always 1 more than the latest change's id.
    this.send = (websocket, data) => { (options.send || jsynchronous.send)(websocket, data) };
    this.buffer_time = options.buffer_time || 0;
    this.rewind = options.rewind || false;
    this.one_way = options.one_way;
    this.client_history = options.client_history || 0;
    this.history_limit = options.history_limit || 100000;
    this.wait = true;  // Ignore Proxy setters during inital setup
    this.started = false;
    this.history = [];
    this.snapshots = {};
    this.rewindInitial = undefined;

    // These variables are special method names on the root of a synchronized variable. They will throw an error if you reassign these methods, so you can rename these methods by passing them into the options.
    this.defaults = {
      $ync:       options.$ync       || '$ync',
      $unsync:    options.$unsync    || '$unsync',
      $on:        options.$on        || '$on',
      $tart:      options.$tart      || '$tart',
      $listeners: options.$listeners || '$listeners',
      $info:      options.$info      || '$info',
      $napshot:   options.$napshot   || '$napshot',
      $rewind:    options.$rewind    || '$rewind'
    }

    // Coerce this to refer to this jsynchronous instance
    this.reserved = {}
    this.reserved[this.defaults['$ync']]       = ((a) => this.sync(a));
    this.reserved[this.defaults['$unsync']]    = ((a) => this.un_sync(a));
    this.reserved[this.defaults['$on']]        = ((a) => this.on(a));
    this.reserved[this.defaults['$tart']]      = ((a) => this.start_sync(a));
    this.reserved[this.defaults['$listeners']] = (() => [ ...this.listeners.keys() ]);
    this.reserved[this.defaults['$info']]      = (() => this.info());
    this.reserved[this.defaults['$napshot']]   = ((a) => this.snapshot(a));
    this.reserved[this.defaults['$rewind']]    = ((a) => this.snapshot(a));

    this.bufferTimeout = undefined;
    this.queuedCommunications = [];
    this.root = undefined;

    this.cachedDescription = undefined;

    if (!enumerable(initial)) {
      throw `Cannot synchronize variables of type ${detailedType(initial)}. Try placing it in an object, or an array and then calling jsynchronous().`;
    }

    if (initial[jsynchronous.reserved_property]) {
      throw `Cannot synchronize an already synchronized variable`;
    }

    if (alreadySynchronized(initial)) {
      throw `Cannot synchronize a variable that references an already synchronized variable`;
    }

    if (this.name.length > 127) {
      throw `Jsynchronous name is too long. Shorter names are better for efficient networking`;
    }
    if (syncedNames[this.name]) {
      throw `Jsynchronous name '${this.name}' is already in use!`;
    }
    syncedNames[this.name] = this;

    // Synchronize the variable
    this.root = new SyncedObject(this, initial);

    this.wait = options.wait || false;
    if (this.wait === false) {
      this.start_sync();
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
      one_way: this.one_way,
      client_history: this.client_history,
      snapshots: Object.values(this.snapshots).sort((a, b) => a.counter - b.counter),
      history_limit: this.history_limit,
      history_length: this.history.length,
      reserved_words: Object.keys(this.reserved),
      listeners: [ ...this.listeners.keys() ]
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

    for (let [websocket, listener] of this.listeners) {
      this.send(websocket, JSON.stringify([OP_ENCODINGS['changes'], this.name, min, max, changes]));
    }

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
    if (this.send === undefined && this.listeners.size > 0) {
      throw `Jsynchronous requires you to define a jsynchronous.send = (websocket, data) => {} function which will be called by jsynchronous every time data needs to be transmittied to connected clients.\nUse syncedVariable.$ync(websocket) to add a websocket to connected clients.\nYou can also pass in as an option {send: () => {}} to jsynchronous()`;
    }

    if (this.started === true) {
      throw `Jsynchronous variable ${this.name} already started`
    }

    if (this.started !== true) {
      this.started = true;
      this.wait = false;
      this.start = new Date().getTime();

      for (let [websocket, listener] of this.listeners) {
        this.sendInitial(websocket);
      }

      if (this.rewind === true) {
        this.rewindInitial = this.describe();
      }
    }
  }
  sync(websocket) {
    if (this.send === undefined) {
      throw `Jsynchronous requires you to define a jsynchronous.send = (websocket, data) => {} function which will be called by jsynchronous every time data needs to be transmittied to connected clients.\nYou can also pass in as an option {send: () => {}} to jsynchronous()`;
    }

    if (websocket === undefined) {
      throw "$ync(websocket) requires websocket to be defined as a unique identifier for a client. Either an object, a string, or number.";
    }

    if (Array.isArray(websocket)) {
      websocket.forEach(ws => this.sync(ws));
    } else {
      // Adds the websocket client to a list of websockets to call send(websocket, data) to
      if (!this.listeners.has(websocket)) {
        this.listeners.set(websocket, {secret: null, penalty: 0, lastMessage: 0});
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
    if (this.listeners.has(websocket)) {
      this.listeners.delete(websocket);
    } else {
      // TODO: Change this to a warn?
      throw 'jsynchronous Error in .unsync(websocket), no websocket registered that matches ' + websocket;
    }
  }
  snapshot(name) {
    new Snapshot(this, name);
  }
  on() {
    // TODO: Implement sever side events
    throw 'Server side .$on() events not yet implemented! Stay tuned for this feature in future versions';
  }
  rewind() {
    // TODO: Implement sever side rewind
    throw 'Server side .$rewind() not yet implemented! Stay tuned for this feature in future versions';
  }
  on_message(op, websocket, listener, json) {
    try {
      if (op === 'handshake') {
        let rootHash = json[2];
        this.handshake(websocket, listener, rootHash);
      } else if (op === 'resync') {
        this.resync(websocket, listener, json);
      }
    } catch (e) {
      listener.penalty += 5;  // Penalize clients heavily if they trigger errors
      console.error("Jsynchronous client->server onmessage error", e);
      jsynchronous.send(websocket, JSON.stringify([OP_ENCODINGS['error'], e.toString()]));
    }
  }
  handshake(websocket, listener, rootHash) {
    if (rootHash !== this.root.hash) {
      throw `Client has incorrect data to synchronized variable '${this.name}'. Got ${rootHash} expected ${this.root.hash}`;
    }

    let secret = listener.secret || randomHash();  // no need to worry about collisions. Secrets aren't shared.
    listener.secret = secret;
    this.send(websocket, JSON.stringify([OP_ENCODINGS['handshake'], this.name, secret]));
  }
  resync(websocket, listener, json) {
    let secret = json[2];
    let min = json[3];
    let max = json[4];
    if (listener.secret === secret) {
      let historyMin = binarySearch(this.history, (h) => h.id - min);
      let historyMax = historyMin + (max-min);
      if (historyMin === -1 || historyMax >= this.history.length) {
        // TODO: Hard reset on client
        let payload = [OP_ENCODINGS['error'], 'Unable to resync'];
        jsynchronous.send(websocket, JSON.stringify(payload));
      } else {
        let slice = this.history.slice(historyMin, historyMax);
        let encoded = slice.map((h) => h.encode());
        let payload = [OP_ENCODINGS['changes'], this.name, min, max-1, encoded];
        this.send(websocket, JSON.stringify(payload));
      }
    } else {
      // TODO: Tear this out, we don't need to be polite to clients that fail the secret check
      let payload = [OP_ENCODINGS['error'], 'Secret check failed'];
      jsynchronous.send(websocket, JSON.stringify(payload));
    }
  }
  describe() {
    if (this.cachedDescription && this.cachedDescription[2] === this.counter) {
      return this.cachedDescription
    }

    const settings = {}

    if (this.one_way) settings.one_way = true;
    if (this.rewind) settings.rewind = true;
    if (this.client_history) settings.client_history = true;

    for (let key in this.defaults) {
      if (this.defaults[key] !== key && clientReservedWords[key]) {
        if (settings.reserved === undefined) settings.reserved = {}
        settings.reserved[key] = this.defaults[key];
      }
    }

    const fullState = [
      OP_ENCODINGS['initial'],
      this.name,
      this.counter,
      settings
    ]

    const variables = recurse(this.root.proxy, true);

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
function jsynchronous(initial, name, options) {
  let jsync = new JSynchronous(initial, name, options);
  return jsync.root.proxy;
}

jsynchronous.reserved_property = '__jsynchronous__'; 

// ----------------------------------------------------------------
// Client->Server communication
// ----------------------------------------------------------------
jsynchronous.onmessage = (websocket, data) => {
  if (data === undefined) {
    throw "Jsynchronous onmessage - Server side jsynchronous.onmessage has two arguments: (websocket, data)";
  }

  if (data.length > 256) {  // Magic number? Whats the max message size we can assume a DDOS?
    return;
  }

  let json;
  try {
    json = JSON.parse(data);
  } catch (e) {
    console.error("Jsynchronous client->server JSON parse error", e);
    return;
  }

  if (json) {
    let op = getOp(json[0]);
    let name = json[1];
    let jsync = syncedNames[name];

    if (!op) {
      console.error(`Jsynchronous client->server message contains an unrecognized op: ${op}`);
      return;
    }
    if (!jsync) {
      console.error(`Jsynchronous client->server message references non-existent variable name ${name}`);
      return;
    }
    if (!jsync.listeners.has(websocket)) {
      console.error(`Jsynchronous client is attempting ${op} isn't registered with $ync() on the variable '${name};`);
      return;
    }

    // Denial of Service Protection. Limit to 10 messages at a time, decaying by 1 per second
    let listener = jsync.listeners.get(websocket);
    listener.penalty = 1 + Math.max(0, listener.penalty - Math.floor((new Date() - listener.lastMessage) / 1000));
    listener.lastMessage = new Date();

    if (listener.penalty > 10) {
      listener.penalty += 2;
      if (jsync.dos === undefined || new Date() - jsync.dos > 60000) {
        jsync.dos = new Date();
        setTimeout(() => {
          console.error(`Jsynchronous Denial of Service detected, dropping client requests. Penalty: ${listener.penalty} seconds`);
        }, 1000);
      }
      return;
    }

    jsync.on_message(op, websocket, listener, json);
  } else {
    console.error(`Jsynchronous client->server onmessage got a malformed piece of json`);
  }
}

if (typeof module === 'object') {
  module.exports = jsynchronous;
}

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
function binarySearch(sortedArray, compareFunc){
  let start = 0;
  let end = sortedArray.length - 1;
  while (start <= end) {
    let middle = Math.floor((start + end) / 2);
    if (compareFunc(sortedArray[middle]) === 0) {
      return middle;
    } else if (compareFunc(sortedArray[middle]) < 0) {
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
  return (syncedObject.jsync.root === syncedObject);
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
      if (binarySearch(allKeys, ((a) => a - i)) === -1) { 
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
function getOp(number) {
  for (const [key, value] of Object.entries(OP_ENCODINGS)) {
    if (value === number) return key;
  }
  return false;
}
