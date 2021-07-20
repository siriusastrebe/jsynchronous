const jsynchronous = require('jsynchronous');
const WebSocket = require('ws');

jsynchronous.send = (websocket, data) => websocket.send(data);

const physics = {velocity: {x: 5, y: -2.04}};
const $ynchronized = jsynchronous(physics);

setInterval(() => {
  $ynchronized.velocity.x += 5;
  $ynchronized.velocity.y -= 9.81;
}, 1000);

const wss = new WebSocket.Server({port: 8080});

wss.on('connection', (ws) => {
  $ynchronized.$ync(ws);
  ws.on('message', (data) => jsynchronous.onmessage(ws, data));
  ws.on('close', () => $ynchronized.$unsync(ws));
});


const express = require('express');
const app = express();
const port = 3000;
app.listen(port, () => console.log("Listening on " + port));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})
app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile('/node_modules/jsynchronous/jsynchronous-client.js', {'root': __dirname});
})
