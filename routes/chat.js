const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
const path = require('path');

const { authRequired } = require('../middlewares/auth');
const {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  startConversation,
  deleteConversations,
  uploadVoice,
  registerPushToken,
  unregisterPushToken,
  debugPush,
} = require('../controllers/chatController');

// S3 configuration for voice uploads
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-central-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const voiceUpload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET || 'molo-user-photos',
    acl: 'private',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname) || '.m4a';
      cb(null, `voice/${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: function (req, file, cb) {
    const allowedMimes = ['audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.m4a')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'), false);
    }
  },
});

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

// POST /chats/upload-voice - Загрузить голосовое сообщение
router.post('/chats/upload-voice', authRequired, voiceUpload.single('voice'), uploadVoice);

// POST /chats/push-token - Зарегистрировать FCM токен устройства
router.post('/chats/push-token', authRequired, registerPushToken);

// DELETE /chats/push-token - Удалить FCM токен устройства
router.delete('/chats/push-token', authRequired, unregisterPushToken);

// GET /chats/debug/push/:userId - Проверить токены и отправить тестовый push (без авторизации, только для отладки)
router.get('/chats/debug/push/:userId', debugPush);

module.exports = router;
