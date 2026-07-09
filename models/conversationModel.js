const mongoose = require('mongoose');
const { chatConn } = require('../src/db');

const conversationSchema = new mongoose.Schema({
  // Участники чата (2 пользователя)
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],

  // Последнее сообщение для превью
  lastMessage: {
    text: { type: String, default: '' },
    nonce: { type: String, default: null },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
  },

  // Количество непрочитанных сообщений для каждого участника
  unreadCount: {
    type: Map,
    of: Number,
    default: {},
  },

  // Приватный чат (E2E шифрование, не модерируется)
  isPrivate: { type: Boolean, default: false },

  // Статус приватного чата: 'pending' — запрос отправлен, ждёт согласия
  // получателя; 'active' — согласие получено, чат работает. Обычные (не
  // приватные) чаты всегда 'active'.
  status: { type: String, enum: ['active', 'pending'], default: 'active' },

  // Кто инициировал приватный чат (отправил запрос). Нужно для направления
  // запроса и адресата уведомлений accepted/declined.
  initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Пользователи, для которых чат "удалён" (soft-delete при переустановке)
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Дата создания и обновления
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Составной индекс для getConversations: find({ participants }).sort({ updatedAt: -1 })
conversationSchema.index({ participants: 1, updatedAt: -1 });
// Уникальная пара участников — запрет дублирующих чатов между одними юзерами
conversationSchema.index({ participants: 1 }, { unique: false });

const Conversation = chatConn.models.Conversation || chatConn.model('Conversation', conversationSchema);

module.exports = Conversation;
