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

// Selenium
(async () => {
  let driver = await new Builder().forBrowser('firefox').build();
  try {
    await driver.get('http://localhost:3000');
    await test(driver, 'Creation of a standard jsynchronous object', $test);
    console.log(`All tests passed!`);
  } catch (e) {
    console.error(e);
  } finally {
    await driver.quit();
  }
})();

async function test(driver, text, $ynced) {
  if (text) {
    level++;
    console.log(`Level ${level} - ${text}`);
  }
  await driver.wait(waitUntilLevel(driver, level), 8000);

  /*
  await driver.wait(() => {
    await driver.executeScript('return jsynchronous()')
    $ynced.
  }), 8000);
  */
}

async function waitUntilLevel(driver, level) {
  const $levels = await driver.executeScript("return jsynchronous('object')");
  if ($levels && $levels.level === level) {
    return true;
  } else {
    return false;
  }
}

// ----------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------
function randomHash() {
  // A random hash with random length
  return Math.random().toString(36).substring(2);
}
