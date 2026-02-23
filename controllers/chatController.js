const mongoose = require('mongoose');
const Conversation = require('../models/conversationModel');
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const {
  sendNewMessageNotification,
  sendPushToUser,
  registerDeviceToken,
  unregisterDeviceToken,
} = require('../services/pushNotificationService');
const DeviceToken = require('../models/deviceTokenModel');
const { emitToUser } = require('../src/socketManager');

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION || 'eu-central-1';
const BUCKET = process.env.S3_BUCKET || 'molo-user-photos';
const PRESIGNED_TTL_SEC = Number(process.env.S3_GET_TTL_SEC || 3600);

const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

// Генерация presigned URL для S3
async function getPhotoUrl(key) {
  if (!key) return null;
  try {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return await getSignedUrl(s3, cmd, { expiresIn: PRESIGNED_TTL_SEC });
  } catch (e) {
    console.error('[chat] getPhotoUrl error:', e);
    return null;
  }
}

// Получить userId из запроса
function getReqUserId(req) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.auth?.userId ||
    req.regUserId ||
    req.userId
  );
}

/**
 * GET /chats - Получить список всех чатов пользователя
 */
async function getConversations(req, res) {
  try {
    const userId = getReqUserId(req);

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Получаем все чаты пользователя
    const conversations = await Conversation.find({
      participants: userObjectId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    // Обогащаем данными о собеседнике
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Находим собеседника (другого участника)
        const otherParticipantId = conv.participants.find(
          (p) => p.toString() !== userId.toString()
        );

        let otherUser = null;
        let photoUrl = null;
        if (otherParticipantId) {
          otherUser = await User.findById(otherParticipantId)
            .select('name age userPhoto isOnline lastSeen city userLocation')
            .lean();

          // Получаем presigned URL для фото
          if (otherUser?.userPhoto?.[0]) {
            const photoKey = typeof otherUser.userPhoto[0] === 'object'
              ? otherUser.userPhoto[0].key
              : otherUser.userPhoto[0];
            photoUrl = await getPhotoUrl(photoKey);
          }
        }

        // Получаем количество непрочитанных для текущего пользователя
        // После .lean() Map превращается в обычный объект
        const unreadCount = conv.unreadCount?.[userId.toString()] || 0;

        return {
          _id: conv._id,
          otherUser: otherUser ? {
            _id: otherUser._id,
            name: otherUser.name,
            age: otherUser.age,
            photo: photoUrl,
            city: otherUser.city || otherUser.userLocation || null,
            isOnline: otherUser.isOnline || false,
            lastSeen: otherUser.lastSeen,
          } : null,
          lastMessage: conv.lastMessage,
          unreadCount,
          updatedAt: conv.updatedAt,
        };
      })
    );

    console.log(`[chat] getConversations for user ${userId}: found ${enrichedConversations.length}`);

    return res.json({ conversations: enrichedConversations });
  } catch (e) {
    console.error('[chat] getConversations error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * GET /chats/:recipientId/messages - Получить сообщения чата
 */
async function getMessages(req, res) {
  try {
    const userId = getReqUserId(req);
    const { recipientId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 30));
    const skip = (page - 1) * limit;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!recipientId || !mongoose.Types.ObjectId.isValid(String(recipientId))) {
      return res.status(400).json({ message: 'Invalid recipient id' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);

    // Ищем или создаём беседу
    let conversation = await Conversation.findOne({
      participants: { $all: [userObjectId, recipientObjectId] },
    });

    if (!conversation) {
      // Чат ещё не существует - возвращаем пустой массив
      return res.json({
        messages: [],
        conversationId: null,
        page,
        hasMore: false,
      });
    }

    // Получаем сообщения
    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

    // Разворачиваем для хронологического порядка
    messagesToReturn.reverse();

    console.log(`[chat] getMessages for conversation ${conversation._id}: found ${messagesToReturn.length}`);

    return res.json({
      messages: messagesToReturn,
      conversationId: conversation._id,
      page,
      hasMore,
    });
  } catch (e) {
    console.error('[chat] getMessages error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * POST /chats/:recipientId/messages - Отправить сообщение
 */
async function sendMessage(req, res) {
  try {
    const userId = getReqUserId(req);
    const { recipientId } = req.params;
    const { text, replyTo, messageType = 'text', voiceUrl, voiceDuration } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!recipientId || !mongoose.Types.ObjectId.isValid(String(recipientId))) {
      return res.status(400).json({ message: 'Invalid recipient id' });
    }

    // Проверка контента в зависимости от типа сообщения
    if (messageType === 'text') {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ message: 'Message text is required' });
      }
    } else if (messageType === 'voice') {
      if (!voiceUrl) {
        return res.status(400).json({ message: 'Voice URL is required' });
      }
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);
    const messageText = text ? text.trim() : '';

    // Подготовка данных replyTo
    let replyToData = null;
    if (replyTo && replyTo._id && replyTo.text) {
      replyToData = {
        _id: new mongoose.Types.ObjectId(replyTo._id),
        text: replyTo.text,
        senderId: replyTo.senderId ? new mongoose.Types.ObjectId(replyTo.senderId) : null,
      };
    }

    // Ищем или создаём беседу
    let conversation = await Conversation.findOne({
      participants: { $all: [userObjectId, recipientObjectId] },
    });

    // Текст для превью в списке чатов
    const previewText = messageType === 'voice' ? '🎤 Голосовое сообщение' : messageText;

    if (!conversation) {
      // Создаём новую беседу
      conversation = await Conversation.create({
        participants: [userObjectId, recipientObjectId],
        lastMessage: {
          text: previewText,
          senderId: userObjectId,
          createdAt: new Date(),
        },
        unreadCount: new Map(),
      });
      console.log(`[chat] Created new conversation ${conversation._id}`);
    }

    // Создаём сообщение
    const messageData = {
      conversationId: conversation._id,
      senderId: userObjectId,
      receiverId: recipientObjectId,
      messageType,
      text: messageText,
      replyTo: replyToData,
    };

    // Добавляем данные голосового сообщения
    if (messageType === 'voice') {
      messageData.voiceUrl = voiceUrl;
      messageData.voiceDuration = voiceDuration || 0;
    }

    const message = await Message.create(messageData);

    // Обновляем беседу
    const currentUnread = conversation.unreadCount?.get?.(recipientId.toString()) || 0;
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: {
        text: previewText,
        senderId: userObjectId,
        createdAt: message.createdAt,
      },
      [`unreadCount.${recipientId}`]: currentUnread + 1,
      updatedAt: new Date(),
    });

    console.log(`[chat] ${messageType} message sent from ${userId} to ${recipientId}`);

    // Отправляем push-уведомление получателю
    const sender = await User.findById(userObjectId).select('name').lean();
    sendNewMessageNotification(
      recipientId,
      { _id: userObjectId, name: sender?.name },
      previewText,
      conversation._id
    ).catch((err) => console.error('[chat] Push notification error:', err));

    // Отправляем real-time уведомление через Socket.IO
    const messagePayload = {
      _id: message._id,
      conversationId: conversation._id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      messageType: message.messageType,
      text: message.text,
      voiceUrl: message.voiceUrl || null,
      voiceDuration: message.voiceDuration || null,
      replyTo: message.replyTo || null,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
    emitToUser(recipientId, 'new_message', {
      message: messagePayload,
      senderId: String(userId),
    });

    return res.status(201).json({
      success: true,
      message: messagePayload,
    });
  } catch (e) {
    console.error('[chat] sendMessage error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * POST /chats/:conversationId/read - Отметить сообщения как прочитанные
 */
async function markAsRead(req, res) {
  try {
    const userId = getReqUserId(req);
    const { conversationId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!conversationId || !mongoose.Types.ObjectId.isValid(String(conversationId))) {
      return res.status(400).json({ message: 'Invalid conversation id' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const convObjectId = new mongoose.Types.ObjectId(conversationId);

    // Обновляем все непрочитанные сообщения
    await Message.updateMany(
      {
        conversationId: convObjectId,
        receiverId: userObjectId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    // Сбрасываем счётчик непрочитанных
    await Conversation.findByIdAndUpdate(convObjectId, {
      [`unreadCount.${userId}`]: 0,
    });

    console.log(`[chat] Marked messages as read for user ${userId} in conversation ${conversationId}`);

    return res.json({ success: true });
  } catch (e) {
    console.error('[chat] markAsRead error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * GET /chats/start/:recipientId - Начать/получить чат с пользователем
 * Используется при переходе из профиля в чат
 */
async function startConversation(req, res) {
  try {
    const userId = getReqUserId(req);
    const { recipientId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!recipientId || !mongoose.Types.ObjectId.isValid(String(recipientId))) {
      return res.status(400).json({ message: 'Invalid recipient id' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);

    // Ищем существующую беседу
    let conversation = await Conversation.findOne({
      participants: { $all: [userObjectId, recipientObjectId] },
    });

    // Если нет - создаём пустую
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userObjectId, recipientObjectId],
      });
      console.log(`[chat] Created new conversation ${conversation._id}`);
    }

    // Получаем данные собеседника
    const otherUser = await User.findById(recipientObjectId)
      .select('name age userPhoto isOnline lastSeen city userLocation')
      .lean();

    // Получаем presigned URL для фото
    let photoUrl = null;
    if (otherUser?.userPhoto?.[0]) {
      const photoKey = typeof otherUser.userPhoto[0] === 'object'
        ? otherUser.userPhoto[0].key
        : otherUser.userPhoto[0];
      photoUrl = await getPhotoUrl(photoKey);
    }

    return res.json({
      conversationId: conversation._id,
      otherUser: otherUser ? {
        _id: otherUser._id,
        name: otherUser.name,
        age: otherUser.age,
        photo: photoUrl,
        city: otherUser.city || otherUser.userLocation || null,
        isOnline: otherUser.isOnline || false,
        lastSeen: otherUser.lastSeen,
      } : null,
    });
  } catch (e) {
    console.error('[chat] startConversation error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * DELETE /chats - Удалить чаты
 */
async function deleteConversations(req, res) {
  try {
    const userId = getReqUserId(req);
    const { conversationIds } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({ message: 'No conversation IDs provided' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Проверяем, что пользователь участник этих чатов
    const validConversationIds = [];
    for (const convId of conversationIds) {
      if (!mongoose.Types.ObjectId.isValid(String(convId))) continue;

      const conversation = await Conversation.findOne({
        _id: new mongoose.Types.ObjectId(convId),
        participants: userObjectId,
      });

      if (conversation) {
        validConversationIds.push(conversation._id);
      }
    }

    if (validConversationIds.length === 0) {
      return res.status(404).json({ message: 'No valid conversations found' });
    }

    // Удаляем сообщения из этих чатов
    await Message.deleteMany({
      conversationId: { $in: validConversationIds },
    });

    // Удаляем сами чаты
    await Conversation.deleteMany({
      _id: { $in: validConversationIds },
    });

    console.log(`[chat] Deleted ${validConversationIds.length} conversations for user ${userId}`);

    return res.json({ success: true, deletedCount: validConversationIds.length });
  } catch (e) {
    console.error('[chat] deleteConversations error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * POST /chats/upload-voice - Загрузить голосовое сообщение
 */
async function uploadVoice(req, res) {
  try {
    const userId = getReqUserId(req);

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No voice file uploaded' });
    }

    // Генерируем presigned URL для загруженного файла
    const voiceKey = req.file.key;
    const voiceUrl = await getPhotoUrl(voiceKey);

    console.log(`[chat] Voice uploaded by user ${userId}: ${voiceKey}`);

    return res.json({
      success: true,
      voiceKey,
      voiceUrl,
    });
  } catch (e) {
    console.error('[chat] uploadVoice error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * POST /chats/push-token - Зарегистрировать FCM токен устройства
 */
async function registerPushToken(req, res) {
  try {
    const userId = getReqUserId(req);
    const { fcmToken, platform, deviceId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!fcmToken) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const result = await registerDeviceToken(userId, fcmToken, platform, deviceId);

    if (result.success) {
      console.log(`[chat] Push token registered for user ${userId}`);
      return res.json({ success: true });
    } else {
      return res.status(500).json({ message: 'Failed to register token', error: result.error });
    }
  } catch (e) {
    console.error('[chat] registerPushToken error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * DELETE /chats/push-token - Удалить FCM токен устройства
 */
async function unregisterPushToken(req, res) {
  try {
    const userId = getReqUserId(req);
    const { fcmToken } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!fcmToken) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const result = await unregisterDeviceToken(fcmToken);

    if (result.success) {
      console.log(`[chat] Push token unregistered for user ${userId}`);
      return res.json({ success: true });
    } else {
      return res.status(500).json({ message: 'Failed to unregister token', error: result.error });
    }
  } catch (e) {
    console.error('[chat] unregisterPushToken error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * GET /chats/debug/push/:userId - Проверить FCM токены и отправить тестовый push (без авторизации, только для отладки)
 */
async function debugPush(req, res) {
  try {
    const userId = req.params.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    // Найти все токены пользователя
    const tokens = await DeviceToken.find({ userId }).lean();

    // Попробовать отправить тестовый push
    let pushResult = null;
    if (tokens.some(t => t.isActive)) {
      pushResult = await sendPushToUser(userId, {
        title: 'Тест FCM ✅',
        body: 'Push уведомления работают!',
        data: { type: 'test' },
      });
    } else {
      pushResult = { success: false, reason: 'no_active_tokens' };
    }

    return res.json({
      userId,
      tokenCount: tokens.length,
      activeTokenCount: tokens.filter(t => t.isActive).length,
      tokens: tokens.map(t => ({
        platform: t.platform,
        isActive: t.isActive,
        tokenPreview: t.fcmToken?.substring(0, 20) + '...',
        createdAt: t.createdAt,
      })),
      pushResult,
    });
  } catch (e) {
    console.error('[chat] debugPush error:', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
}

module.exports = {
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
};
