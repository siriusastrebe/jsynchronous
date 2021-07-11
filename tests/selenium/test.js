const express = require('express');
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

io.on('connection', (socket) => {
  $test.$ync(socket);  
  socket.on('msg', (data) => jsynchronous.onmessage(socket, data));
  socket.on('disconnect', () => $test.$unsync(socket));
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
(async () => {
  drivers = await Promise.all(browsers.map((browser) => new Builder().forBrowser(browser).build()));
  try {
    await all((driver) => driver.get('http://localhost:3000'));

    await test0();

    await test('Creation of a standard jsynchronous object', $test);

    await test('Editing property of object', $test);

    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`All tests passed! Node memory footprint: ${Math.round(used * 100) / 100} MB`);
  } catch (e) {
    console.error(e);
  } finally {
    await all((driver) => driver.quit());
  }
})();

async function test(text, $ynced) {
  try {
    await all((driver) => driver.wait(() => waitUntilLevel(driver, level), 8000));
  } catch (e) {
    console.error(e); console.trace();
  }

  if (text) {
    level++;
    $test.level = level;
    console.log(`Test ${level} - ${text}`);
  }

  try {
    await all((driver) => driver.wait(() => waitUntilLevel(driver, level), 8000));
  } catch (e) {
    console.error(e); console.trace();
  }

  try {
    await all((driver) => driver.wait(() => {
      return true;
    }, 8000));
  } catch (e) {
    console.error(e); console.trace();
  }
}

async function all(fn) {
  return await Promise.all(drivers.map((driver) => fn(driver)));
}

async function waitUntilLevel(driver, level) {
  const $levels = await driver.executeScript("return jsynchronous('object')");
  if ($levels && $levels.level === level) {
    return true;
  } else {
    return null;
  }
}

// ----------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------
function randomHash() {
  // A random hash with random length
  return Math.random().toString(36).substring(2);
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


  // Negative tests
  if (deepComparison({a: 'b'}, {a: 'c'})) throw `Test 0 failed - Deep comparison failed check 6`
  if (deepComparison({a: {b: {c: 'z'}}}, {a: {b: {c: 'y'}}})) throw `Test 0 failed - Deep comparison failed check 7`
  if (deepComparison([0, 1, 2, 3], [0, 1, 2])) throw `Test 0 failed - Deep comparison failed check 8`
  if (deepComparison([0, 1, 2, 3], [0, 1, 2, '3'])) throw `Test 0 failed - Deep comparison failed check 9`
  if (deepComparison([[[]]], [[[0]]])) throw `Test 0 failed - Deep comparison failed check 10`

  const circular5 = {x: {y: {z: undefined}}}
  const noncircular = {x: {y: {z: undefined}}}
  circular5.x.y.z = circular5.x;
  if (deepComparison(circular5, noncircular)) throw `Test 0 failed - Deep comparison failed check 10`

  return true;
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
