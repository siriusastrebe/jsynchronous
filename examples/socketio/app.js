const express = require('express');
const jsynchronous = require('jsynchronous');
const { Server } = require("socket.io");

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
  socket.on('msg', (data) => {
    jsynchronous.onmessage(socket, data);
  });
  socket.on('disconnect', () => $ynchronized.$unsync(socket));
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile('/node_modules/jsynchronous/jsynchronous-client.js', {'root': __dirname});
})
