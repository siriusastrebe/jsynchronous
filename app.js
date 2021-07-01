const express = require('express');
const fs = require('fs');
const jsynchronous = require('./jsynchronous.js');
const util = require('util');
const http = require('http');

const app = express();
const port = 3000;


//const physics = {velocity: {x: 5, y: 1.01}};
//const $ynchronized = jsynchronous(physics, {one_way: true});

//setInterval(() => {
//  $ynchronized.velocity.x += 5;
//  $ynchronized.velocity.y -= 9.81;
//}, 600);


const $ynchronized = jsynchronous([], {rewind: true});

setInterval(() => {
  $ynchronized.push($ynchronized.length);
}, 600);

// Express
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

// Jsynchronous
jsynchronous.send = (websocket, data) => {
  websocket.emit('msg', data);
  console.log('☐', data.length);
}

console.log($ynchronized.$info());

// Socket.io
const { Server } = require("socket.io");
const io = new Server(server);

io.on('connection', (socket) => {
  socket.emit('hello', {contents: 'world'});
  $ynchronized.$ync(socket);  

  socket.on('msg', (data) => {
    console.log(data);
    jsynchronous.onmessage(socket, data)
  });

  socket.on('disconnect', function() {
    $ynchronized.$unsync(socket);
  });
});


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/jsynchronous-client.js', (req, res) => {
  res.sendFile(__dirname + '/jsynchronous-client.js');
})


//const arr = [];
//arr.push('chars');
//arr.push('charizards');
//arr[5] = 7;
//arr[6] = {a: 'b'};
//
//
//const struct = {
//  arr: [],
//  childrenStructs: {},
//}
//

//arr.forEach((a) => {
//  console.log(a.name);
//});
//
//arr.map(()
//
//arr.filter(() => {
//});
//

// Basic deletion
//const obj = {a: 'a', b: {z: 'z'}}
//const $ynced = jsynchronous(obj);
//setInterval(() => {
//  const z = $ynced['b'];
//  delete $ynced['b']
//  z.bo = Math.random();
//  $ynced.b = 'b';
//  for (let i=0; i<100; i++) {
//  $ynced.three = Math.random();
//  $ynced.k = Math.random();
//  }
//}, 6000);


//const arr = [[0]]
//arr.push(arr[0]);
//arr.push(arr[0]);
//arr.push(arr[0]);
//
//const $ynced = jsynchronous(arr);
//setInterval(() => {
//  $ynced.push($ynced[0]);
//  $ynced[0][0] = Math.random();
//}, 5000);





//function everything() {
//const a = {
//  string: '$†®îñG',
//  integer: 123467890,
//  floating: 3.141592653589793,
//  bigint: BigInt('9999999999999999999999999'),
//  null: null,
//  undefined: undefined,
//  bool1: true,
//  bool2: false,
//  array: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233],
//  deep: {a: {very: {deeply: {nested: {data: ['structure']}}}}},
//  circular: [[[]]]
//}
//a.circular[0][0][0] = a;
//  return a;
//}
//
//const everyDataType = jsynchronous(everything());
//
//
//setInterval(() => {
//  everyDataType.oneleveldeeper = everything();
//}, 12000);

//a = []
//b = []
//c = []
//a.push(b);
//b.push(c);
//c.push(a);
//
//console.log(a);
//
//const gameState = jsynchronous(a);

//console.log('Description', util.inspect(gameState['__jsynchronous__'].jsync.describe(), {showHidden: false, depth: null, colors: true}));


//const huge = []
//for (let i=0; i<10000; i++) {
//  huge.push(i);
//}
//const gameState = jsynchronous(huge);

//const huge = []
//for (let i=0; i<4; i++) {
//  huge.push(i);
//}
//const gameState = jsynchronous(huge);


// console.log('reference', gameState['__jsynchronous__'].reference.length)

///setInterval(() => {
///  for (let i=0; i<4; i++) {
///    gameState.push(i);
///  }
///}, 12000)

//setTimeout(() => {
//  for (let i=0; i<10000; i++) {
//    gameState.push(i);
//  }
//}, 12000)


//function everything() {
//  const a = {
//    string: '$†®îñG',
//    num: 123467890,
//    num2: -2.02,
//    num3: 1.234567890123456789,
//    bigint: BigInt('12345678901234567890123456789012345678901234567890'),
//    bigint2: BigInt('-12345678901234567890123456789012345678901234567890'),
//    bool1: true,
//    bool2: false,
//    undef: undefined,
//    func: (() => 'yar har'),
//    null: null,
//    obj1: { a: [0, 1, 2, 3, 4, 5], empties: [undefined, null] },
//    obj2: { a: 'b', c: 'd' },
//    func: (() => 'what is this?'),
//    arr: [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, 'Liftoff', { houston: 'we got a problem' }],
//    circular: [[]]
//  }
//
//  a.circular[0][0] = a.circular;
//  a.obj1.empties.length = 3;
//  return a;
//}
////a = [undefined, null];
////a.length = 3;
//
//const gameState = jsynchronous(everything());
//
//setTimeout(() => {
//}, 6000);
//
//setInterval(() => {
//  gameState.circular2 = [[[]]]
//  gameState.circular2[0][0][0] = gameState.circular2;
//
//  gameState.func2 = (() => 'yo ho!');
//  gameState.arr.push('This is ground control to major tom');
//
//  gameState.obj2 = {z: 'y', x: 'w'}
//  gameState.bigint = gameState.bigint * BigInt(2);
//  gameState.bigint2 = gameState.bigint2 * BigInt(2);
//  gameState.bigint3 = BigInt(1);
//  gameState.num = gameState.num - 1;
//  gameState.obj1.empties.length = gameState.obj1.empties.length + 1;
//}, 5000);

//const initial = []
//for (let i=0; i<1000000; i++) {
//  initial.push(i % 2 == 0 ? i : -i);
//}
//
//const gameState = jsynchronous(initial);
//
//setTimeout(() => {
//for (let i=0; i<1000000; i++) {
//  gameState.push(i % 2 == 0 ? i : -i);
//}
//}, 5000);






//const gameState = jsynchronous({ball: {position: [10, 12, 2.4]}});
//gameState['ball']['velocity'] = [-0.4, 1.1, 0];
//gameState['ball']['acceleration'] = [0.01, 0, -0.01];
//gameState['ball']['acceleration'] = [99, 99, 99];
//gameState['random'] = {bool: true, boot: false, a: 'hello!', b: 0, c: null, d: undefined, e: 'undefined', empty: new Array(8)}
//gameState['random'].empty.push('not actually empty!');
//console.log('Description', util.inspect(gameState['__jsynchronous__'].jsync.describe(), {showHidden: false, depth: null, colors: true}));
//
//gameState['extra'] = [];
//setInterval(() => {
//  console.log('a little xtra');
//  gameState['extra'].push(Math.random());
//}, 15000);

//setTimeout(() => {
//  gameState['extra'].push({a: 'b'});
//  gameState['extra'].push(['c']);
//  gameState['extra'].push('str');
//  gameState['extra'].push(3);
//  gameState['extra'].push(undefined);
//  gameState['extra'].push(null);
//}, 10000);
//
//
//setTimeout(() => {
//  a = []
//  b = []
//  c = []
//  a.push(b);
//  b.push(c);
//  c.push(a);
//  gameState['circular'] = a;
//}, 15000);





//const gameState = jsynchronous(a);


//gameState.$sync('rando');
//console.log(gameState.$listeners('rando'));


/*

gameState['extra'] = [];
gameState['extra'].push(Math.random());
gameState['extra'].push(Math.random());
gameState['extra'].push(Math.random());
gameState['extra'].push(Math.random());
*/


//console.log('Changes', util.inspect(, {showHidden: false, depth: null, colors: true}));
//console.log(gameState['__jsynchronous__'].jsync.history);

//console.log('init', initial);
//const gameState = jsynchronous(initial);
//console.log('Description', util.inspect(gameState['__jsynchronous__'].jsync.describe(), {showHidden: false, depth: null, colors: true}));


// synced = [{hidden: gameState}];
// gameState.ball.position.z = synced

