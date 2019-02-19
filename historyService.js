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

(async () => {
  try {
    const amqpConnection = await amqp.connect('amqp://localhost');
    channel = await amqpConnection.createChannel();
    channel.assertExchange('chat', 'fanout');
    const { queue } = await channel.assertQueue('chat_history');
    channel.bindQueue(queue, 'chat');
    channel.consume(queue, (msg) => {
      const content = msg.content.toString();
      console.log(`Saving message: ${content}`);
      redisClient.lpush('messages', content, (err) => {
        if (!err) channel.ack(msg);
      });
    });
  } catch (e) {
    console.error('[AMQP]', e.message);
  }
})();
