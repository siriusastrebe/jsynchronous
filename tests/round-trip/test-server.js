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

function largeText() {
  return `[1:1] In the beginning when God created the heavens and the earth,
[1:2] the earth was a formless void and darkness covered the face of the deep, while a wind from God swept over the face of the waters.
[1:3] Then God said, "Let there be light"; and there was light.
[1:4] And God saw that the light was good; and God separated the light from the darkness.
[1:5] God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.
[1:6] And God said, "Let there be a dome in the midst of the waters, and let it separate the waters from the waters."
[1:7] So God made the dome and separated the waters that were under the dome from the waters that were above the dome. And it was so.
[1:8] God called the dome Sky. And there was evening and there was morning, the second day.
[1:9] And God said, "Let the waters under the sky be gathered together into one place, and let the dry land appear." And it was so.
[1:10] God called the dry land Earth, and the waters that were gathered together he called Seas. And God saw that it was good.
[1:11] Then God said, "Let the earth put forth vegetation: plants yielding seed, and fruit trees of every kind on earth that bear fruit with the seed in it." And it was so.
[1:12] The earth brought forth vegetation: plants yielding seed of every kind, and trees of every kind bearing fruit with the seed in it. And God saw that it was good.
[1:13] And there was evening and there was morning, the third day.
[1:14] And God said, "Let there be lights in the dome of the sky to separate the day from the night; and let them be for signs and for seasons and for days and years,
[1:15] and let them be lights in the dome of the sky to give light upon the earth." And it was so.
[1:16] God made the two great lights - the greater light to rule the day and the lesser light to rule the night - and the stars.
[1:17] God set them in the dome of the sky to give light upon the earth,
[1:18] to rule over the day and over the night, and to separate the light from the darkness. And God saw that it was good.
[1:19] And there was evening and there was morning, the fourth day.
[1:20] And God said, "Let the waters bring forth swarms of living creatures, and let birds fly above the earth across the dome of the sky."
[1:21] So God created the great sea monsters and every living creature that moves, of every kind, with which the waters swarm, and every winged bird of every kind. And God saw that it was good.
[1:22] God blessed them, saying, "Be fruitful and multiply and fill the waters in the seas, and let birds multiply on the earth."
[1:23] And there was evening and there was morning, the fifth day.
[1:24] And God said, "Let the earth bring forth living creatures of every kind: cattle and creeping things and wild animals of the earth of every kind." And it was so.
[1:25] God made the wild animals of the earth of every kind, and the cattle of every kind, and everything that creeps upon the ground of every kind. And God saw that it was good.
[1:26] Then God said, "Let us make humankind in our image, according to our likeness; and let them have dominion over the fish of the sea, and over the birds of the air, and over the cattle, and over all the wild animals of the earth, and over every creeping thing that creeps upon the earth."
[1:27] So God created humankind in his image, in the image of God he created them; male and female he created them.
[1:28] God blessed them, and God said to them, "Be fruitful and multiply, and fill the earth and subdue it; and have dominion over the fish of the sea and over the birds of the air and over every living thing that moves upon the earth."
[1:29] God said, "See, I have given you every plant yielding seed that is upon the face of all the earth, and every tree with seed in its fruit; you shall have them for food.
[1:30] And to every beast of the earth, and to every bird of the air, and to everything that creeps on the earth, everything that has the breath of life, I have given every green plant for food." And it was so.
[1:31] God saw everything that he had made, and indeed, it was very good. And there was evening and there was morning, the sixth day. 
`
}
function largeText2() {
  return `[2:1] Thus the heavens and the earth were finished, and all their multitude.
[2:2] And on the seventh day God finished the work that he had done, and he rested on the seventh day from all the work that he had done.
[2:3] So God blessed the seventh day and hallowed it, because on it God rested from all the work that he had done in creation.
[2:4] These are the generations of the heavens and the earth when they were created. In the day that the LORD God made the earth and the heavens,
[2:5] when no plant of the field was yet in the earth and no herb of the field had yet sprung up - for the LORD God had not caused it to rain upon the earth, and there was no one to till the ground;
[2:6] but a stream would rise from the earth, and water the whole face of the ground -
[2:7] then the LORD God formed man from the dust of the ground, and breathed into his nostrils the breath of life; and the man became a living being.
[2:8] And the LORD God planted a garden in Eden, in the east; and there he put the man whom he had formed.
[2:9] Out of the ground the LORD God made to grow every tree that is pleasant to the sight and good for food, the tree of life also in the midst of the garden, and the tree of the knowledge of good and evil.
[2:10] A river flows out of Eden to water the garden, and from there it divides and becomes four branches.
[2:11] The name of the first is Pishon; it is the one that flows around the whole land of Havilah, where there is gold;
[2:12] and the gold of that land is good; bdellium and onyx stone are there.
[2:13] The name of the second river is Gihon; it is the one that flows around the whole land of Cush.
[2:14] The name of the third river is Tigris, which flows east of Assyria. And the fourth river is the Euphrates.
[2:15] The LORD God took the man and put him in the garden of Eden to till it and keep it.
[2:16] And the LORD God commanded the man, "You may freely eat of every tree of the garden;
[2:17] but of the tree of the knowledge of good and evil you shall not eat, for in the day that you eat of it you shall die."
[2:18] Then the LORD God said, "It is not good that the man should be alone; I will make him a helper as his partner."
[2:19] So out of the ground the LORD God formed every animal of the field and every bird of the air, and brought them to the man to see what he would call them; and whatever the man called every living creature, that was its name.
[2:20] The man gave names to all cattle, and to the birds of the air, and to every animal of the field; but for the man there was not found a helper as his partner.
[2:21] So the LORD God caused a deep sleep to fall upon the man, and he slept; then he took one of his ribs and closed up its place with flesh.
[2:22] And the rib that the LORD God had taken from the man he made into a woman and brought her to the man.
[2:23] Then the man said, "This at last is bone of my bones and flesh of my flesh; this one shall be called Woman, for out of Man this one was taken."
[2:24] Therefore a man leaves his father and his mother and clings to his wife, and they become one flesh.
[2:25] And the man and his wife were both naked, and were not ashamed.`
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
