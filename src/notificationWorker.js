// src/notificationWorker.js
const { getChannel } = require('./rabbitmq');
const { publishNotification, NOTIFICATION_QUEUE } = require('./notificationPublisher');
const { sendPushToUser } = require('../services/pushNotificationService');

async function processNotification(msg) {
  const ch = getChannel();
  let data;

  try {
    data = JSON.parse(msg.content.toString());
  } catch {
    ch.ack(msg);
    return;
  }

  const { userId, title, body, data: notifData = {}, retryCount = 0 } = data;

  try {
    const result = await sendPushToUser(userId, { title, body, data: notifData });

    if (result.success || result.reason === 'no_tokens' || result.reason === 'firebase_not_initialized') {
      ch.ack(msg);
      if (result.success) {
        console.log(`[NotifWorker] Sent push to ${userId}: "${title}"`);
      }
      return;
    }

    throw new Error(result.error || result.reason || 'FCM error');
  } catch (e) {
    ch.ack(msg);

    if (retryCount < 2) {
      const delayMs = (retryCount + 1) * 5000; // 5s, 10s
      console.warn(`[NotifWorker] Push failed (attempt ${retryCount + 1}/3), retry in ${delayMs / 1000}s: ${e.message}`);
      setTimeout(() => {
        publishNotification({ userId, title, body, data: notifData, retryCount: retryCount + 1 });
      }, delayMs);
    } else {
      console.error(`[NotifWorker] Gave up after 3 attempts for user ${userId}: ${e.message}`);
    }
  }
}

function startNotificationWorker() {
  const ch = getChannel();
  if (!ch) {
    console.warn('[NotifWorker] Channel not ready, retry in 2s...');
    setTimeout(startNotificationWorker, 2000);
    return;
  }

  ch.assertQueue(NOTIFICATION_QUEUE, { durable: true });
  ch.prefetch(5);
  ch.consume(NOTIFICATION_QUEUE, processNotification);
  console.log('[NotifWorker] Listening on queue:', NOTIFICATION_QUEUE);
}

module.exports = { startNotificationWorker };
