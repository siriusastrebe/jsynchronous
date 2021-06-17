const express = require('express');
const WebSocket = require('ws');
const jsynchronous = require('../../jsynchronous.js');

const wss = new WebSocket.Server({ port: 8080 });

jsynchronous.send = (websocket, data) => {
  websocket.send(data);
  console.log(`${(data.length/1000).toFixed(2)} kB`);   
}

const physics = jsynchronous({
  x: 1,
  y: 0, 
  z: 0,
})

setInterval(() => {
  physics.x = physics.x * 2;
}, 1000);

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
  });

  physics.$sync(ws);
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
