# Jsynchronous

Get your (rapidly changing) data from Node.js->Browser with ease. 

Jsynchronous is a real-time data synchronization library. Fast enough for games, flexible enough for science, tested to precision. Can also handle server->server sync or browser->server sync. 

Create an array or object in Node.js. Jsynchronous will create an identical variable in connected browsers:

```javascript
// Server side
const physics = {velocity: {x: 5, y: 1.01}};
const $ynchronized = jsynchronous(physics);
```
```javascript
// Browser side
console.log(jsynchronous());
{  velocity: {x: 5, y: 1.01}  }
```
Changes to that variable will be automatically communicated to the browser so that they always stay in-sync:
```javascript
// Server side
$ynchronized.velocity.x += 5;
$ynchronized.velocity.x -= 9.81;
```
```javascript
// Browser side
console.log(jsynchronous());
{  velocity: {x: 10, y: -8.8}  }
```

Here's a glimpse into the kinds of data you can synchronize with jsynchronous:

```javascript
const data = { 
  string: '$†®îñG',
  integer: 123467890,
  floating: 3.141592653589793,
  bigint: BigInt('12345678901234567890'),
  null: null,
  undefined: undefined,
  bool: true,
  array: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233],
  deep: {a: {very: {deeply: {nested: {data: ['structure']}}}}},
  circular: {a: {b: {c: null}}}
}
data.circular.a.b.c = data.circular;

const $ynced = jsynchronous(data);
```

# Setting up

Jsynchronous does not lock you into a transportation medium you use whether it be [socket.io](https://socket.io/) [ws](https://www.npmjs.com/package/ws) [Primus](https://www.npmjs.com/package/primus), [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource), or [webRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API). Any protocol with eventual in-order delivery works. We will be using [Socket.io](https://socket.io/) in this example.

The server side setup consists of 3 required steps: 

1) Specify a jsynchronous.send function
2) Create a synchronized variable by calling jsynchronous(), 
3) Register connected websockets to your synchronized variable with .$ync(websocket)

```javascript
// Server side using socket.io
const { Server } = require("socket.io"); 
const jsynchronous = require('jsynchronous');

jsynchronous.send = (socket, data) => socket.emit('msg', data);

const $matrix = jsynchronous([[1, 2], [3, 4]]);

const io = new Server(server);
io.on('connection', (socket) => {
  $matrix.$ync(socket);
  socket.on('disconnect', () => $matrix.$unsync(socket));
});
```

The jsynchronous.send = (websocket, data) => {} function is automatically called by jsynchronous every time data needs to be sent to the client. In this example, it calls .emit(), a method of a socket.io websocket.

Calling jsynchrounous() creates and returns a synchronized variable. In this example, `$matrix`. Calling `$matrix.$ync(websocket)` will make the synchronized variable visible to that websocket.

We use `$` in our sychronized variable name because convention. You don't have to but it is nice to have some indication in code that changes to this variable on the server will result in network communication.

Now that the data is being sent from the server, let's focus on the client side. In the browser access the jsynchronous client one of two ways:

```javascript
<script src="/jsynchronous-client.js"></script>
```

or

```javascript
import jsynchronous from 'jsynchronous/jsynchronous-client.js';
```

The second method requires a bundler like webpack.

```javascript
// Browser side
const socket = io();
socket.on('msg', (data) => jsynchronous.onmessage(data));
```

That's all it takes! View the contents of your synchronized variable on the client:

```javascript
// Browser side
console.log(jsynchronous());
```

Take a look at sample code at the [example setups](https://github.com/siriusastrebe/jsynchronous/tree/master/examples) for guidance.

There's a 4th optional step of enabling browser->server communication, used to recover from network interruptions causing desynchronization, we'll discussed below.

# Stand-In variables

Calling jsynchronous() on the server once without providing a name will create a primary variable. Clients can see the primary synchronized variable by calling jsynchronous() on the client once communication has been established. 

**Calling jsynchronous() BEFORE the variable has been synchronized on the client will result in error!** To avoid this specify in the first argument the expected type 'array' or 'object':

```javascript
// Browser side
const $matrix = jsynchronous('array');
```

$matrix will return as a stand-in variable of the type provided if the client has not yet completed synchronization. Stand-in variables are just empty arrays or objects at first. When the client is sync and up to date the stand-in variable will update accordingly.

The alternative to stand-in variables is to wait to call jsynchronous(). You can see which synchronized variables are available at any time by using jsynchronous.list().

# Multiple synchronized variables

Additional calls to jsynchronous() on the server will create additional synchronized variables, but you must name them by passing in name as the second argument:

```javascript
// Server side
const $greetings = jsynchronous({text: 'hello world'}, 'greetings');
```

Retrieve it on the client by referring to its name as the second argument:

```javascript
// Client side
const $greetings = jsynchronous('object', 'greetings');
```

You can see a list of names using jsynchronous.list();

# Connection interrupts and Resynchronization

There's many reasons why a TCP/IP connection would reset. Losing service, going underground or in an elevator with your phone can cause timeouts, closing your laptop, switching between ethernet wifi or cellular data resets your connections. Sometimes the wifi or the network itself has a hiccup. Many websocket libraries will resume a session after a TCP/IP interrupt, but don't guarantee delivery of messages sent while the tcp/ip connection is down. 

Jsynchronous will ensure synchronization occurs when the user reconnects - no matter how long ago they disconnected. It achieves this by numbering all messages and re-requesting missing ranges – something TCP/IP normally handles... when it isn’t interrupted.

In order to support resynchronization requests, client->server communication is required. You will have to define a client side jsynchronous.send function and make calls to the server side jsynchronous.onmessage(websocket, data). Similar to the earlier set up, but note how server side functions need a websocket passed in.

```javascript
// Server side
const $ynchronized = jsynchronous(['Quoth', 'the', 'raven', '"Nevermore."']);

jsynchronous.send = (socket, data) => socket.emit('msg', data));

io.on('connection', (socket) => {
  $ynchronized.$ync(socket);
  socket.on('disconnect', () => $ynchronized.$unsync(socket));
  socket.on('msg', (data) => jsynchronous.onmessage(socket, data));
});
```
```javascript
// Browser side 
const socket = io();
socket.on('msg', (data) => jsynchronous.onmessage(data));
jsynchronous.send = (data) => socket.emit('msg', data));

const $ynchronized = jsynchronous('object');
```

Setting up client->server communication makes your synchronized variables resistant to data loss and desynchronization. By default the client will give you a warning if you don't provide .send on client or .onmessage on server and will halt if messages are missed and no re-synchronization is possible. 

Not all applications need this level of protection and can rely on the guarantees afforded by TCP/IP. Disable client->server communication entirely with the setting {one_way: true} as an option to your call to jsynchronous() on the server. One_way mode works great if you keep the synchronized variable’s initial structure the same and only change primitive values (strings, numbers, booleans) without assigning any new references to objects or arrays. Missing messages will be ignored and jsynchronous will do its best to continue to update properties of already synchronized objects/arrays.

# Rewind mode

Rewind mode is a powerful feature of jsynchronous. Rewind mode lets you 'rewind' to previous snapshots of the data. 

Imagine a chess game. In normal mode it's impossible to step back a few moves to see how the board looked in the past. With rewind mode you can see the board as it looked for any move in the game. Pausing, rewinding, and playing changes forward all become possible using rewind mode.

Normally clients discard the history of changes once they're up to date to save on memory. With rewind mode, clients are given the full history from the very beginning. The history can be applied to the initial state to reconstruct any moment along that history. This is called Event Sourcing. 

Create a snapshot on the server by calling .$napshot() on the synchronized variable:

```javascript
// Server side
const $ynced = jsynchronous([]);

$ynced.push(Math.random());
$ynced.$napshot('one');

$ynced.push(Math.random());
$ynced.$napshot('two');
```

You can rewind to a snapshot by calling .$rewind(name)

```javascript
const previous = $ynced.$rewind('one');
```

Rewind mode can also be useful if your client expects changes in the order they happened regardless of when the client connects to an actively changing state.

Reconstructing the current state can be network and computationally intensive for large histories so take care not to apply an endless number of changes to variables with rewind mode enabled.

# Security and Permissioning

Permissioning in Jsynchronous is easy. Don't call .$ync(websocket) if you don't want that websocket to see the data contained in the synchronized variable.

It's recommended to create additional synchronized variables for different levels of permissioning and visibility in your application.

# Events

Watch, listen, trigger events on changes by using .$on('changes', callback) on a synchronized variable:

```javascript
$ynchronized.$on('changes', () => {})
```

This is only available on the client side for now. Future releases will see more types of events and more ways to track changes. Stay tuned!

# Troubleshooting

The most common mistake leaving you wondering why your data is not being communicated is due to making assignments to the data you pass into jsynchronous() instead of the synchronized variable returned by jsynchronous().

```javascript
// Server side
const physics = {x: 0, y: 0, z: 0}
const $ynced = jsynchronous(physics);
physics.x += 10;  // Will not synchronize!
```

To see the changes on the client side the above code will have to modify `$ynced`, not `physics`. Jsynchronous creates a deep copy of the variables you pass into it, forgetting everything about the original data. This is also true when assigning objects or arrays to a synchronized variable:

```javascript
const quaternion = {w: 1, i: 0, j: 0, k: 0}
$ynced.orientation = quaternion;  // Will synchronize
$ynced.orientation.w = 0; // Will synchronize
quaternion.i = 1;  // Will not synchronize
```

Be careful when assigning object and arrays to synchronized variables. ALL of the contents will become visible to clients that are in .$ync().

On the flip side, you can reference a synchronized variable from other parts of your app. Changes to these references WILL synchronize:

```javascript
const $quaternion = $ynced.orientation;
$quaternion.i = 1; // Will synchronize
$quaternion.w = 0; // Will synchronize
```

We recommended you use the prefix ‘$’ or some other convention when you reference a synchronized variable to indicate that assignments to that variable will be sent over the network.

# Reference

## Jsynchronous methods

### send

```javascript
// Server side
jsynchronous.send = (websocket, data) => {}

// Client side
jsynchronous.send = (data) => {}
```

Undefined by default, you must assign it to a function that transmits the data. Websocket will match a value you provided to your calls to a synchronous variable's $ync(websocket) method. 

### onmessage

```javascript
// Server side
jsynchronous.onmessage(websocket, data);

// Browser side
jsynchronous.onmessage(data);
```

A function. It is up to you to call onmessage whenever transmitted data has arrived. 

### list

```javascript
// Server or Browser side
jsynchronous.list();
```

Returns an array of variable names.

### variables

```javascript
// Server or Browser side
jsynchronous.variables();
```

Returns an object with key->value corresponding to name->synchronized variable.

## The Jsynchronous() function call

```javascript
jsynchronous(data, name, options);
```

Creates and returns a synchronized variable. On the client, data must exactly match one of 'array', 'object', [], or {}.

## Options passed to jsynchronous(data, name, options)

`{send: <function>}`

Overrides jsynchronous.send with a synchronized variable specific send function. Default undefined.

`{rewind: true}`

Turns on Rewind mode. See documentation above on rewind mode. Default false.

`{one_way: true}`

Instructs the client to only read data and not transmit any handshakes, heartbeats, or resynchronization requests at the application level. If a gap in network connectivity causes desynchronization, continue processing changes as best as they can. See documentation above on connection interrupts and resynchronization. Default false.

`{wait: true}`

Tells jsynchronous to delay synchronization until $tart() is called on the synchronized variable. Default false.

`{buffer_time: <number>}`

Number of milliseconds to wait before transmitting synchronization data to clients. Default 0.

`{history_limit: <number>}`

The maximum size of the history. Rewind mode ignores this number, as rewind mode saves all history. Default 100000.

### Reserved words

Pass any method names available to the synchronized variable as an option key to overwrite that reserved word with the string value you provide. 

For example to change the method name `.$on()` to `__on__()` pass in `{$on: '__on__'}` into the options call to jsynchronous(). This will overwrite the reserved word on both server and client. Useful if you expect your root variable to contain a key matching an existing reserved word.

## Methods available to root of synchronized variables

```javascript
.$info()
```

Client or server. Returns an object detailing information about this synchronized variable. Useful for debugging.

```javascript
.$ync(websocket)
```

Server only. Adds a client to the list of listeners. Websocket can be a string, number, or an object provided by your websocket library. Websocket must be a value or reference that uniquely identifies the client.

```javascript
.$unsync(websocket)
```

Server only. Removes the websocket from the list of clients.

```javascript
.$copy()
```

Server and client. Returns a deep copy of the synchronized variable. The returned variable is not synchronized.

```javascript
.$on('changes', callback)
```

Client only. Creates an event listener which triggers callback after each batch of changes. Server events will be available in future releases. 

```javascript
.$on('snapshot', callback)
```

Client only. Creates an event which triggers callback when a snapshot is created. Server events will be available in future releases.

```javascript
.$tart()

Server only. Used along side the {wait: true} option in the call to jsynchronous(), tells jsynchronous to start synchronizing the variable to $ync'ed clients.

```javascript
.$listeners()
```

Server only. A list of websockets you passed into calls to .$ync()

```javascript
.$napshot(name)
```

Server only. Creates a snapshot, used in Rewind mode. Name can be a number or a string.

```javascript
.$rewind(name, [counter])
```

Client only. Name can be a number or a string. Returns a non-synchronized variable with the data matching your synchronized variable's data as it looked the moment the snapshot by that name was created. If name is undefined, will rewind to the synchronized variable's numbered change counter. Server side rewind will be available in future releases.

# Frequently asked questions

## How do I use my synchronized variable with React/Vue/Angular/Svelte?

Use .$copy() on your synchronized variable to populate your initial state.

Have an event listener .$on('change') to update the state.

## Can jsynchronous be used to represent graphs or complex data structures?

Absolutely, Yes. Graphs sparse or dense, trees, linked lists, doubly linked lists, circular and self referential data structures. Neural networks potentially? If JavaScript can represent it, jsynchronous can synchronize it with ease.

In a world of clunky transport stacks with limited expressiveness jsynchronous aims to be a breath of fresh air without limits to what you can use it for.

## Can jsynchronous really be used for games?

TCP/IP, which all browsers rely on, can see increased latency in packet loss heavy conditions due to [head of line blocking](https://gafferongames.com/post/client_server_connection/). 

If your game does not need millisecond level precision jsynchronous will keep your data perfectly synchronized as fast as the wire will carry it to every client your websockets can [handle](https://blog.jayway.com/2015/04/13/600k-concurrent-websocket-connections-on-aws-using-node-js/). For 90% of games Jsynchronous on top of TCP/IP is more than ideal. For quick twitch-speed shooter or fighting game, maybe not. 

[UDP may be coming to browsers](https://github.com/WICG/raw-sockets/blob/main/docs/explainer.md) which is very exciting for fast paced gaming. While UDP isn’t suitable for accurate data synchronization because it cannot ensure delivery or ordering, Jsynchronous' one_way mode could be used on top of UDP for fast best-effort delivery.

## Can I do Browser->Server sync?

The best method for securing your application is by building an API or using websockets to communicate browser->server.

It is possible to import jsynchronous.js in the browser and jsynchronous-client.js on your server. Each browser would have to uniquely name their synchronized variable so the server can distinguish between them. 

For a video games, the game state can sync from server->browser, and the user inputs can sync from browser->server. In this way you can easily have your game loop respond to changes in user input and update the game state for all clients to see.

Any curious scripter can open the browser console and casually modify your synchronized variables. The jsynchronous server was designed to be operated in a trusted environment, which the browser is not. Your websocket server must rate limit AND size limit ([maxHttpBufferSize](https://socket.io/docs/v3/server-initialization/#maxHttpBufferSize)/[maxPayload](https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback)), and you should drop the connection if the data structure doesn't match exactly what you expect. 

## What about bi-directional synchronization, changes on the client side?

Changes to the client side data structure do NOT reflect on the server or any other clients, and may cause errors.

Jsynchronous is one way sync, NOT bidirectional sync. This may be supported in the future experimentally, however for production workloads it is highly recommended to use an API or websocket commands and have the server change the jsynchronous variables from its side of things.

The reasoning behind this is that it's much harder to secure a client-side data-structure from tampering, injections, DDOSing, or amplification attacks than for the server api/interface to do so. Proxy and getters/setters are a relatively new javascript specification, this library can support very old browsers much easier by not accepting changes from clients.

There are limits to using a reactive data structure like jsynchronous to manage bi-directional requests to change data. Even something as simple as an increment coming from multiple clients simultaneously might get lost in a last-write-wins heuristic because i++ looks the same as i=constant in the eyes of a getter/setter. Some data types may need more expressive operations than 'set' and 'delete'. Operational transforms need to be application, intent, and data-type specific to handle merge-conflicts, even server-><-client conflicts are easier to reason through an API than through a reactive data structure.

