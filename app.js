const express = require('express');
const fs = require('fs');
const jsynchronous = require('./jsynchronous.js');
const util = require('util');

const app = express();
const port = 3000;

//app.get('/socket.io/socket.io.js', (req, res) => {
//  res.sendFile(__dirname + '/node_modules/index.html');
//})



jsynchronous.send = (websocket, data) => {
  console.log('sending it bruuhhh', websocket, data);
}



const gameState = jsynchronous({ball: {position: [10, 12, 2.4]}});

gameState['ball']['velocity'] = [-0.4, 1.1, 0];

gameState['ball']['acceleration'] = [0.01, 0, -0.01];

gameState['ball']['acceleration'] = [99, 99, 99];

console.log('Description', util.inspect(gameState['__jsynchronous__'].jsync.describe(), {showHidden: false, depth: null, colors: true}));


//gameState.$sync('rando');
//console.log(gameState.$listeners('rando'));

gameState['extra'] = [];
setInterval(() => {
  gameState['extra'].push(Math.random());
  if (Math.random() < 0.4) {
  gameState['extra'].sort();
  }
}, 6000);

//console.log('Changes', util.inspect(, {showHidden: false, depth: null, colors: true}));
//console.log(gameState['__jsynchronous__'].jsync.history);

//console.log('init', initial);
//const gameState = jsynchronous(initial);
//console.log('Description', util.inspect(gameState['__jsynchronous__'].jsync.describe(), {showHidden: false, depth: null, colors: true}));


// synced = [{hidden: gameState}];
// gameState.ball.position.z = synced

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile(__dirname + '/jsynchronous-client.js');
})

const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

// Socket.io
const { Server } = require("socket.io");
const io = new Server(server);
io.on('connection', (socket) => {
  socket.emit('msg', {z: 'z', y: 'y'});
  console.log('a user connected');
});


