const express = require('express');
const router = express.Router();

const { authRequired } = require('../middlewares/auth');
const {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  startConversation,
  deleteConversations,
} = require('../controllers/chatController');

// GET /chats - Получить список всех чатов пользователя
router.get('/chats', authRequired, getConversations);

// GET /chats/start/:recipientId - Начать/получить чат с пользователем
router.get('/chats/start/:recipientId', authRequired, startConversation);

// GET /chats/:recipientId/messages - Получить сообщения чата
router.get('/chats/:recipientId/messages', authRequired, getMessages);

// POST /chats/:recipientId/messages - Отправить сообщение
router.post('/chats/:recipientId/messages', authRequired, sendMessage);

// POST /chats/:conversationId/read - Отметить сообщения как прочитанные
router.post('/chats/:conversationId/read', authRequired, markAsRead);

// DELETE /chats - Удалить чаты
router.delete('/chats', authRequired, deleteConversations);

module.exports = router;
