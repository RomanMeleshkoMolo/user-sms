const mongoose = require('../src/db');

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

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
