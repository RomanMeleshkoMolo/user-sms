const mongoose = require('../src/db');

const messageSchema = new mongoose.Schema({
  // ID беседы
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },

  // Отправитель
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Получатель
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Тип сообщения
  messageType: {
    type: String,
    enum: ['text', 'voice', 'image'],
    default: 'text',
  },

  // Текст сообщения
  text: {
    type: String,
    trim: true,
    default: '',
  },

  // Голосовое сообщение (URL для воспроизведения — presigned, может устареть)
  voiceUrl: {
    type: String,
    default: null,
  },

  // S3 ключ голосового файла — используется для регенерации presigned URL
  voiceKey: {
    type: String,
    default: null,
  },

  // Длительность голосового сообщения (в секундах)
  voiceDuration: {
    type: Number,
    default: null,
  },

  // Nonce для E2E шифрования голосового сообщения (base64)
  voiceNonce: {
    type: String,
    default: null,
  },

  // URL фото (presigned S3)
  photoUrl: {
    type: String,
    default: null,
  },

  // S3 ключ фото — используется для регенерации presigned URL
  photoKey: {
    type: String,
    default: null,
  },

  // Nonce для E2E шифрования фото (base64). Если null — фото не зашифровано
  photoNonce: {
    type: String,
    default: null,
  },

  // Ответ на сообщение
  replyTo: {
    _id: { type: mongoose.Schema.Types.ObjectId },
    text: { type: String },
    senderId: { type: mongoose.Schema.Types.ObjectId },
  },

  // Статус прочтения
  isRead: {
    type: Boolean,
    default: false,
  },

  // Дата прочтения
  readAt: {
    type: Date,
    default: null,
  },

  // Nonce для E2E шифрования (base64). Если null — сообщение не зашифровано
  nonce: {
    type: String,
    default: null,
  },

  // Реакция сердечком (массив ID пользователей)
  heartedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Удалено для конкретных пользователей (Удалить у меня)
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Полностью удалено (Удалить у всех)
  deletedForAll: {
    type: Boolean,
    default: false,
  },

  // Дата создания
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Индексы для быстрого поиска
// Основной индекс для getMessages: фильтрация + сортировка
messageSchema.index({ conversationId: 1, deletedForAll: 1, createdAt: -1 });
// Для markAsRead: receiverId + isRead
messageSchema.index({ conversationId: 1, receiverId: 1, isRead: 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ receiverId: 1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

module.exports = Message;
