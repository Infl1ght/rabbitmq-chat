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
const colors = ['red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange'];
colors.sort((a, b) => Math.random() > 0.5);
/**
 * HTTP server
 */
const server = http.createServer(() => {
});
server.listen(webSocketsServerPort, () => {
  console.log(`${new Date()} Server is listening on port ${
    webSocketsServerPort}`);
});

const wsServer = new WebSocketServer({
  httpServer: server,
});
wsServer.on('request', async (request) => {
  console.log(`${new Date()} Connection from origin ${request.origin}.`);
  const connection = request.accept(null, request.origin);
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
    channel.assertQueue('chat', { exclusive: true });

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
