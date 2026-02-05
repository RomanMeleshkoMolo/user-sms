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
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  },

  // Количество непрочитанных сообщений для каждого участника
  unreadCount: {
    type: Map,
    of: Number,
    default: {},
  },

  // Дата создания и обновления
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Индекс для быстрого поиска чатов пользователя
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
