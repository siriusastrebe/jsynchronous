const express = require('express');
const jsynchronous = require('../../jsynchronous.js');
const { Server } = require("socket.io");

const app = express();
const port = 3000;

// Jsynchronous
jsynchronous.send = (websocket, data) => {
  websocket.emit('msg', data);
  console.log(`${(data.length/1000).toFixed(3)}kB`);   
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

// Express
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

// Socket.io
const io = new Server(server);

io.on('connection', (socket) => {
  physics.$sync(socket);  
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile('/jsynchronous-client.js', {'root': '../../'});
})
