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
  console.log(`${(data.length/1000).toFixed(2)} kB`);   
}

const physics = {velocity: {x: 5, y: -2.04}};
const $ynchronized = jsynchronous(physics);

setInterval(() => {
  $ynchronized.velocity.x += 5;
  $ynchronized.velocity.y -= 9.81;
}, 1000);

// Express
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

// Socket.io
const io = new Server(server);

io.on('connection', (socket) => {
  $ynchronized.$ync(socket);  
  socket.on('msg', (data) => jsynchronous.onmessage(socket, data));
  socket.on('disconnect', () => $ynchronized.$unsync(socket));
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
    const body = await driver.findElement(By.css('body'));
    await driver.wait(until.elementTextContains(body, ''), 10000);
    console.log(await body.getText());
  } catch (e) {
    console.error(e);
  } finally {
    await driver.quit();
  }
})();