const mongoose = require('mongoose');
const { authConn } = require('../src/db');

// Простая модель пользователя для reference в чатах
// Данные пользователей хранятся в user-service, здесь только для populate
const userSchema = new mongoose.Schema({
  name: { type: String },
  age: { type: Number },
  userPhoto: { type: Array, default: [] },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null },
  city: { type: String, default: null },
  userLocation: { type: String, default: null },
  publicKey: { type: String, default: null }, // X25519 public key для E2E шифрования (base64)
});

const User = authConn.models.User || authConn.model('User', userSchema);

module.exports = User;
