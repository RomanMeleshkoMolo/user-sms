const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Перехватываем необработанные ошибки чтобы сервер не падал
// Firebase Admin SDK бросает ошибки через EventEmitter (HTTP/2), которые не ловятся через .catch()
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException (сервер продолжает работу):', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection (сервер продолжает работу):', reason);
});

// Connect database
require('./db');

// Connect RabbitMQ and start notification worker
const { connect: connectRabbitMQ } = require('./rabbitmq');
const { startNotificationWorker } = require('./notificationWorker');
connectRabbitMQ().then(() => startNotificationWorker());

// Connect routers
const chatRoutes = require('../routes/chat');

// Connect Socket.IO manager
const { initSocketIO } = require('./socketManager');

const app = express();
const PORT = process.env.PORT || 6000;

// Trust Nginx proxy so express-rate-limit can read real client IP from X-Forwarded-For
app.set('trust proxy', 1);

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// Rate limiting: не более 60 запросов в минуту на один IP
// Защищает от случайных циклов на клиенте и намеренного флуда
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down' },
});

// Более строгий лимит для отправки сообщений: 30 сообщений в минуту
// Считаем по JWT токену — каждый авторизованный пользователь отдельно
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.headers['authorization'] || 'anonymous',
  skip: (req) => !req.headers['authorization'],
  message: { message: 'Message rate limit exceeded' },
});

app.use('/chats', limiter);
app.use(/\/chats\/.*\/messages$/, messageLimiter);

// Use routes
app.use(chatRoutes);

// Wrap express with http server for Socket.IO
const httpServer = http.createServer(app);

// Initialize Socket.IO
initSocketIO(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`User SMS Service is running on http://localhost:${PORT}`);
});
