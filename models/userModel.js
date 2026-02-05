const mongoose = require('../src/db');

// Простая модель пользователя для reference в чатах
// Данные пользователей хранятся в user-service, здесь только для populate
const userSchema = new mongoose.Schema({
  name: { type: String },
  age: { type: Number },
  userPhoto: { type: Array, default: [] },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
