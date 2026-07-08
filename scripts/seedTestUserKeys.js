/**
 * Регистрирует E2E publicKey всем тестовым юзерам, у которых его нет.
 * Без ключа отправка в приватный чат невозможна (клиент и сервер требуют шифрование).
 *
 * Использование: node scripts/seedTestUserKeys.js
 * Приватный ключ сохраняется в scripts/testUserE2EKey.json (один на всех тестовых
 * юзеров — для дев-среды этого достаточно; при необходимости можно расшифровывать
 * их сообщения или отвечать от их имени).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://molo:molopass@localhost:27017/molo_auth?authSource=admin';

async function main() {
  const keyFile = path.join(__dirname, 'testUserE2EKey.json');

  let pair;
  if (fs.existsSync(keyFile)) {
    pair = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
    console.log('Использую существующий тестовый ключ из', keyFile);
  } else {
    // X25519 = кривая nacl.box (tweetnacl на клиенте); raw-ключи совместимы
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    pair = {
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32).toString('base64'),
    };
    fs.writeFileSync(keyFile, JSON.stringify(pair, null, 2));
    console.log('Сгенерирован новый тестовый ключ →', keyFile);
  }

  await mongoose.connect(MONGO_URI);
  const users = mongoose.connection.collection('users');
  const res = await users.updateMany(
    { $or: [{ publicKey: { $exists: false } }, { publicKey: null }] },
    { $set: { publicKey: pair.publicKey } }
  );
  console.log(`publicKey установлен ${res.modifiedCount} юзерам`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
