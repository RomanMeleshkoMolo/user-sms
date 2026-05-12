const mongoose = require('mongoose');
require('dotenv').config();

const AUTH_MONGO_URI = process.env.AUTH_MONGO_URI || 'mongodb://localhost:27017/molo_auth';
const CHAT_MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/molo_chat';

const authConn = mongoose.createConnection(AUTH_MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

const chatConn = mongoose.createConnection(CHAT_MONGO_URI, {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

authConn.on('connected', () => console.log('[user-sms] authConn connected → molo_auth'));
authConn.on('error', (err) => console.error('[user-sms] authConn error:', err));

chatConn.on('connected', () => console.log('[user-sms] chatConn connected → molo_chat'));
chatConn.on('error', (err) => console.error('[user-sms] chatConn error:', err));

module.exports = { authConn, chatConn };
