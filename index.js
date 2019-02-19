const amqp = require('amqplib');

const WebSocketServer = require('websocket').server;
const http = require('http');

let channel;

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';
// Port where we'll run the websocket server
const webSocketsServerPort = 1337;
/**
 * Global variables
 */
// list of currently connected clients (users)
const clients = [];
/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// Array with some colors
const colors = ['red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange'];
// ... in random order
colors.sort((a, b) => Math.random() > 0.5);
/**
 * HTTP server
 */
const server = http.createServer(() => {
  // Not important for us. We're writing WebSocket server,
  // not HTTP server
});
server.listen(webSocketsServerPort, () => {
  console.log(`${new Date()} Server is listening on port ${
    webSocketsServerPort}`);
});
/**
 * WebSocket server
 */
const wsServer = new WebSocketServer({
  // WebSocket server is tied to a HTTP server. WebSocket
  // request is just an enhanced HTTP request. For more info
  // http://tools.ietf.org/html/rfc6455#page-6
  httpServer: server,
});
// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', async (request) => {
  console.log(`${new Date()} Connection from origin ${request.origin}.`);
  // accept connection - you should check 'request.origin' to
  // make sure that client is connecting from your website
  // (http://en.wikipedia.org/wiki/Same_origin_policy)
  const connection = request.accept(null, request.origin);
  // we need to know client index to remove them on 'close' event
  const index = clients.push(connection) - 1;
  let userName = false;
  let userColor = false;
  console.log(`${new Date()} Connection accepted.`);
  // send back chat history
  http.get('http://localhost:8090/', (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      body = JSON.parse(body);
      connection.sendUTF(
        JSON.stringify(body),
      );
    });
  }).on('error', (e) => {
    console.log('Got an error: ', e);
  });

  // user sent some message
  connection.on('message', (message) => {
    if (message.type === 'utf8') { // accept only text
    // first message sent by user is their name
      if (userName === false) {
        // remember user name
        userName = htmlEntities(message.utf8Data);
        // get random color and send it back to the user
        userColor = colors.shift();
        connection.sendUTF(
          JSON.stringify({ type: 'color', data: userColor }),
        );
        console.log(`${new Date()} User is known as: ${userName} with ${userColor} color.`);
      } else { // log and broadcast the message
        console.log(`${new Date()} Received Message from ${userName}: ${message.utf8Data}`);

        // we want to keep history of all sent messages
        const obj = {
          time: (new Date()).getTime(),
          text: htmlEntities(message.utf8Data),
          author: userName,
          color: userColor,
        };
        channel.publish('chat', '', Buffer.from(JSON.stringify(obj)));
        // broadcast message to all connected clients
        const json = JSON.stringify({ type: 'message', data: obj });
        for (let i = 0; i < clients.length; i += 1) {
          clients[i].sendUTF(json);
        }
      }
    }
  });
  // user disconnected
  connection.on('close', (userConnection) => {
    if (userName !== false && userColor !== false) {
      console.log(`${new Date()} Peer ${userConnection.remoteAddress} disconnected.`);
      // remove user from the list of connected clients
      clients.splice(index, 1);
      // push back user's color to be reused by another user
      colors.push(userColor);
    }
  });
});

(async () => {
  try {
    const amqpConnection = await amqp.connect('amqp://localhost');
    channel = await amqpConnection.createChannel();

    amqpConnection.on('error', (err) => {
      if (err.message !== 'Connection closing') {
        console.error('[AMQP] conn error', err.message);
      }
    });
    amqpConnection.on('close', () => {
      console.error('[AMQP] reconnecting');
    });
    console.log('[AMQP] connected');
  } catch (e) {
    console.error('[AMQP]', e.message);
  }
})();
