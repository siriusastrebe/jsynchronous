const express = require('express');
const Primus = require('primus');
const WebSocket = require('ws');
const jsynchronous = require('jsynchronous');

jsynchronous.send = (websocket, data) => {
  websocket.write(data);
  console.log(`${(data.length/1000).toFixed(2)} kB`);
}

const physics = {velocity: {x: 5, y: -2.04}};
const $ynchronized = jsynchronous(physics);

setInterval(() => {
  $ynchronized.velocity.x += 5;
  $ynchronized.velocity.y -= 9.81;
}, 1000);

// Primus websocket server
const primus = Primus.createServer(function connection(spark) {
  $ynchronized.$ync(spark);
  spark.on('data', (data) => jsynchronous.onmessage(spark, data));
  spark.on('end', function () {
    $ynchronized.$unsync(spark);
  });
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
  res.sendFile('/node_modules/jsynchronous/jsynchronous-client.js', {'root': __dirname});
});

app.get('/primus/primus.js', (req, res) => {
  res.setHeader('content-type', "application/javascript");
  res.type("application/javascript");
  res.send(primus.library());
});
