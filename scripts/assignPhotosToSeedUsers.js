/**
 * Скрипт назначает фото из уже существующих (реальных) пользователей
 * seed-пользователям (_isSeedUser: true), у которых userPhoto пустой.
 *
 * Использование:
 *   node scripts/assignPhotosToSeedUsers.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/users';

// ---------- Схемы ----------
const userSchema = new mongoose.Schema({
  name:        String,
  age:         Number,
  userPhoto:   { type: Array, default: [] },
  isOnline:    { type: Boolean, default: false },
  lastSeen:    { type: Date, default: null },
  city:        String,
  userLocation:String,
  publicKey:   { type: String, default: null },
  _isSeedUser: { type: Boolean, default: false },
}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log(`✅  Подключились к ${MONGO_URI}`);

  // Берём всех реальных пользователей у которых есть хотя бы одно фото
  const realUsers = await User.find(
    { _isSeedUser: { $ne: true }, 'userPhoto.0': { $exists: true } },
    { userPhoto: 1, name: 1 }
  );

  if (realUsers.length === 0) {
    console.error('❌  Нет реальных пользователей с фото');
    process.exit(1);
  }

  console.log(`📸  Найдено реальных юзеров с фото: ${realUsers.length}`);

  // Пул фото — первое фото каждого реального пользователя (основной аватар)
  const photoPool = realUsers
    .map(u => u.userPhoto)
    .filter(arr => arr && arr.length > 0);

  // Seed-пользователи без фото
  const seedUsers = await User.find({ _isSeedUser: true, 'userPhoto.0': { $exists: false } });

  console.log(`👥  Seed-пользователей без фото: ${seedUsers.length}`);

  let updated = 0;
  for (let i = 0; i < seedUsers.length; i++) {
    // Берём набор фото по кругу из пула реальных пользователей
    const photos = photoPool[i % photoPool.length];

    await User.findByIdAndUpdate(seedUsers[i]._id, { userPhoto: photos });
    updated++;
  }

  console.log(`\n🎉  Обновлено seed-пользователей: ${updated}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌  Ошибка:', err);
  mongoose.disconnect();
  process.exit(1);
});
