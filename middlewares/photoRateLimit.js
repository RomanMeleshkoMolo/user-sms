const Redis = require('ioredis');

// Отдельное соединение: не завязываемся на socketManager, чтобы middleware
// работал независимо от инициализации Socket.IO
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
});
redis.on('error', (e) => console.error('[photoRateLimit] redis error:', e.message));

const DAILY_LIMIT = Number(process.env.CHAT_PHOTO_DAILY_LIMIT) || 30;

/**
 * Лимит загрузок фото в чаты: DAILY_LIMIT штук на пользователя в сутки.
 * Режет расходы на модерацию (Rekognition) и спам. Ставится ПЕРЕД multer,
 * чтобы отклонённый запрос вообще не грузил файл в S3.
 * При недоступном Redis пропускаем (fail-open) — лимит не должен ронять чат.
 */
async function photoRateLimit(req, res, next) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const key = `chat:photo-uploads:${userId}:${day}`;

    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 86400);

    if (count > DAILY_LIMIT) {
      return res.status(429).json({
        message: `Daily photo limit reached (${DAILY_LIMIT})`,
        code: 'PHOTO_DAILY_LIMIT',
      });
    }
    return next();
  } catch (e) {
    console.error('[photoRateLimit] error, skipping limit:', e.message);
    return next();
  }
}

module.exports = { photoRateLimit };