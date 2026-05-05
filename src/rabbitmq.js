// src/rabbitmq.js
const amqplib = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

let connection = null;
let channel = null;

async function connect() {
  try {
    connection = await amqplib.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log('[RabbitMQ] Connected');

    connection.on('error', (err) => console.error('[RabbitMQ] Error:', err.message));
    connection.on('close', () => {
      console.warn('[RabbitMQ] Connection closed, reconnecting in 5s...');
      connection = null;
      channel = null;
      setTimeout(connect, 5000);
    });
  } catch (e) {
    console.error('[RabbitMQ] Connect failed:', e.message, '— retry in 5s');
    setTimeout(connect, 5000);
  }
}

function getChannel() {
  return channel;
}

module.exports = { connect, getChannel };
