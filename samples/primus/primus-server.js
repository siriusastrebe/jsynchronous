const express = require('express');
const Primus = require('primus');
const WebSocket = require('ws');
const jsynchronous = require('../../jsynchronous.js');

jsynchronous.send = (websocket, data) => {
  websocket.write(data);
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
