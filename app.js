const express = require('express');
const fs = require('fs');
const jsynchronous = require('./jsynchronous.js');
const util = require('util');

const app = express();
const port = 3000;

jsynchronous.send = (websocket, data) => {
  console.log('sending it bruuhhh', websocket, data);
}


/*
const gameState = jsynchronous({ball: {position: [10, 12, 2.4]}});

gameState.countdown = [3, 2, 1, {lift: 'off'}];

gameState['ball']['velocity'] = [-0.4, 1.1, 0]


gameState['z'] = new Array(8);
gameState['z'].push(undefined);
gameState['z'].push('goal!');
gameState['z'].push('goal!');
gameState['z'].push('goal!');
*/
const gameState = jsynchronous({a: {}, b: {}, c: {}});

gameState.a.a = gameState;
gameState.b.a = gameState;
gameState.c.a = gameState;






console.log('Description', util.inspect(gameState['__jsynchronous__'].jsync.describe(), {showHidden: false, depth: null, colors: true}));

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

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})
