const express = require('express');
const jsynchronous = require('../../jsynchronous.js');
const { Server } = require("socket.io");

const app = express();
const port = 3000;

// Jsynchronous
jsynchronous.send = (websocket, data) => {
  websocket.emit('msg', data);
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
