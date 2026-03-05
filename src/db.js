const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/molo_users';

mongoose.connect(MONGO_URI, {
  maxPoolSize: 50,        // до 50 параллельных соединений с MongoDB
  minPoolSize: 5,         // минимум 5 соединений держать открытыми
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('[user-sms] MongoDB connected'))
  .catch((err) => console.error('[user-sms] MongoDB connection error:', err));

module.exports = mongoose;
