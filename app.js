const express = require('express');
const fs = require('fs');
const jsynchronous = require('./jsynchronous.js');

const app = express();
const port = 3000;

jsynchronous.send = (websocket, data) => {
  console.log('sending it bruuhhh', websocket, data);
}

const startState = {ball: {postion: {x: 10, y: 12, z: -2.4}}}
const gameState = jsynchronous(startState);

console.log('synced', gameState);
gameState['ball']['velocity'] = {x: -0.4, y: 1.1, z: 0}
console.log('synced', gameState);



app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile(__dirname + '/jsynchronous-client.js');
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})
