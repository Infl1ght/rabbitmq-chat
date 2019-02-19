const redis = require('redis');
const amqp = require('amqplib');
const http = require('http');

const redisClient = redis.createClient();

http.createServer((req, res) => {
  res.writeHead(200);
  redisClient.lrange('messages', 0, 99, (err, reply) => {
    res.write(JSON.stringify({ type: 'history', data: reply }));
    res.end();
  });
}).listen(8090);

let channel;
let queue;

amqp
  .connect('amqp://localhost')
  .then(conn => conn.createChannel())
  .then((ch) => {
    channel = ch;
    return channel.assertExchange('chat', 'fanout');
  })
  .then(() => channel.assertQueue('chat_history'))
  .then((q) => {
    queue = q.queue;
    return channel.bindQueue(queue, 'chat');
  })
  .then(() => channel.consume(queue, (msg) => {
    const content = msg.content.toString();
    console.log(`Saving message: ${content}`);
    redisClient.lpush('messages', content, (err) => {
      if (!err) channel.ack(msg);
    });
  }))
  .catch(err => console.log(err));
