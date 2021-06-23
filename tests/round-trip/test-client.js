const WebSocket = require('ws');
const jsynchronous = require('../../jsynchronous.js');
const jsynclient = require('../../jsynchronous-client.js');
const util = require('util');


// Test set up
jsynchronous.send = (websocket, data) => {
  websocket.send(data);
}

const $erved = jsynclient(null, 'object');
const $relay = jsynchronous({});


// Jsync client setup
async function connectClient(backoff) {
  const ws = new WebSocket('ws://localhost:8080');
  ws.on('open', function open() {
    console.log('server->Relay communcation established');
  });
  ws.on('message', function incoming(data) {
    jsynclient.onmessage(data);
  });
  ws.on('error', async function error(a, b, c) {
    backoff = backoff || 1000;
    await wait(backoff);
    await connectClient(backoff * 1.2);
  });
}
connectClient();


// Jsync relay server setup
const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', function connection(ws) {
  console.log('Relay->server communication established');
  ws.on('message', function incoming(message) {});
  $relay.$ync(ws);
});


// Relay the data
$erved.$on('changes', () => {
  console.log(util.inspect($erved, {depth: 1, colors: true}));
  for (let prop in $erved) {
    $relay[prop] = $erved[prop];
  }
});

// ----------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------
function wait(t) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, t)
  });
}