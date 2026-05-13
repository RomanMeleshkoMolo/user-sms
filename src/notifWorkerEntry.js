require('dotenv').config();
require('./db');

const { connect: connectRabbitMQ } = require('./rabbitmq');
const { startNotificationWorker } = require('./notificationWorker');

connectRabbitMQ().then(() => startNotificationWorker());
