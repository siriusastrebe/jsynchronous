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


// ----------------------------------------------------------------
// Start the test
// ----------------------------------------------------------------
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


  $erved.bball['emojis'] = "🔫😍🙈❄↕⚡⚠⚽🌍🐓🐬";
  await test('Assignment of unicode characters as values');


  $erved.bball['∞§π'] = "§ß∫ºπΩø™£∆å´∑£¢∞¡§¶ç√˜µ≤≥…";
  await test('Assignment of a key and values with unicode characters');


  $erved.bball['🐊'] = "Crock";
  await test('Assignment of key to a unicode character');


  $erved.bball['🐊'] = "Aligator?";
  await test('Reassignment of unicode character key');

  
  $erved.bball = {};
  await test('Reassignment of an object');


  $erved.bball['emojis'] = "🔫😍🙈❄↕⚡⚠⚽🌍🐓🐬";
  await test('Assignment of a property on new object');


  $erved.bball['emojis'] += "🔫😍🙈❄↕⚡⚠⚽🌍🐓🐬";
  await test('Extending a unicode string');


  $erved.bball['genesis'] = largeText();
  await test('Assignment of a large piece of text');

  $erved.bball['genesis'] += largeText2()
  await test('Extending a large piece of text');


  delete $erved.bball['genesis']
  await test('Deletion of large text');


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


  const externalReference = $erved.bball['numbers'];
  $erved.bball.numbersExternalReference = externalReference;
  await test('Assignment of an external object referencing an existing synchronized variable');


  delete $erved.bball
  await test('Deletion of object');


  $erved.arr = [];
  await test('Assignment of empty array');


  $erved.arr = [0];
  await test('Ressignment of array, with a value this time');


  $erved.arr = [[]];
  await test('Reassignment of a nested array');


  $erved.arr = [[[]]];
  await test('Reassignment of a doubly nested array');


  $erved.arr = [[[[]]]];
  await test('Reassignment of a triply nested array');


  $erved.arr = [[[[[]]]]];
  await test('Reassignment of a quadruply nested array');


  $erved.arr = [[]];
  await test('Reassignment of a nested array');


  $erved.arr[0].push('zero')
  await test('Assignment into a nested array');


  $erved.arr[0].push('one')
  $erved.arr[0].push('two')
  await test('Multiple assignments into a nested array');


  $erved.arr.push('zero')
  $erved.arr[0].push('three')
  await test('Multiple assignments into different levels of a nested array');


  $erved.arr.push([[[5, 4, 3, 2, 1, 0, [['liftoff']], ]]])
  await test('Assignment of a deeply nested array with values');


  $erved.arr.push({a: {b: {c: {d: 'now I know my ABCs'}}}});
  await test('Assignment of a deeply nested object with string values');


  $erved.arr.push({aa: {ba: {ca: [], cb: [[]], cc: 'CC'}, bb: 'basketball'}, ab: 'Abba', ac: 'Dabba', ad: 'Anno Domino'});
  await test('Assignment of a complex nested object with mixed values');


  delete $erved.arr[4];
  await test('Deletion of array entry');


  delete $erved.arr[3];
  delete $erved.arr[2];
  await test('Multiple deletions of array entries');

  $erved.arr.length = 0;
  await test('Setting array length to a value smaller than the current length');


  $erved.arr[10] = 10;
  await test('Assigning an array property greater than the length of the array');



  console.log('All tests passed!');
}


// ----------------------------------------------------------------
// Test Helper functions
// ----------------------------------------------------------------
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

function largeText() {
  return `All the world’s a stage,
And all the men and women merely players;
They have their exits and their entrances;
And one man in his time plays many parts,
His acts being seven ages. At first the infant,
Mewling and puking in the nurse’s arms;
And then the whining school-boy, with his satchel
And shining morning face, creeping like snail
Unwillingly to school. And then the lover,
Sighing like furnace, with a woeful ballad
Made to his mistress’ eyebrow. Then a soldier,
Full of strange oaths, and bearded like the pard,
Jealous in honour, sudden and quick in quarrel,
Seeking the bubble reputation
Even in the cannon’s mouth. And then the justice,
In fair round belly with good capon lin’d,
With eyes severe and beard of formal cut,
Full of wise saws and modern instances;
And so he plays his part. The sixth age shifts
Into the lean and slipper’d pantaloon,
With spectacles on nose and pouch on side;
His youthful hose, well sav’d, a world too wide
For his shrunk shank; and his big manly voice,
Turning again toward childish treble, pipes
And whistles in his sound. Last scene of all,
That ends this strange eventful history,
Is second childishness and mere oblivion;
Sans teeth, sans eyes, sans taste, sans everything
`
}
function largeText2() {
  return `Friends, Romans, countrymen, lend me your ears;
I come to bury Caesar, not to praise him.
The evil that men do lives after them;
The good is oft interred with their bones;
So let it be with Caesar. The noble Brutus
Hath told you Caesar was ambitious:
If it were so, it was a grievous fault,
And grievously hath Caesar answer’d it.
Here, under leave of Brutus and the rest–
For Brutus is an honourable man;
So are they all, all honourable men–
Come I to speak in Caesar’s funeral.
He was my friend, faithful and just to me:
But Brutus says he was ambitious;
And Brutus is an honourable man.
He hath brought many captives home to Rome
Whose ransoms did the general coffers fill:
Did this in Caesar seem ambitious?
When that the poor have cried, Caesar hath wept:
Ambition should be made of sterner stuff:
Yet Brutus says he was ambitious;
And Brutus is an honourable man.
You all did see that on the Lupercal
I thrice presented him a kingly crown,
Which he did thrice refuse: was this ambition?
Yet Brutus says he was ambitious;
And, sure, he is an honourable man.
I speak not to disprove what Brutus spoke,
But here I am to speak what I do know.
You all did love him once, not without cause:
What cause withholds you then, to mourn for him?
O judgment! thou art fled to brutish beasts,
And men have lost their reason. Bear with me;
My heart is in the coffin there with Caesar,
And I must pause till it come back to me.`
}


// ----------------------------------------------------------------
// General Helper functions
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
    await wait(50);
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
