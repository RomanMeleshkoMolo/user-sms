const { RekognitionClient, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const region = process.env.AWS_REGION || 'eu-central-1';
const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  : undefined;

const rekognition = new RekognitionClient({ region, credentials });
const s3 = new S3Client({ region, credentials });

// Top-level категории Rekognition, которые блокируем в чате.
// Полный список: https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html
const BLOCKED_CATEGORIES = [
  'Explicit Nudity',
  'Explicit',
  'Non-Explicit Nudity of Intimate parts and Kissing',
  'Violence',
  'Visually Disturbing',
  'Hate Symbols',
];

const MIN_CONFIDENCE = Number(process.env.PHOTO_MODERATION_MIN_CONFIDENCE) || 80;

/**
 * Модерация фото чата через AWS Rekognition DetectModerationLabels.
 *
 * Зашифрованные E2E-файлы (application/octet-stream) проверить невозможно —
 * сервер видит только шифроблоб; такие фото пропускаются (модерация приватных
 * чатов работает через жалобы пользователей).
 *
 * При ошибке AWS (нет IAM-права, недоступен сервис) — fail-open с громким
 * логом: сбой модерации не должен ломать отправку фото целиком.
 *
 * @returns {Promise<{allowed: boolean, labels?: string[], skipped?: string}>}
 */
async function moderateChatPhoto({ bucket, key, mimetype }) {
  if (mimetype === 'application/octet-stream') {
    return { allowed: true, skipped: 'encrypted' };
  }

  try {
    const result = await rekognition.send(new DetectModerationLabelsCommand({
      Image: { S3Object: { Bucket: bucket, Name: key } },
      MinConfidence: MIN_CONFIDENCE,
    }));

    const labels = result.ModerationLabels || [];
    const hit = labels.filter(l =>
      BLOCKED_CATEGORIES.includes(l.ParentName) ||
      BLOCKED_CATEGORIES.includes(l.Name) ||
      BLOCKED_CATEGORIES.includes(l.TaxonomyLevel === 1 ? l.Name : '')
    );

    if (hit.length > 0) {
      const names = hit.map(l => `${l.Name}(${Math.round(l.Confidence)}%)`);
      console.warn(`[moderation] Photo ${key} REJECTED: ${names.join(', ')}`);
      return { allowed: false, labels: names };
    }
    return { allowed: true };
  } catch (e) {
    console.error('[moderation] Rekognition error (fail-open):', e.name, e.message);
    return { allowed: true, skipped: 'error' };
  }
}

/** Удалить отклонённое фото из S3 (не блокируем ответ на ошибке удаления) */
async function deleteRejectedPhoto({ bucket, key }) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`[moderation] Rejected photo deleted from S3: ${key}`);
  } catch (e) {
    console.error('[moderation] Failed to delete rejected photo:', e.message);
  }
}

module.exports = { moderateChatPhoto, deleteRejectedPhoto };