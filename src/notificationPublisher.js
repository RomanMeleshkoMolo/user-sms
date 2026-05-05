// src/notificationPublisher.js
const { getChannel } = require('./rabbitmq');

const NOTIFICATION_QUEUE = 'notifications.send';

async function ensureQueue(ch) {
  await ch.assertQueue(NOTIFICATION_QUEUE, { durable: true });
}

async function publishNotification({ userId, title, body, data = {}, retryCount = 0 }) {
  const ch = getChannel();
  if (!ch) {
    console.error('[NotifPublisher] Channel not ready, notification lost:', { userId, title });
    return false;
  }

  await ensureQueue(ch);

  const payload = JSON.stringify({ userId: String(userId), title, body, data, retryCount });
  ch.sendToQueue(NOTIFICATION_QUEUE, Buffer.from(payload), { persistent: true });
  return true;
}

module.exports = { publishNotification, NOTIFICATION_QUEUE };
