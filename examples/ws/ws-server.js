const express = require('express');
const WebSocket = require('ws');
const jsynchronous = require('../../jsynchronous.js');

const wss = new WebSocket.Server({ port: 8080 });

jsynchronous.send = (websocket, data) => {
  websocket.send(data);
  console.log(`${(data.length/1000).toFixed(2)} kB`);   
}

const physics = {velocity: {x: 5, y: -2.04}};
const $ynchronized = jsynchronous(physics, {name: 'physics'});

setInterval(() => {
  $ynchronized.velocity.x += 5;
  $ynchronized.velocity.y -= 9.81;
}, 1000);

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
  });

  $ynchronized.$ync(ws);
});

// Express fileserver
const app = express();
const port = 3000;
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile('/jsynchronous-client.js', {'root': '../../'});
})
