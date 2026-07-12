/**
 * Загружает стикерпак в S3 + upsert метаданных в molo_chat.
 *
 * Использование:
 *   node scripts/uploadStickerPack.js <путь-к-папке-пака>
 *
 * Папка должна содержать manifest.json и перечисленные в нём .webp файлы:
 *
 *   packs/love2024/
 *     manifest.json
 *     kiss.webp
 *     hug.webp
 *
 * manifest.json:
 *   {
 *     "packId":   "love2024",
 *     "name":     "Любовь 2024",
 *     "tabEmoji": "❤️",
 *     "order":    10,
 *     "isPremium": true,
 *     "published": true,
 *     "stickers": [
 *       { "id": "love2024_kiss", "file": "kiss.webp", "caption": "Целую" },
 *       { "id": "love2024_hug",  "file": "hug.webp" }
 *     ]
 *   }
 *
 * Скрипт валидирует манифест (все файлы на месте, webp, id уникальны и
 * префиксованы packId, без path traversal), заливает картинки в
 * S3://<bucket>/stickers/<packId>/<file> с длинным Cache-Control и
 * бампает version пака. Идемпотентен: повторный запуск перезаливает и
 * обновляет документ.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.S3_BUCKET || 'molo-user-photos';
const MAX_STICKER_BYTES = 512 * 1024; // 512 КБ на статичный webp с запасом

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-central-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

function die(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

// RIFF....WEBP — магические байты контейнера webp.
function isWebp(buf) {
  return buf.length > 12
    && buf.toString('ascii', 0, 4) === 'RIFF'
    && buf.toString('ascii', 8, 12) === 'WEBP';
}

function validateManifest(dir) {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) die(`Нет manifest.json в ${dir}`);

  let m;
  try {
    m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    die(`manifest.json невалидный JSON: ${e.message}`);
  }

  if (!m.packId || !/^[a-z0-9_]+$/.test(m.packId)) die('packId обязателен и должен быть [a-z0-9_]');
  if (!m.name) die('name обязателен');
  if (!Array.isArray(m.stickers) || m.stickers.length === 0) die('stickers пуст');

  const seen = new Set();
  for (const s of m.stickers) {
    if (!s.id || !s.file) die(`У стикера нет id/file: ${JSON.stringify(s)}`);
    if (seen.has(s.id)) die(`Дубликат id: ${s.id}`);
    seen.add(s.id);

    // id должен быть префиксован packId — гарантирует глобальную уникальность
    if (!s.id.startsWith(m.packId + '_')) die(`id "${s.id}" должен начинаться с "${m.packId}_"`);
    if (s.id.length > 64) die(`id "${s.id}" длиннее 64 символов (лимит поля message.sticker)`);

    // Защита от path traversal: только basename, никаких '/' и '..'
    if (s.file !== path.basename(s.file)) die(`file "${s.file}" должен быть именем файла без пути`);
    if (!s.file.toLowerCase().endsWith('.webp')) die(`file "${s.file}" должен быть .webp`);

    const abs = path.join(dir, s.file);
    if (!fs.existsSync(abs)) die(`Файл из манифеста отсутствует: ${s.file}`);

    const buf = fs.readFileSync(abs);
    if (!isWebp(buf)) die(`Файл "${s.file}" не является webp (по магическим байтам)`);
    if (buf.length > MAX_STICKER_BYTES) die(`Файл "${s.file}" больше ${MAX_STICKER_BYTES} Б`);
  }

  return m;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) die('Укажи путь к папке пака: node scripts/uploadStickerPack.js packs/love2024');
  if (!fs.existsSync(dir)) die(`Папка не найдена: ${dir}`);

  const m = validateManifest(dir);
  console.log(`✔ Манифест валиден: ${m.packId} — ${m.stickers.length} стикеров`);

  // Заливаем картинки. Публичный не-E2E контент → длинный кеш, immutable.
  const stickers = [];
  for (const s of m.stickers) {
    const key = `stickers/${m.packId}/${s.file}`;
    const body = fs.readFileSync(path.join(dir, s.file));
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    console.log(`  ↑ ${key}`);
    stickers.push({
      id: s.id,
      key,
      caption: s.caption || null,
      width: s.width || null,
      height: s.height || null,
    });
  }

  // Модель использует chatConn из src/db (molo_chat) — подключается на require.
  const StickerPack = require('../models/stickerPackModel');
  const { chatConn } = require('../src/db');
  await chatConn.asPromise();

  const existing = await StickerPack.findOne({ packId: m.packId }).lean();
  const version = existing ? (existing.version || 1) + 1 : 1;

  await StickerPack.updateOne(
    { packId: m.packId },
    {
      $set: {
        name: m.name,
        tabEmoji: m.tabEmoji || '🎁',
        order: m.order ?? 100,
        isPremium: Boolean(m.isPremium),
        published: m.published !== false, // по умолчанию публикуем
        stickers,
        version,
        updatedAt: new Date(),
      },
      $setOnInsert: { packId: m.packId, createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log(`✅ Пак "${m.packId}" сохранён (version=${version}, isPremium=${Boolean(m.isPremium)})`);
  await chatConn.close();
  process.exit(0);
}

main().catch((e) => die(e.message || String(e)));
