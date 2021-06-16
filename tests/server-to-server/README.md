# Basic server-to-server test.
Run "node test-server.js" either locally, or somewhere on the internet with an IP address.
Run "node test-client.js" if local, "node test-client.js --ip 8.8.8.8" providing the proper ip address if remote.
// Profiling the network using http-proxy potentially?

Once websocket communication is established, test-server.js will create a synchronized variable containing the current test number, a value known ahead of time, and a randomly generated hash.

A series of tests progressing from easy to hard will commence. These tests may have data that varies depending on the randomly generated hash. The tests succeed if the client can generate an identical data structure to what the server synchronizes with the hash.

# Round-trip test
Two node.js servers establish a websocket link. They then each set up their own jsynchronous instances, and has the other connect as a client. The test client applies an .on(change) listener on its jsynchronous-client which copies the synchronized data into its jsynchronous instance. From the server's point of view, a change in its synchronized variable should result in a matching change to its jsynchronous-client after a round-trip delay.
