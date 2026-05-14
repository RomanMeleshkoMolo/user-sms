/**
 * seedTestData.js — создаёт тестовые чаты + гостей профиля из реальных юзеров molo_auth
 *
 * Использование:
 *   MY_USER_ID=<ObjectId> node scripts/seedTestData.js
 *
 * Опции:
 *   CHAT_COUNT=20      — кол-во чатов (по умолчанию 20)
 *   MSG_COUNT=15       — сообщений на чат (по умолчанию 15)
 *   GUEST_COUNT=30     — гостей профиля (по умолчанию 30)
 *   CLEAN=true         — очистить seed-данные (чаты и гостей) перед запуском
 *
 * Базы данных:
 *   molo_auth    — берёт реальных seeded-юзеров (с фото)
 *   molo_chat    — создаёт conversations + messages
 *   molo_profile — создаёт guestviews
 */

const mongoose = require('mongoose');

const MY_USER_ID  = process.env.MY_USER_ID;
const CHAT_COUNT  = parseInt(process.env.CHAT_COUNT  || '20', 10);
const MSG_COUNT   = parseInt(process.env.MSG_COUNT   || '15', 10);
const GUEST_COUNT = parseInt(process.env.GUEST_COUNT || '30', 10);
const CLEAN       = process.env.CLEAN === 'true';

if (!MY_USER_ID || !mongoose.Types.ObjectId.isValid(MY_USER_ID)) {
  console.error('❌  Укажи MY_USER_ID=<ObjectId>');
  process.exit(1);
}

const AUTH_URI    = process.env.AUTH_MONGO_URI    || 'mongodb://localhost:27017/molo_auth';
const CHAT_URI    = process.env.MONGO_URI          || 'mongodb://localhost:27017/molo_chat';
const PROFILE_URI = process.env.PROFILE_MONGO_URI  || 'mongodb://localhost:27017/molo_profile';

// ── inline-схемы (не тянем src/db.js, чтобы скрипт был автономным) ──

function makeAuthConn() {
  return mongoose.createConnection(AUTH_URI);
}
function makeChatConn() {
  return mongoose.createConnection(CHAT_URI);
}
function makeProfileConn() {
  return mongoose.createConnection(PROFILE_URI);
}

// ── фразы ──
const PHRASES = [
  'Привет! Как дела?', 'Всё хорошо, спасибо 😊', 'Чем занимаешься?',
  'Ничего особенного, отдыхаю', 'Слушай, давно хотел спросить...',
  'Ты сегодня свободна?', 'Может встретимся на выходных?', 'Звучит отлично!',
  'Как прошёл твой день?', 'Устала немного, но всё ок',
  'Смотрела что-нибудь интересное?', 'Да, новый сезон очень крутой',
  'Расскажи подробнее!', 'Там такой поворот в конце 😱',
  'Не спойли мне! Я ещё не досмотрел 😅', 'Ладно, удачи!',
  'Спасибо ❤️', 'Пока пока!', 'До завтра 👋', 'Жду!',
  'Кстати, погода сегодня просто замечательная', 'Да, тепло наконец-то',
  'Хочешь прогуляться сейчас?', 'Почему бы и нет, давай!',
  'Встречаемся через час?', 'Ок, пиши когда выходишь',
  'Уже выхожу!', 'Жду тебя у фонтана', 'Иду, минут 10',
  'Уже вижу тебя, привет! 👋', 'Куда планируешь?',
  'Может море?', 'О, завидую! Давно не была', 'Поехали вместе!',
  'Это была бы идея 😃', 'Окей, обсудим в эти выходные', 'Договорились 🤝',
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr)      => arr[rand(0, arr.length - 1)];

async function main() {
  const authConn    = makeAuthConn();
  const chatConn    = makeChatConn();
  const profileConn = makeProfileConn();

  await Promise.all([
    authConn.asPromise(),
    chatConn.asPromise(),
    profileConn.asPromise(),
  ]);
  console.log('✅  Подключились к molo_auth, molo_chat, molo_profile');

  // ── Модели ──
  const userSchema = new mongoose.Schema({}, { strict: false });
  const AuthUser = authConn.model('User', userSchema);

  const conversationSchema = new mongoose.Schema({
    participants:  [mongoose.Schema.Types.ObjectId],
    lastMessage:   { type: Object, default: {} },
    unreadCount:   { type: Map, of: Number, default: {} },
    isPrivate:     { type: Boolean, default: false },
    deletedFor:    [mongoose.Schema.Types.ObjectId],
    _isSeed:       { type: Boolean, default: false },
    createdAt:     { type: Date, default: Date.now },
    updatedAt:     { type: Date, default: Date.now },
  });
  const Conversation = chatConn.model('Conversation', conversationSchema);

  const messageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderId:       { type: mongoose.Schema.Types.ObjectId, required: true },
    receiverId:     { type: mongoose.Schema.Types.ObjectId, required: true },
    messageType:    { type: String, default: 'text' },
    text:           { type: String, default: '' },
    isRead:         { type: Boolean, default: false },
    readAt:         { type: Date, default: null },
    nonce:          { type: String, default: null },
    heartedBy:      [mongoose.Schema.Types.ObjectId],
    deletedFor:     [mongoose.Schema.Types.ObjectId],
    deletedForAll:  { type: Boolean, default: false },
    _isSeed:        { type: Boolean, default: false },
    createdAt:      { type: Date, default: Date.now },
  });
  const Message = chatConn.model('Message', messageSchema);

  const guestSchema = new mongoose.Schema({
    viewerId:       { type: mongoose.Schema.Types.ObjectId, required: true },
    profileOwnerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    viewerName:     { type: String, default: '' },
    viewerPhoto:    { type: String, default: null },
    viewerGender:   { type: String, default: '' },
    viewedAt:       { type: Date, default: Date.now },
  });
  guestSchema.index({ viewerId: 1, profileOwnerId: 1 }, { unique: true });
  const GuestView = profileConn.model('GuestView', guestSchema);

  const myId = new mongoose.Types.ObjectId(MY_USER_ID);

  // ── Очистка seed-данных ──
  if (CLEAN) {
    console.log('🧹  Удаляю seed-данные...');
    const seedConvs = await Conversation.find({ _isSeed: true }).select('_id');
    const convIds   = seedConvs.map(c => c._id);
    const delMsgs   = await Message.deleteMany({ _isSeed: true });
    const delConvs  = await Conversation.deleteMany({ _isSeed: true });
    const delGuests = await GuestView.deleteMany({ profileOwnerId: myId });
    console.log(`   Сообщений: ${delMsgs.deletedCount}, Чатов: ${delConvs.deletedCount}, Гостей: ${delGuests.deletedCount}`);
    await Promise.all([authConn.close(), chatConn.close(), profileConn.close()]);
    console.log('✅  Очищено');
    return;
  }

  // ── Берём реальных юзеров из molo_auth ──
  const users = await AuthUser.find(
    { _id: { $ne: myId }, 'userPhoto.0': { $exists: true } },
    { _id: 1, name: 1, userPhoto: 1, gender: 1, isOnline: 1, lastSeen: 1 }
  ).lean().limit(Math.max(CHAT_COUNT, GUEST_COUNT) + 10);

  if (users.length === 0) {
    console.error('❌  Нет юзеров с фото в molo_auth. Запусти сидирование юзеров сначала.');
    await Promise.all([authConn.close(), chatConn.close(), profileConn.close()]);
    process.exit(1);
  }
  console.log(`👥  Найдено ${users.length} юзеров с фото`);

  // Перемешиваем юзеров
  const shuffled = [...users].sort(() => Math.random() - 0.5);

  // ── 1. Чаты и сообщения ──
  const chatUsers = shuffled.slice(0, CHAT_COUNT);
  let totalMsgs   = 0;
  const now       = Date.now();

  console.log(`\n💬  Создаю ${chatUsers.length} чатов...`);
  for (let ci = 0; ci < chatUsers.length; ci++) {
    const other = chatUsers[ci];
    const otherId = new mongoose.Types.ObjectId(other._id);

    // Проверяем, нет ли уже чата между этими двумя
    const existing = await Conversation.findOne({
      participants: { $all: [myId, otherId], $size: 2 },
    });
    if (existing) {
      console.log(`   [${ci + 1}] Чат с ${other.name} уже существует, пропускаем`);
      continue;
    }

    const convCreatedAt = new Date(now - rand(1, 30) * 24 * 60 * 60 * 1000);

    const conv = await Conversation.create({
      participants: [myId, otherId],
      isPrivate: false,
      unreadCount: { [myId.toString()]: rand(0, 5) },
      _isSeed: true,
      createdAt: convCreatedAt,
      updatedAt: convCreatedAt,
    });

    // Сообщения
    const msgCount = rand(Math.max(1, MSG_COUNT - 5), MSG_COUNT + 5);
    const msgs     = [];
    let lastDate   = new Date(convCreatedAt);

    for (let mi = 0; mi < msgCount; mi++) {
      lastDate = new Date(lastDate.getTime() + rand(60, 900) * 1000);
      if (lastDate > new Date()) lastDate = new Date(now - rand(0, 300) * 1000);

      const fromMe     = Math.random() > 0.4;
      const senderId   = fromMe ? myId : otherId;
      const receiverId = fromMe ? otherId : myId;

      msgs.push({
        conversationId: conv._id,
        senderId,
        receiverId,
        messageType: 'text',
        text: pick(PHRASES),
        isRead: mi < msgCount - rand(0, 4),
        _isSeed: true,
        createdAt: new Date(lastDate),
      });
    }

    await Message.insertMany(msgs);
    totalMsgs += msgs.length;

    const last = msgs[msgs.length - 1];
    await Conversation.findByIdAndUpdate(conv._id, {
      lastMessage: {
        text:      last.text,
        senderId:  last.senderId,
        createdAt: last.createdAt,
        isRead:    last.isRead,
      },
      updatedAt: last.createdAt,
    });

    if ((ci + 1) % 5 === 0 || ci === chatUsers.length - 1) {
      process.stdout.write(`   [${ci + 1}/${chatUsers.length}] чатов создано\r`);
    }
  }
  console.log(`\n   Итого сообщений: ${totalMsgs}`);

  // ── 2. Гости профиля ──
  const guestUsers  = shuffled.slice(0, GUEST_COUNT);
  const guestDocs   = [];
  let   skipped     = 0;

  console.log(`\n👁️   Создаю ${guestUsers.length} гостей профиля...`);

  // Удаляем старых seed-гостей для этого юзера
  await GuestView.deleteMany({ profileOwnerId: myId });

  for (let gi = 0; gi < guestUsers.length; gi++) {
    const user = guestUsers[gi];

    const photo =
      user.userPhoto?.find(p => p.status === 'approved')?.url ||
      user.userPhoto?.[0]?.url ||
      null;

    guestDocs.push({
      viewerId:       new mongoose.Types.ObjectId(user._id),
      profileOwnerId: myId,
      viewerName:     user.name || 'Пользователь',
      viewerPhoto:    photo,
      viewerGender:   user.gender?.id || '',
      viewedAt:       new Date(now - gi * 3 * 60 * 1000), // каждые 3 минуты назад
    });
  }

  if (guestDocs.length > 0) {
    await GuestView.insertMany(guestDocs, { ordered: false }).catch(err => {
      if (err.code !== 11000) throw err;
      skipped = err.result?.nInserted !== undefined
        ? guestDocs.length - err.result.nInserted
        : 0;
    });
    console.log(`   Создано гостей: ${guestDocs.length - skipped}`);
  }

  // ── Итог ──
  console.log('\n🎉  Готово!');
  console.log(`   Чатов:   ${chatUsers.length}`);
  console.log(`   Сообщений: ${totalMsgs}`);
  console.log(`   Гостей:  ${guestDocs.length - skipped}`);
  console.log('\nЧтобы очистить:');
  console.log(`   CLEAN=true MY_USER_ID=${MY_USER_ID} node scripts/seedTestData.js`);

  await Promise.all([authConn.close(), chatConn.close(), profileConn.close()]);
}

main().catch(err => {
  console.error('❌  Ошибка:', err.message || err);
  process.exit(1);
});
