const WebSocket = require('ws');
const jsynchronous = require('../../jsynchronous-client.js');

console.log(jsynchronous, typeof jsynchronous);

const ws = new WebSocket('ws://localhost:8080', {
  perMessageDeflate: false
});

ws.on('open', function open() {
  ws.send('something');
});

ws.on('message', function incoming(data) {
  jsynchronous.onmessage(data);
  console.log(jsynchronous());
});
