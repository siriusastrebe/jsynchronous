const WebSocket = require('ws');
const jsynchronous = require('../../jsynchronous.js');
const jsynclient = require('../../jsynchronous-client.js');
const util = require('util');


// Test set up
jsynchronous.send = (websocket, data) => {
  websocket.send(data);
}

const $erved = jsynclient('object');
const $relay = jsynchronous({}, '', {one_way: true});

const $rewinder = jsynclient('object', 'rewinder');
const $rewound = jsynchronous({}, 'rewound', {rewind: true});


$erved.$on('changes', () => { 
  onChanges($erved, $relay)
  if ($erved.test === 'passed') {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`All tests passed! Memory used: ${Math.round(used * 100) / 100} MB`);
  }
});
$rewinder.$on('changes', () => onChanges($rewinder, $rewound));
$rewinder.$on('snapshot', (name) => onSnapshot(name, $rewound));

// Jsync client setup
async function connectClient(backoff) {
  const ws = new WebSocket('ws://localhost:8080');
  ws.on('open', function open() {
    console.log('server->Relay communcation established');
  });
  ws.on('message', function incoming(data) {
    console.log(data);
    console.log('');
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
  $rewound.$ync(ws);
});


function onChanges($left, $right) {
//  console.log(util.inspect($erved, {depth: null, colors: true}));
//  console.log('');
  for (let prop in $left) {
    $right[prop] = $left[prop];
  }
  for (let prop in $right) {
    if ($left.hasOwnProperty(prop) === false) {
      delete $right[prop];
    }
  }
}

function onSnapshot(name, target) {
  $rewound.$napshot(name);
}

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
