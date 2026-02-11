/**
 * Push Notification Service - Сервис для отправки push-уведомлений через Firebase Cloud Messaging
 */

const admin = require('firebase-admin');
const DeviceToken = require('../models/deviceTokenModel');

// Инициализация Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    // Проверяем наличие credentials
    if (!process.env.FIREBASE_PROJECT_ID) {
      console.warn('[FCM] Firebase credentials not configured. Push notifications disabled.');
      return;
    }

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log('[FCM] Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('[FCM] Failed to initialize Firebase:', error);
  }
}

// Инициализируем при загрузке модуля
initializeFirebase();

/**
 * Отправить push-уведомление пользователю
 * @param {string} userId - ID получателя
 * @param {object} notification - Данные уведомления
 * @param {string} notification.title - Заголовок
 * @param {string} notification.body - Текст уведомления
 * @param {object} notification.data - Дополнительные данные
 */
async function sendPushToUser(userId, notification) {
  if (!firebaseInitialized) {
    console.log('[FCM] Firebase not initialized, skipping push notification');
    return { success: false, reason: 'firebase_not_initialized' };
  }

  try {
    // Получаем активные токены пользователя
    const tokens = await DeviceToken.find({
      userId: userId,
      isActive: true,
    }).lean();

    if (tokens.length === 0) {
      console.log(`[FCM] No active tokens for user ${userId}`);
      return { success: false, reason: 'no_tokens' };
    }

    const fcmTokens = tokens.map((t) => t.fcmToken);

    // Формируем сообщение
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'molo_messages',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    // Отправляем на все устройства пользователя
    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      ...message,
    });

    console.log(`[FCM] Sent to user ${userId}: ${response.successCount}/${fcmTokens.length} successful`);

    // Обрабатываем неудачные отправки (деактивируем невалидные токены)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          // Токен невалидный или устройство не зарегистрировано
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(fcmTokens[idx]);
          }
          console.log(`[FCM] Failed token: ${errorCode}`);
        }
      });

      // Деактивируем невалидные токены
      if (failedTokens.length > 0) {
        await DeviceToken.updateMany(
          { fcmToken: { $in: failedTokens } },
          { isActive: false, updatedAt: new Date() }
        );
        console.log(`[FCM] Deactivated ${failedTokens.length} invalid tokens`);
      }
    }

    return { success: true, successCount: response.successCount };
  } catch (error) {
    console.error('[FCM] Error sending push notification:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Отправить уведомление о новом сообщении
 * @param {string} recipientId - ID получателя сообщения
 * @param {object} sender - Данные отправителя
 * @param {string} messageText - Текст сообщения
 * @param {string} conversationId - ID беседы
 */
async function sendNewMessageNotification(recipientId, sender, messageText, conversationId) {
  const notification = {
    title: 'Новое сообщение',
    body: `${sender.name || 'Пользователь'}: ${messageText || 'Голосовое сообщение'}`,
    data: {
      type: 'new_message',
      conversationId: conversationId?.toString() || '',
      senderId: sender._id?.toString() || '',
      senderName: sender.name || '',
    },
  };

  return sendPushToUser(recipientId, notification);
}

/**
 * Зарегистрировать FCM токен устройства
 * @param {string} userId - ID пользователя
 * @param {string} fcmToken - FCM токен
 * @param {string} platform - Платформа (android/ios)
 * @param {string} deviceId - ID устройства
 */
async function registerDeviceToken(userId, fcmToken, platform = 'android', deviceId = null) {
  try {
    // Проверяем, есть ли уже такой токен
    const existingToken = await DeviceToken.findOne({ fcmToken });

    if (existingToken) {
      // Обновляем существующий токен
      existingToken.userId = userId;
      existingToken.platform = platform;
      existingToken.deviceId = deviceId;
      existingToken.isActive = true;
      existingToken.updatedAt = new Date();
      await existingToken.save();
      console.log(`[FCM] Updated token for user ${userId}`);
    } else {
      // Создаём новый токен
      await DeviceToken.create({
        userId,
        fcmToken,
        platform,
        deviceId,
        isActive: true,
      });
      console.log(`[FCM] Registered new token for user ${userId}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[FCM] Error registering device token:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Удалить FCM токен устройства
 * @param {string} fcmToken - FCM токен
 */
async function unregisterDeviceToken(fcmToken) {
  try {
    await DeviceToken.deleteOne({ fcmToken });
    console.log('[FCM] Unregistered token');
    return { success: true };
  } catch (error) {
    console.error('[FCM] Error unregistering device token:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushToUser,
  sendNewMessageNotification,
  registerDeviceToken,
  unregisterDeviceToken,
};
