const WebSocket = require('ws');
const jsynchronous = require('../../jsynchronous.js');
const jsynclient = require('../../jsynchronous-client.js');
const util = require('util');

// Test set up
jsynchronous.send = (websocket, data) => {
  websocket.send(data);
}

const $erved = jsynchronous({});
const $relay = jsynclient(null, 'object');

// Jsync server setup
const wss = new WebSocket.Server({ port: 8080 });

let communication = 0;

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {});
  $erved.$ync(ws);

  console.log('Server->relay communcation established');
  communication += 1;
  if (communication >= 2) {
    startTest();
  }
});

// Jsync relay client setup
async function connectRelay(backoff) {
  const ws = new WebSocket('ws://localhost:8081');
  ws.on('open', function open() {
    console.log('relay->Server communication established');

    communication += 1;
    if (communication >= 2) {
      startTest();
    }
  });
  
  ws.on('message', function incoming(data) {
    jsynclient.onmessage(data);
  });
  ws.on('error', async function error(a, b, c) {
    backoff = backoff || 1000;
    await wait(backoff);
    await connectRelay(backoff * 1.2);
  });
}
connectRelay();

$relay.$on('changes', () => {
  
});


// Start the test
async function startTest() {
  await wait(1000);
  await test0();
  

  await test('Assignment of property on root');


  await test('Reassignment of property on root');


  $erved.bball = {jordan: 'space jam'};
  await test('Assignment of a object');


  $erved.bball['bugs bunny'] = "What's up doc?";
  await test('Assignment of property on object with whitespaces in key');


  $erved.bball['¢åπ'] = "unicode";
  await test('Assignment of a key with unicode characters');


  $erved.bball['emojis'] = "🔫😍🙈❄↕⚡⚠⚽🌍🐓";
  await test('Assignment of unicode characters as values');


  $erved.bball['∞§π'] = "§ß∫ºπΩø™£∆å´∑£¢∞¡§¶ç√˜µ≤≥…";
  await test('Assignment of a key and values with unicode characters');


  $erved.bball['🐊'] = "Crock";
  await test('Assignment of key to a unicode character');


  $erved.bball['🐊'] = "Aligator?";
  await test('Reassignment of unicode character key');

  
  $erved.bball = {};
  await test('Reassignment of an object');


  $erved.bball['emojis'] = "🔫😍🙈❄↕⚡⚠⚽🌍🐓";
  await test('Assignment of a property on new object');


  $erved.bball['emojis'] += "🔫😍🙈❄↕⚡⚠⚽🌍🐓";
  await test('Extending a unicode string');


  $erved.bball['numbers'] = 0;
  await test('Assignment of an integer');


  $erved.bball['numbers'] = 0.12345678790;
  await test('Assignment of a floating point number');


  $erved.bball['numbers'] = 5.67;
  await test('Assignment of a floating point number with fixed precision');


  $erved.bball['numbers'] = 1.1;
  $erved.bball['numbers'] = 2.2;
  $erved.bball['numbers'] = 3.3;
  $erved.bball['numbers'] = 4.4;
  $erved.bball['numbers'] = 5.5;
  await test('Assignment of numbers in quick succession');


  delete $erved.bball
  await test('Deletion of object on root object');


  console.log('All tests passed!');
}


let levelCounter = 0;
async function test(text, left, right) {
  levelCounter++;
  $erved.test = levelCounter;

  console.log(`Test ${levelCounter} - ${text}`);

  if (left === undefined) {
    left = $erved;
  }

  if (right === undefined) {
    right = $relay;
  }

  return await matchOrThrow(left, right);
}




//  $erved.numbers = [1.1, '2', 'three', 4, 5, 6]
//  await test('Assignment of an array');
//
//  await test('Pushing a floating point number onto array');
//
//  await test('Assignment of a nested array');
//
//  await test('Deleting a property');
//
//  await test('Deletion of multiple properties');
//
//  $erved.numbers.push(0.1234567890123456789);
//  return await matchOrThrow($erved, $relay);

//async function test6() {
//  console.log('Test 6 - Assignment of a nested array');
//  $erved.nested = [[0]];
//  return await matchOrThrow($erved, $relay);
//}
//
//async function test7() {
//  console.log('Test 7 - Deleting a property');
//  delete $erved['numbers']
//  return await matchOrThrow($erved, $relay);
//}
//
//async function test8() {
//  console.log('Test 8 - Deletion of multiple properties');
//  delete $erved['nested'];
//  delete $erved['bball'];
//
//  console.log('All tests passed!');
//}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------
async function test0() {
  console.log('Test 0 - Testing deepComparison function on known values');

  // Matching tests
  if (!deepComparison({a: 'a'}, {a: 'a'}))     throw `Test 0 failed - Deep comparison failed check 0`;
  if (!deepComparison([], []))                 throw `Test 0 failed - Deep comparison failed check 1`;
  if (!deepComparison([[]], [[]]))             throw `Test 0 failed - Deep comparison failed check 2`;
  if (!deepComparison([{a: 'a'}], [{a: 'a'}])) throw `Test 0 failed - Deep comparison failed check 3`;

  const circular1 = [];
  const circular2 = [];
  circular1[0] = circular1;
  circular2[0] = circular2;
  if (!deepComparison(circular1, circular2)) throw `Test 0 failed - Deep comparison failed check 4`;

  const circular3 = {a: {b: {c: undefined}}}
  const circular4 = {a: {b: {c: undefined}}}
  circular3.a.b.c = circular3;
  circular4.a.b.c = circular4;
  if (!deepComparison(circular3, circular4)) throw `Test 0 failed - Deep comparison failed check 5`;


  // Not matching tests
  if (deepComparison({a: 'b'}, {a: 'c'}))    throw `Test 0 failed - Deep comparison failed check 6`
  if (deepComparison({a: {b: {c: 'z'}}}, {a: {b: {c: 'y'}}})) throw `Test 0 failed - Deep comparison failed check 7`
  if (deepComparison([0, 1, 2, 3], [0, 1, 2])) throw `Test 0 failed - Deep comparison failed check 8`
  if (deepComparison([0, 1, 2, 3], [0, 1, 2, '3'])) throw `Test 0 failed - Deep comparison failed check 9`
  if (deepComparison([[[]]], [[[0]]]))       throw `Test 0 failed - Deep comparison failed check 10`

  const circular5 = {x: {y: {z: undefined}}}
  const noncircular = {x: {y: {z: undefined}}}
  circular5.x.y.z = circular5.x;
  if (deepComparison(circular5, noncircular))       throw `Test 0 failed - Deep comparison failed check 10`

  return true;
}


// ----------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------
function wait(t) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, t)
  });
}

async function matchOrThrow(left, right, testNumber) {
  let results =  await match($erved, $relay);
  if (results === false) {
    console.log(util.inspect(left, {depth: 1, colors: true}));
    console.log('----------------------------------------------------------------');
    console.log(util.inspect(right, {depth: 1, colors: true}));
    throw `Failed to find a match`;
  } else {
    return true;
  }
}

async function match(left, right, counter) {
  if (deepComparison(left, right)) {
    return true;
  } else if (counter > 100) {
    return false;
  } else {
    await wait(80);
    return await match(left, right, counter === undefined ? 1: counter+1);
  }
}

function deepComparison(left, right, visited) {
  if (visited === undefined) visited = new Map();

  if (visited.has(left)) {
    if (visited.get(left) !== right) {
      return false;
    } else {
      return true;
    }
  }

  visited.set(left, right);

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  leftKeys.sort();
  rightKeys.sort();

  for (let i=0; i<leftKeys.length; i++) {
    if (leftKeys[i] !== rightKeys[i]) {
      return false;
    }
  }

  for (let key in left) {
    const l = left[key];
    const r = right[key];

    if (typeof l !== typeof r) {
      return false;
    }

    if (typeof l !== 'object' && typeof l !== 'function') {
      if (l !== r) {
        return false;
      }
    } else if (typeof l === 'object') {
      if (deepComparison(l, r, visited) === false) {
        return false;
      }
    }
  }

  return true;
}
