# Round-Trip Testing

The controlling server creates a synchronized variable, the responding server relays the synchronized variable and any changes back at the controlling server.

This is the idea behind round-trip testing. The controlling server can easily compare the values the synchronized variable and the relayed variable to see if they're equivalent. The relay server does not participate testing beyond being a reliable relay.

Both the controlling server and the relay server have jsynchronous.js and jsynchronous-client.js, and matching synchronized variables. The two servers can run on different machines to test the viability of jsynchronous over the network, or on the same machine for ease.

# Setup
```npm install```

# Usage

```Node test-server.js```

```Node test-client.js```
