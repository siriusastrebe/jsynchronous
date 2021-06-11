const express = require('express');
const fs = require('fs');
const jsynchronous = require('./jsynchronous.js');

const app = express();
const port = 3000;

const a = [{a: 'b'}]

jsynchronous.send = (websocket, data) => {
  console.log(websocket, data);
}

const synced = jsynchronous(a);

console.log('synced', synced);
console.log(synced['__jsynchronous__']);
console.log(synced[0]['__jsynchronous__']);

synced.push('frank');
synced.push([[]]);
synced[0]['z'] = 'Zeebus'
synced[0]['g'] = synced

console.log(synced);

synced[0]['g'].push('frank sinatra');
console.log(synced);

//synced.jsync('frnak');

//console.log(synced[0]['__jsynchronous__'].jsync.listeners);


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile(__dirname + '/jsynchronous-client.js');
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})
