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
  $test.$ync(socket);  
  socket.on('msg', (data) => jsynchronous.onmessage(socket, data));
  connections.push(socket);

  socket.on('disconnect', () => {
    $test.$unsync(socket);
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

    const $array1 = jsynchronous([], 'array1');
    connections.map((c) => $array1.$ync(c));
    await test('Creating a new synchronized empty array', $array1);

    const data = [[16], null];
    data[1] = data[0];
    const $array2 = jsynchronous(data, 'array2');
    connections.map((c) => $array2.$ync(c));
    await test('Creating synchronized basic directed acyclic graph using an array', $array2);

    const array2 = $array2.$copy();
    await test('Created a copy of the DAG, testing equality of copy', array2, 'array2');
    
    array2[0][0] = 17;
    await testFailure('Modified the copy, testing for failure', array2, 'array2');

    $array2[0][0] = 17;
    await test('Modified the original in the same way, testing equality with the copy', array2, 'array2');



    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`All tests passed! Node memory footprint: ${Math.round(used * 100) / 100} MB`);
  } catch (e) {
    console.error(e);
  } finally {
    await all((driver) => driver.quit());
  }

  return true;
});

async function test(text, $erver, name) {
  if (name === undefined) {
    name = $erver.$info().name;
  }

  await incrementLevel(text);

  for (let driver of drivers) {
    // TODO: Replace with cyclic check for data
    if (true) {
      let $data;
      try {
        await driver.wait(() => nonCyclicEquality(driver, name, $erver, $data), 8000);
        await driver.wait(() => fullEquality(driver, name, $erver), 8000);
      } catch (e) {
        console.log(util.inspect($erver, {depth: 1, colors: true}));
        console.log('----------------------------------------------------------------');
        console.log(util.inspect($data, {depth: 1, colors: true}));
        throw e;
      }
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

async function testFailure(text, server, name) {
  await incrementLevel(text);

  let failure = false;
  for (let driver of drivers) {
    // TODO: Replace with cyclic check for data
    if (true) {
      try {
        let $data;
        if (await nonCyclicEquality(driver, name, server, $data)) {
          console.log(util.inspect(server, {depth: 1, colors: true}));
          console.log('----------------------------------------------------------------');
          console.log(util.inspect($data, {depth: 1, colors: true}));
          throw `Test of non-cyclic failure did not result in failure!`;
        }

        if (await fullEquality(driver, name, server)) {
          console.log(util.inspect(server, {depth: 1, colors: true}));
          console.log('----------------------------------------------------------------');
          console.log(`http://localhost:${port} jsynchronous('${detailedType(server)}', '${name}')`);
          throw `Test of cyclic failure did not result in failure!`;
        }
      } catch (e) {
        throw e;
      }
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


async function nonCyclicEquality(driver, name, $erver, $client) {
  const type = Array.isArray($erver) ? 'array' : 'object';
  $client = await driver.executeScript(`return jsynchronous('${type}', '${name}')`);
  // The above code will error on circular data structures. DAGs will have redundant portions of data
  const equality = deepComparison($erver, $client);
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
    // console.log('a', detailedType($erver), clientType, $erver, proplist);
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

    if ($clientData === $erver) {
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
    } else if (typeof l === 'object') {
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



// ----------------------------------------------------------------
// Start test
// ----------------------------------------------------------------
runTests().then(() => {}).catch((e) => { 
  console.error(e); console.trace();
});
