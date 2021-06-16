const express = require('express');
const Primus = require('primus');
const WebSocket = require('ws');
const jsynchronous = require('../../jsynchronous.js');

jsynchronous.send = (websocket, data) => {
  console.log(`${(data.length/1000).toFixed(3)} kB`);   
  websocket.write(data);
}

const physics = jsynchronous({position: [2, 0, 0], velocity: [0, 0, 0], acceleration: [0.001, -0.008, 0.0002]})

setInterval(() => {
  physics.velocity[0] += physics.acceleration[0];
  physics.velocity[1] += physics.acceleration[1];
  physics.velocity[2] += physics.acceleration[2];

  physics.position[0] += physics.velocity[0];
  physics.position[1] += physics.velocity[1];
  physics.position[2] += physics.velocity[2];
}, 1000);

// Primus websocket server
const primus = Primus.createServer(function connection(spark) {
  physics.$sync(spark);
}, { port: 8080, transformer: 'websockets' });

// Express fileserver
const app = express();
const port = 3000;
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile('/jsynchronous-client.js', {'root': '../../'});
});

app.get('/primus/primus.js', (req, res) => {
  res.setHeader('content-type', "application/javascript");
  res.type("application/javascript");
  res.send(primus.library());
});
