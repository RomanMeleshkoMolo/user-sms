const mongoose = require('../src/db');

/**
 * DeviceToken - Модель для хранения FCM токенов устройств
 */
const deviceTokenSchema = new mongoose.Schema({
  // ID пользователя
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // FCM токен устройства
  fcmToken: {
    type: String,
    required: true,
  },

  // Платформа устройства
  platform: {
    type: String,
    enum: ['android', 'ios'],
    default: 'android',
  },

  // ID устройства (для уникальной идентификации)
  deviceId: {
    type: String,
    default: null,
  },

  // Активен ли токен
  isActive: {
    type: Boolean,
    default: true,
  },

  // Дата создания
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // Дата последнего обновления
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Индекс для быстрого поиска токенов пользователя
deviceTokenSchema.index({ userId: 1, isActive: 1 });

// Уникальный индекс для токена
deviceTokenSchema.index({ fcmToken: 1 }, { unique: true });

const DeviceToken = mongoose.models.DeviceToken || mongoose.model('DeviceToken', deviceTokenSchema);

module.exports = DeviceToken;
