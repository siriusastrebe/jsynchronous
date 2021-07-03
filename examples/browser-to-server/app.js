const express = require('express');
const jsynchronousClient = require('../../jsynchronous-client.js');
const { Server } = require("socket.io");

const app = express();
const port = 3000;

const $ynchronized = jsynchronousClient('object');

// Express
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

// Socket.io
const io = new Server(server);

io.on('connection', (socket) => {
  socket.on('msg', function (data) {
    console.log(JSON.stringify($ynchronized));
    jsynchronousClient.onmessage(data);
  });

  jsynchronousClient.send = (data) => {
    socket.emit('msg', data);
    console.log(`${(data.length/1000).toFixed(2)} kB`);   
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/jsynchronous.js', (req, res) => {
  res.sendFile('/jsynchronous.js', {'root': '../../'});
})
