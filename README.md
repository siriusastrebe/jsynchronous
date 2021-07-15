# Jsynchronous

Get your (rapidly changing) data from Node.js->Browser with ease. 

Jsynchronous is a real-time data synchronization library. Fast enough for games, flexible enough for science, tested to precision. Can also handle server->server sync or browser->server sync. 

Create an array or object in Node.js. Jsynchronous will create an identical variable in connected browsers:

```javascript
// Server side
const physics = {velocity: {x: 5, y: 1.01}};
const $ynchronized = jsynchronous(physics);
```
```
// Browser side
console.log(jsynchronous());
{  velocity: {x: 5, y: 1.01}  }
```
Changes to that variable will be reflected on the client:
```
// Server side
$ynchronized.velocity.x += 5;
$ynchronized.velocity.x -= 9.81;
```
```
// Browser side
console.log(jsynchronous());
{  velocity: {x: 10, y: -8.8}  }
```

Jsynchronous will keep the browser's view of the data in-sync with the server. Here's a glimpse into the kinds of data you can synchronize with jsynchronous:

```
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

Jsynchronous does not lock you into a transportation medium you use whether it be socket.io ws or Primus, EventSource, or webRTC. Any protocol with eventual in-order delivery works. 

What Jsynchronous needs is to be provided a jsynchronous.send = () => {} function which is called by jsynchronous every time data needs to be sent to the client. Here's an example using Socket.io:

```
// Server side
const jsynchronous = require('jsynchronous');

jsynchronous.send = (websocket, data) => websocket.emit('msg', data);
```

When new clients connect to your websocket, register them your synchronized variable using .$ync(websocket):

```
// Server side
const { Server } = require("socket.io"); 
const io = new Server(server);

const $matrix = jsynchronous([[1, 2], [3, 4]]);

io.on('connection', (socket) => {
  $matrix.$ync(socket);
  socket.on('disconnect', () => $matrix.$unsync(socket));
});
```

We use `$` in our sychronized variable name because convention. You don't have to, but it is nice to have some indication in code that changes to this variable on the server will result in network communication.

Now that the data is being sent from the server, let's focus on the client side. In the browser access the jsynchronous client one of two ways:

```
<script src="/jsynchronous-client.js"></script>

or

import jsynchronous from 'jsynchronous/jsynchronous-client.js';
```

The second method requires a bundler like webpack. With our server ready to .send, now the client must receive it with jsynchronous.onmessage:

```
// Browser side
const socket = io();
socket.on('msg', (data) => jsynchronous.onmessage(data));
```

That's all it takes! View the contents of your synchronized variable on the client:

```
// Browser side
console.log(jsynchronous());
```

Take a look at example sample setups for guidance.

# Stand-In variables

Calling jsynchronous() on the server once without providing a name will create a primary variable. Clients can see the primary synchronized variable by calling jsynchronous() on the client once communication has been established. 

**Calling jsynchronous() BEFORE the variable has been synchronized on the client will result in error!** To avoid this, specify the variable name and an expected type 'array' or 'object':

```
// Browser side
const $matrix = jsynchronous('array');
```

Match the first argument with the type of variable you pass into jsynchronous() on the server, either ‘object’ or ‘array’. $ynced will return as a stand-in variable if the client has not yet completed synchronization. Stand-in variables are just empty arrays or objects at first. When the client is in-sync the stand-in variable will update accordingly.

The alternative to stand-in variables is to wait to call jsynchronous(). You can see which synchronized variables are available at any time by using jsynchronous.list().

# Multiple synchronized variables

Additional calls to jsynchronous() on the server will create additional synchronized variables, but you must name them by passing in name as the second argument:

```
// Server side
const $greetings = jsynchronous({text: 'hello world'}, 'greetings');
```

Retrieve it on the client by referring to its name as the second argument:

```
// Client side
const $greetings = jsynchronous('object', 'greetings');
```

You can see a list of names using jsynchrounous.list();

# Connection interrupts and Resynchronization

There's many reasons why a TCP/IP connection would reset. Losing service, going underground or in an elevator with your phone can cause timeouts, closing your laptop, switching between ethernet wifi or cellular data resets your connections. Sometimes the wifi or the network itself has a hiccup. Many websocket libraries will resume a session after a TCP/IP interrupt, but don't guarantee delivery of messages sent while the tcp/ip connection is down. 

Jsynchronous will ensure synchronization occurs when the user reconnects - no matter how long ago they disconnected. It achieves this by numbering all messages and re-requesting missing ranges – something TCP/IP normally handles... when it isn’t interrupted.

In order to support resynchronization requests, client->server communication is required. You will have to define a client side jsynchronous.send function and make calls to the server side jsynchronous.onmessage(websocket, data). Similar to the earlier set up, but note how server side functions need a websocket passed in.

```
// Browser side 
const socket = io();
socket.on('msg', (data) => jsynchronous.onmessage(data));
jsynchronous.send = (data) => socket.emit('msg', data));
```

```
// Server side
const $ynchronized = jsynchronous(['Quoth', 'the', 'raven', '"Nevermore."']);

jsynchronous.send = (websocket, data) => websocket.emit('msg', data));

io.on('connection', (socket) => {
  $ynchronized.$ync(socket);
  socket.on('disconnect', () => $ynchronized.$unsync(socket));
  socket.on('msg', (data) => jsynchronous.onmessage(socket, data));
});
```

Setting up client->server communication makes your synchronized variables resistant to data loss and desynchronization. By default the client will give you a warning if you don't provide .send on client or .onmessage on server and will halt if messages are missed and no re-synchronization is possible. 

Not all applications need this level of protection and can rely on the guarantees afforded by TCP/IP. Disable client->server communication entirely with the setting {one_way: true} as an option to your call to jsynchronous() on the server. One_way mode works great if you keep the synchronized variable’s initial structure the same and only change primitive values (strings, numbers, booleans) without assigning any new references to objects or arrays. Missing messages will be ignored and jsynchronous will do its best to continue to update properties of already synchronized objects/arrays.

# Rewind mode

Rewind mode is a powerful feature of jsynchronous. Rewind mode lets you 'rewind' to previous snapshots of the data. 

Imagine a chess game. In normal mode it's impossible to step back a few moves to see how the board looked in the past. With rewind mode you can see the board as it looked for any move in the game. Pausing, rewinding, and playing changes forward all become possible using rewind mode.

Normally clients discard the history of changes once they're up to date to save on memory. With rewind mode, clients are given the full history from the very beginning. The history can be applied to the initial state to reconstruct any moment along that history. This is called Event Sourcing. 

Create a snapshot on the server by calling .$napshot() on the synchronized variable:

```
// Server side
const $ynced = jsynchronous([]);

$ynced.push(Math.random());
$ynced.$napshot('one');

$ynced.push(Math.random());
$ynced.$napshot('two');
```

You can rewind to a snapshot by calling .$rewind(name)

```
const previous = $ynced.$rewind('one');
```

Rewind mode can also be useful if your client expects changes in the order they happened regardless of when the client connects to an actively changing state.

Reconstructing the current state can be network and computationally intensive for large histories so take care not to apply an endless number of changes to variables with rewind mode enabled.

# Security and Permissioning

Permissioning in Jsynchronous is easy. Don't call .$ync(websocket) if you don't want that websocket to see the data contained in the synchronized variable.

It's recommended to create additional synchronized variables for different levels of permissioning in your application.

# Events

Watch, listen, trigger events on changes by using .$on('changes', callback) on a synchronized variable:

```
$ynchronized.$on('changes', () => {})
```

This is only available on the client side for now. Future releases will see more types of events and more ways to track changes. Stay tuned!

# Troubleshooting

The most common mistake leaving you wondering why your data is not being communicated is due to making assignments to the data you pass into jsynchronous() instead of the synchronized variable returned by jsynchronous().

```
// Server side
const physics = {x: 0, y: 0, z: 0}
const $ynced = jsynchronous(physics);
physics.x += 10;  // Will not synchronize!
```

To see the changes on the client side the above code will have to modify `$ynced`, not `physics`. Jsynchronous creates a deep copy of the variables you pass into it, forgetting everything about the original data. This is also true when assigning objects or arrays to a synchronized variable:

```
const quaternion = {w: 1, i: 0, j: 0, k: 0}
$ynced.orientation = quaternion;  // Will synchronize
$ynced.orientation.w = 0; // Will synchronize
quaternion.i = 1;  // Will not synchronize
```

Be careful when assigning object and arrays to synchronized variables. ALL of the contents will become visible to clients that are in .$ync().

On the flip side, you can reference a synchronized variable from other parts of your app. Changes to these references WILL synchronize:

```
const $quaternion = $ynced.orientation;
$quaternion.i = 1; // Will synchronize
$quaternion.w = 0; // Will synchronize
```

We recommended you use the prefix ‘$’ or some other convention when you reference a synchronized variable to indicate that assignments to that variable will be sent over the network.

# Reference

## Jsynchronous methods

### send

```
// Server side
jsynchronous.send = (websocket, data) => {}

// Client side
jsynchronous.send = (data) => {}
```

Undefined by default, you must assign it to a function that transmits the data. Websocket will match a value you provided to your calls to a synchronous variable's $ync(websocket) method. 

### onmessage

```
// Server side
jsynchronous.onmessage(websocket, data);

// Browser side
jsynchronous.onmessage(data);
```

A function. It is up to you to call onmessage whenever transmitted data has arrived. 

### list

```
// Server or Browser side
jsynchronous.list();
```

Returns an array of variable names.

### variables

```
// Server or Browser side
jsynchronous.variables();
```

Returns an object with key->value corresponding to name->synchronized variable.

## The Jsynchronous() function call

```
jsynchronous(data, name, options);
```

Creates and returns a synchronized variable. On the client, data must exactly match one of 'array', 'object', [], or {}.

## Options passed to jsynchronous(data, name, options)

`{send: <function>}`

Overrides jsynchronous.send with a synchronized variable specific send function. Default undefined.

`{rewind: true}`

Turns on Rewind mode. See documentation above on rewind mode. Default false.

`{one_way: true}`

Instructs the client to only read data and not transmit any handshakes, heartbeats, or resynchronization requests at the application level. If a gap in network connectivity causes desynchronization, continue processing changes as best as they can. Default false.

`{wait: true}`

Tells jsynchronous to delay synchronization until $tart() is called on the synchronized variable. Default false.

`{buffer_time: <number>}`

Number of milliseconds to wait before transmitting synchronization data to clients. Default 0.

`{history_limit: <number>}`

The maximum size of the history. Rewind mode ignores this number, as rewind mode saves all history. Default 100000.

### Reserved words

Pass any method names available to the synchronized variable as an option key to overwrite that reserved word with the string value you provide. 

For example to change the method name `.$on()` to `__on__()` pass in `{$on: '__on__'}` into the options the call to jsynchronous(). This will overwrite the reserved word on both server and client. Useful if you expect your root variable to contain a key matching an existing reserved word.

## Methods available to root of synchronized variables

```
.$info()
```

Client or server. Returns an object detailing information about this synchronized variable. Useful for debugging.

```
.$ync(websocket)
```

Server only. Adds a client to the list of listeners. Websocket can be a string, number, or an object provided by your websocket library. Websocket must be a value or reference that uniquely identifies the client.

```
.$unsync(websocket)
```

Server only. Removes the websocket from the list of clients.

```
.$copy()
```

Returns a deep copy of the synchronized variable. The returned variable is not synchronized.

```
.$on('changes', callback)
```

Client only. Creates an event listener which triggers callback after each batch of changes. Server events will be available in future releases. 

```
.$on('snapshot', callback)
```

Client only. Creates an event which triggers callback when a snapshot is created. Server events will be available in future releases.

```
.$tart()
```

Server only. Used along side the {wait: true} option in the call to jsynchronous(), tells jsynchronous to start synchronizing the variable to $ync'ed clients.

```
.$listeners()
```

Server only. A list of websockets you passed into calls to .$ync()

```
.$napshot(name)
```

Server only. Creates a snapshot, used in Rewind mode. Name can be a number or a string.

```
.$rewind(name, [counter])
```

Client only. Name can be a number or a string. Returns a non-synchronized variable with the data matching your synchronized variable's data as it looked the moment the snapshot by that name was created. If name is undefined, will rewind to the synchronized variable's numbered change counter. Server side rewind will be available in future releases.

# Frequently asked questions

## Can jsynchronous be used to represent graphs or complex data structures?

Absolutely, Yes. Graphs sparse or dense, trees, linked lists, doubly linked lists, circular and self referential data structures. Neural networks potentially? If JavaScript can represent it, jsynchronous can synchronize it with ease.

In a world of clunky transport stacks with limited expressiveness jsynchronous aims to be a breath of fresh air without limits to what you can use it for.

## Can jsynchronous really be used for games?

For 90% of games Jsynchronous is more than ideal. For quick twitch-speed shooter or fighting game, maybe not. 

TCP/IP, which all browsers and jsynchronous depends on, can see increased latency in packet loss heavy conditions due to head of line blocking. 

If your game does not need millisecond level precision jsynchronous will keep your data perfectly synchronized as fast as the wire will carry it to every client your websockets can handle, which can be many. 

UDP is coming to browsers which is very exciting for fast paced gaming. Unfortunately UDP isn’t suitable for data synchronization because it cannot ensure delivery or ordering making it a non-starter for an accuracy guaranteed library like jsynchronous. 

## Can I do Browser->Server sync?

The best method for securing your application is by building an API or using websockets to communicate browser->server.

It is possible to import the jsynchronous.js server in the browser and write client-side jsynchronous code on your application server. Each browser would have to uniquely name their synchronized variable so the server can distinguish between them. 

For a video games, the game state can sync from server->browser, and the user inputs can sync from browser->server. In this way you can easily have your game loop respond to changes in user input and update the game state for all clients to see.

Any curious scripter can casually modify your synchronized variables on the browser. The jsynchronous server was designed to be operated in a trusted environment, which the browser is not. Your application server must rate limit your websocket, size limit the .onmessage data, and to drop the connection if the data structure doesn't match exactly what you expect. 

## What about bi-directional synchronization, changes on the client side?

Client side is READ ONLY. Jsynchronous is one way sync, NOT bidirectional sync. This may be supported in the future experimentally, however for production workloads it is highly recommended to use an API or websocket commands and have the server change the jsynchronous variables from its side of things.

The reasoning behind this is that it's much harder to secure a client-side data-structure from tampering, injections, DDOSing, or amplification attacks than for the server api/interface to do so. Proxy and getters/setters are a relatively new javascript specification, this library can support very old browsers much easier by not accepting changes from clients.

There are limits to using a reactive data structure like jsynchronous to manage bi-directional requests to change data. Even something as simple as an increment coming from multiple clients simultaneously might get lost in a last-write-wins heuristic because i++ looks the same as i=constant in the eyes of a getter/setter. Some data types may need more expressive operations than 'set' and 'delete'. Operational transforms need to be application, intent, and data-type specific to handle merge-conflicts, even server-><-client conflicts are easier to reason through an API than through a reactive data structure.
