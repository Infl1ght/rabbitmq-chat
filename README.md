# rabbitmq-chat
Simple chat powered by RabbitMQ.
Based on [this chat](https://gist.github.com/martinsik/2031681). History of the chat moved to separate service.
## Installation
1. Install [RabbitMQ](https://www.rabbitmq.com/download.html)
2. Install [Redis](https://redis.io/download)
3. Clone this project
## Run
Run with node two files: index.js and historyService.js. Then open frontend.html with your favorite web-browser. That's it!
## About architecture
The application has very simple architecture: only two microservices (chat server and message history) integrated by RabbitMQ. Chat history stored in Redis.

