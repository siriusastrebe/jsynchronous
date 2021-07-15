const express = require('express');
const util = require('util');
const jsynchronous = require('../../jsynchronous.js');
const { Server } = require("socket.io");

const {Builder, By, Key, until} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');

const app = express();
const port = 3000;

// Jsynchronous
jsynchronous.send = (websocket, data) => {
  websocket.emit('msg', data);
  // console.log(`${(data.length/1000).toFixed(2)} kB`);   
}

let level = 0;
const $test = jsynchronous({level: 0});

// Express
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

// Socket.io
const io = new Server(server);
const connections = [];

io.on('connection', (socket) => {
  console.log('Client connected')
  let list = jsynchronous.variables();
  for (let key in list) {
    const $ynced = list[key];
    $ynced.$ync(socket);  
  };

  socket.on('msg', (data) => jsynchronous.onmessage(socket, data));
  connections.push(socket);

  socket.on('disconnect', () => {
    list = jsynchronous.variables();
    let disconnect = false;
    for (let key in list) {
      const $ynced = list[key];
      if ($ynced.$listeners().indexOf(socket) !== -1) {
        disconnect = true;
        $ynced.$unsync(socket);
      }
    }
    if (disconnect) console.log('Client disconnected');
    const index = connections.indexOf(socket);
    if (index !== -1) connections.splice(index, 1);
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile('/jsynchronous-client.js', {'root': '../../'});
});

// ----------------------------------------------------------------
// Selenium Test
// ----------------------------------------------------------------
const browsers = ['firefox', 'chrome'];
let drivers = [];
const runTests = (async () => {
  drivers = await Promise.all(browsers.map((browser) => new Builder().forBrowser(browser).build()));
  try {
    await all((driver) => driver.get('http://localhost:3000'));

    await test('Starting test', $test);

    await test(`Editing property of primary jsynchronous object`, $test);

    const primitives = {
      pi: Math.PI,
      zero: 0,
      und: undefined,
      null: null,
      str: '§†®îñG',
      negative: -1234567890,
      rounded: 0.123456789012345678901234567890,
      tru: true,
      fal: false,
      //inf: Infinity, // Not yet supported
      //neginf: -Infinity,
      // big: BigInt(99999999999999999999999999999999999999999999999999), // executeScript is unable to handle BigInt
    }

    const $primitives = jsynchronous(primitives, 'primitives');
    connections.map((c) => $primitives.$ync(c));
    await test('Created an object containing various primitive values', $primitives, 'primitives', true);


    const $array0 = jsynchronous([], 'array0');
    connections.map((c) => $array0.$ync(c));
    await test('Creating an empty array', $array0);

    $array0.push(0, 1, 2, 3, 777, 4, 5, 5.5, 6, 7, 8, 9, 9.999999, 10);
    await test('Pushed various numerical values onto the array', $array0);

    $array0.reverse();
    await test('Reversed the array', $array0);

    $array0.sort();
    await test('Sorted the array with the default javascript sort', $array0);

    $array0.sort((a, b) => a-b);
    await test('Sorted the array with a custom javascript sort', $array0);

    $array0.pop()
    await test('Popped the last element off the array', $array0);

    $array0.shift()
    await test('Shifted the 0th element out of the array', $array0);

    $array0.unshift('Pineapple');
    await test('Unshifted an element onto the beginning of the array', $array0);

    $array0.splice(3, 1, 'Kiwi', 'Chihuahua');
    await test('Spliced away an element and added a few more in the same action', $array0);


    const $array1 = jsynchronous([{z: 'z'}, 'y', ['x', 'w']], 'array1');
    connections.map((c) => $array1.$ync(c));
    await test('Created an array with various default values', $array1);

    $array1.push({v: [-23, 999, 0.987654321]});
    await test('Pushing a nested data structure onto the array', $array1);

    delete $array1[$array1.length-1];
    await test('Deleted the the last element from the array', $array1);

    $array1.splice(1, 1);
    await test('Spliced an element from early in the array', $array1);

    delete $array1[0];
    await test('Deleted the first element from the array', $array1);

    const array2Data = [[16], null];
    array2Data[1] = array2Data[0];
    const $array2 = jsynchronous(array2Data, 'array2');
    connections.map((c) => $array2.$ync(c));
    await test('Creating basic directed acyclic graph using an array', $array2);


    const array2 = $array2.$copy();
    await test('Created a copy of the directed acyclic graph, testing equality of copy', array2, 'array2');

    array2[0][0] = 17;
    await testFailure('Modified the copy, testing for failure', array2, 'array2');

    $array2[0][0] = 17;
    await test('Modified the original in the same way, testing equality with the copy', array2, 'array2');

    $array2.push($array2[0]);
    await test('Added another reference to the directed acyclic graph', $array2, 'array2');

    $array2[1] = 23;
    await test('Replaced a reference to a sub-array with a number', $array2, 'array2');

    $array2[0][0] = [[[97, 98]]];
    await test('Replaced a referenced sub-array with a more deeply nested array', $array2, 'array2');

    // $array2['__jsynchronous__'].jsync.sanityCheck();

    delete $array2[2];
    await test('Deleted a reference to an sub-array', $array2, 'array2');

    delete $array2[0];
    await test('Deleted the last remaining reference to an sub-array', $array2, 'array2');

    // $array2['__jsynchronous__'].jsync.sanityCheck();

    const array3 = [];
    array3[0] = array3;
    const $array3 = jsynchronous(array3, 'array3');
    connections.map((c) => $array3.$ync(c));
    await test('Created basic circular data structure with arrays', $array3, 'array3');


    const array4Data = [[[null]]];
    array4Data[0][0][0] = array4Data[0];
    const $array4 = jsynchronous(array4Data, 'array4');
    connections.map((c) => $array4.$ync(c));
    await test('Created a more involved circular data structure with arrays', $array4, 'array4');

    const array4 = $array4.$copy();
    await test('Created a copy of the circular data structure, testing for equality with copy', array4, 'array4');

    array4[0][0][0] = array4[0][0];
    await testFailure('Changed the copy, testing for failure', array4, 'array4');

    $array4[0][0][0] = $array4[0][0];
    await test('Changed the original, testing the copy against the original for equivalence', array4, 'array4');

    const alphabetData = {a: {b: {c: {d: {e: {f: {g: {h: {i: {j: {k: {l: {m: {n: {o: {p: {q: {r: {s: {t: {u: {v: {w: {x: {y: {z: null}}}}}}}}}}}}}}}}}}}}}}}}}};
    alphabetData.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z = alphabetData;
    const $alphabet = jsynchronous(alphabetData, 'alphabet');
    connections.map((c) => $alphabet.$ync(c));
    await test('Created a large circular data structure using objects', $alphabet, 'alphabet');

    $alphabet.a.b.c.d.e.f.g.h.i.j.k.l.m = null;
    await test('Broke the circular link', $alphabet, 'alphabet');

    // $alphabet['__jsynchronous__'].jsync.sanityCheck();

    const selfLoopData = {}
    for (let i=0; i<10; i++) {
      selfLoopData[i] = {}
      selfLoopData[i].loopback = selfLoopData[i];
    }
    $elfLoop = jsynchronous(selfLoopData, 'selfloop');
    connections.map((c) => $elfLoop.$ync(c));
    await test('Created a data structure with sub-objects that reference themselves using objects', $elfLoop, 'selfloop');

    const multiLoopData = [];
    for (let i=0; i<10; i++) {
      multiLoopData[i] = [];
      multiLoopData[i][0] = multiLoopData;
    }
    $multiLoop = jsynchronous(multiLoopData, 'multiloop');
    connections.map((c) => $multiLoop.$ync(c));
    await test('Created a data structure with sub-objects that references the root using arrays', $multiLoop, 'multiloop');

    const completeGraphData = {a: {}, b: {}, c: {}};
    completeGraphData.a.b = completeGraphData.b;
    completeGraphData.a.c = completeGraphData.c;
    completeGraphData.b.a = completeGraphData.a;
    completeGraphData.b.c = completeGraphData.c;
    completeGraphData.c.a = completeGraphData.a;
    completeGraphData.c.b = completeGraphData.b;
    $completeGraph = jsynchronous(completeGraphData, 'completegraph');
    connections.map((c) => $completeGraph.$ync(c));
    await test('Created a complete graph data structure where each object connects to each other object', $completeGraph, 'completegraph');

    const completeGraph = $completeGraph.$copy();
    await test('Created a copy of the complete graph, testing equality of copy', completeGraph, 'completegraph');

    completeGraph.c.a = completeGraph.b;
    await testFailure('Modified one edge of the complete graph, making it incomplete. Testing for failure.', completeGraph, 'completegraph');

    $completeGraph.c.a = $completeGraph.b;
    await test('Modified the original complete graph in the same way', completeGraph, 'completegraph');


    

    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`All tests passed! Node memory footprint: ${Math.round(used * 100) / 100} MB`);
  } catch (e) {
    console.error(e);
  } finally {
    await all((driver) => driver.quit());
  }

  return true;
});

async function test(text, $erver, name, skipJson) {
  if (name === undefined) {
    name = $erver.$info().name;
  }

  await incrementLevel(text);

  for (let driver of drivers) {
    let $dataRef;
    if (!isCyclic($erver) && skipJson !== true) {
      try {
        await driver.wait(() => jsonEquality(driver, name, $erver, $dataRef), 8000);
      } catch (e) {
        console.log('No match on json equality check');
        console.log(util.inspect($erver, {depth: 1, colors: true}));
        console.log('----------------------------------------------------------------');
        console.log(util.inspect($dataRef, {depth: 1, colors: true}));
        throw e;
      }
    }

    try {
      await driver.wait(() => fullEquality(driver, name, $erver), 8000);
    } catch (e) {
      console.log('No match on full equality check');
      console.log(util.inspect($erver, {depth: 1, colors: true}));
      console.log('----------------------------------------------------------------');
      throw e;
    }
  }
}

async function incrementLevel(text) {
  try {
    await all((driver) => driver.wait(() => waitUntilLevel(driver, level), 8000));
  } catch (e) {
    console.log('Test error flag gorilla');
    throw e;
  }

  if (text) {
    level++;
    $test.level = level;
    console.log(`Test ${level} - ${text}`);
  }

  try {
    await all((driver) => driver.wait(() => waitUntilLevel(driver, level), 8000));
  } catch (e) {
    console.log('Test error flag dolphin');
    throw e;
  }
}

async function testFailure(text, server, name, skipJson) {
  await incrementLevel(text);

  let failure = false;
  for (let driver of drivers) {
    try {
      if (!isCyclic(server) && skipJson !== true) {
        let $dataRef;
        if (await jsonEquality(driver, name, server, $dataRef)) {
          console.log(util.inspect(server, {depth: 1, colors: true}));
          console.log('----------------------------------------------------------------');
          console.log(util.inspect($dataRef, {depth: 1, colors: true}));
          throw `Test of json equality failure did not result in failure!`;
        }
      }

      if (await fullEquality(driver, name, server)) {
        console.log(util.inspect(server, {depth: 1, colors: true}));
        console.log('----------------------------------------------------------------');
        console.log(`http://localhost:${port} jsynchronous('${detailedType(server)}', '${name}')`);
        throw `Test of full equality failure did not result in failure!`;
      }
    } catch (e) {
      throw e;
    }
  }
}
async function waitUntilLevel(driver, level) {
  const $levels = await driver.executeScript("return jsynchronous('object')");
  if ($levels && $levels.level === level) {
    return true;
  } else {
    return null;
  }
}


async function all(fn) {
  if (fn.then) {
    return await Promise.all(drivers.map(async (driver) => await fn(driver)));
  } else {
    return await Promise.all(drivers.map((driver) => fn(driver)));
  }
}


async function jsonEquality(driver, name, $erver, $client) {
  const type = Array.isArray($erver) ? 'array' : 'object';
  $client = await driver.executeScript(`return jsynchronous('${type}', '${name}')`);
  // The above code will error on circular data structures. DAGs will have redundant portions of data
  const equality = deepComparison(JSON.parse(JSON.stringify($erver)), $client);
  // console.log($client, $erver, equality);
  if (equality) {
    return true;
  } else {
    return null;
  }
}

async function fullEquality(driver, name, $erver, props, visited) {
  // In order to work around Selenium's inability to return executeScript() values that have cyclic references, 
  // we need to recursively ask the browser what the type and value of each property attached to $erver, compare 
  // it to the type and value here on the server. Object keys and references also should match.
  if (props === undefined) props = [];
  if (visited === undefined) visited = new Map();

  const type = detailedType($erver);
  const proplist = props.length > 0 ? "['" + props.join("']['") + "']" : "";
  const clientType = await driver.executeScript(`return detailedType(jsynchronous('${type}', '${name}')${proplist})`);

  if (detailedType($erver) !== clientType) {
    //console.log('a', detailedType($erver), clientType, $erver, proplist);
    return null;
  }

  if (type === 'array' || type === 'object') {
    const clientKeys = await driver.executeScript(`return Object.keys(jsynchronous('${type}', '${name}')${proplist});`);
    const serverKeys = Object.keys($erver);
    if (clientKeys.length !== serverKeys.length) {
      // console.log('b', serverKeys, clientKeys, clientKeys.length, serverKeys.length);
      return null;
    }
    for (let i=0; i<serverKeys.length; i++) {
      if (clientKeys.indexOf(serverKeys[i]) === -1) {
        // console.log('c', serverKeys, clientKeys);
        return null;
      }
    }

    if (visited.has($erver)) {
      const proplist2 = visited.get($erver).length > 0 ? "['" + visited.get($erver).join("']['") + "']" : '';
      const sameReference = await driver.executeScript(`return jsynchronous('${type}', '${name}')${proplist} === jsynchronous('${type}', '${name}')${proplist2};`);

      if (sameReference) {
        // console.log('z', $erver, sameReference);
        return true;
      } else {
        // console.log('d', sameReference);
        return null;
      }
    }
    visited.set($erver, props);

    let equality = true;
    for (let prop in $erver) {
      const $value = $erver[prop];
      const clonedProps = props.slice();
      clonedProps.push(prop);
      if (await fullEquality(driver, name, $value, clonedProps, visited) !== true) {
        equality = false;
      }
    }

    if (equality === false) {
      return null;
    } else {
      return true;
    }
  } else {
    const $clientData = await driver.executeScript(`return jsynchronous('${type}', '${name}')${proplist};`);

    if ($clientData === $erver || ($erver === undefined && $clientData === null)) {
      // All data coming through executeScript gets cast as JSON, so undefined will look like null
      return true;
    } else {
      // console.log('e', $erver, $clientData);
      return null;
    }
  }
}

// ----------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------
function randomHash() {
  // A random hash with random length
  return Math.random().toString(36).substring(2);
}



function deepComparison(left, right, visited) {
  if (visited === undefined) visited = new Map();

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
    } else if (typeof l === 'object' && l !== null) {
      if (!visited.has(left)) {
        visited.set(left, right);

        if (deepComparison(l, r, visited) === false) {
          return false;
        }
      }
    }
  }

  return true;
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

function isCyclic(node, seen) {
  seen = seen || [];
  if (detailedType(node) === 'array' || detailedType(node) === 'object') {
    if (seen.indexOf(node) !== -1) {
      return true;
    }

    const clone = seen.slice();
    clone.push(node);
    for (let prop in node) {
      if (isCyclic(node[prop], clone)) {
        return true;
      }
    }
  }
  return false;
}



// ----------------------------------------------------------------
// Start test
// ----------------------------------------------------------------
runTests().then(() => {}).catch((e) => { 
  console.error(e); console.trace();
});
