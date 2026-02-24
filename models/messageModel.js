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

  // Голосовое сообщение
  voiceUrl: {
    type: String,
    default: null,
  },

  // Длительность голосового сообщения (в секундах)
  voiceDuration: {
    type: Number,
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

  // Реакция сердечком (массив ID пользователей)
  heartedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Дата создания
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Индексы для быстрого поиска
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ receiverId: 1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

module.exports = Message;
