'use strict';
/**
 * Seed чатов — использует реальных тестовых пользователей из molo_auth.
 * Запускай ПОСЛЕ seedMasterTest.js (user-service/scripts/seedMasterTest.js).
 *
 * Запуск:
 *   MY_USER_ID=<твой_ObjectId> node scripts/seedTestChats.js
 *
 * Или через email:
 *   TARGET_EMAIL=roman.meleshko1@gmail.com node scripts/seedTestChats.js
 *
 * Env:
 *   AUTH_MONGO_URI   mongodb://localhost:27017/molo_auth
 *   CHAT_MONGO_URI   mongodb://localhost:27017/molo_chat
 *   MY_USER_ID       — ObjectId главного пользователя (опционально если TARGET_EMAIL)
 *   TARGET_EMAIL     — email главного пользователя (опционально если MY_USER_ID)
 *   CLEAN=true       — удалить старые seed-чаты перед запуском
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const AUTH_URI  = process.env.AUTH_MONGO_URI || 'mongodb://localhost:27017/molo_auth';
const CHAT_URI  = process.env.MONGO_URI      || 'mongodb://localhost:27017/molo_chat';
const TARGET_EMAIL = process.env.TARGET_EMAIL || 'roman.meleshko1@gmail.com';
const MY_USER_ID   = process.env.MY_USER_ID;
const CLEAN        = process.env.CLEAN === 'true';

// ─── Диалоги ─────────────────────────────────────────────────────────────────
const THREADS = [
  [
    { from: 'other', text: 'Привет! Вижу, ты тоже из Киева — редкость здесь 😊' },
    { from: 'me',    text: 'Привет! Да, родился и вырос 😄 А ты давно?' },
    { from: 'other', text: 'Года три уже. Скучаешь по городу?' },
    { from: 'me',    text: 'Иногда. Особенно по Андреевскому спуску в осень' },
    { from: 'other', text: 'Там я тоже люблю гулять! Чем занимаешься?' },
    { from: 'me',    text: 'Программирую. А ты?' },
    { from: 'other', text: 'Дизайн. Мы почти коллеги! 😄' },
    { from: 'me',    text: 'Тогда давай за кофе — обсудим проекты?' },
    { from: 'other', text: 'С удовольствием. Когда свободен?' },
    { from: 'me',    text: 'В пятницу вечером?' },
    { from: 'other', text: 'Отлично, договорились 🎉' },
  ],
  [
    { from: 'other', text: 'Привет! Ты путешествуешь — куда была последняя поездка?' },
    { from: 'me',    text: 'Привет! Прага месяц назад — потрясающий город!' },
    { from: 'other', text: 'О, я живу в Праге! 😮 Что больше всего понравилось?' },
    { from: 'me',    text: 'Карлов мост на рассвете — нет слов просто' },
    { from: 'other', text: 'Это одно из моих любимых мест! Ты один был?' },
    { from: 'me',    text: 'Один. Иногда люблю путешествовать соло' },
    { from: 'other', text: 'Понимаю. Но вдвоём интереснее открывать места, согласен?' },
    { from: 'me',    text: 'Согласен! Если попутчик правильный 😊' },
    { from: 'other', text: 'А что для тебя "правильный"?' },
    { from: 'me',    text: 'Любопытный и умеющий молчать, когда вид говорит за себя' },
    { from: 'other', text: 'Мне кажется, я именно такая 😄' },
    { from: 'me',    text: 'Надо проверить. Куда мечтаешь поехать следующей?' },
    { from: 'other', text: 'Япония давняя мечта. А ты?' },
    { from: 'me',    text: 'Патагония. Дикая природа и тишина' },
  ],
  [
    { from: 'other', text: 'Привет! Ты занимаешься спортом — это сразу видно 💪' },
    { from: 'me',    text: 'Привет! Ха, стараюсь 😄 Ты тоже по профилю видно' },
    { from: 'other', text: 'Йога и бег. А ты что предпочитаешь?' },
    { from: 'me',    text: 'Зал и велик. Всё, что на свежем воздухе' },
    { from: 'other', text: 'О, я тоже! Где обычно катаешься?' },
    { from: 'me',    text: 'По набережной в основном. Ты бываешь там?' },
    { from: 'other', text: 'Каждые выходные почти. Как мы не пересекались? 😄' },
    { from: 'me',    text: 'Видимо, судьба сводит нас здесь 😊' },
    { from: 'other', text: 'Встретимся в субботу на набережной?' },
    { from: 'me',    text: 'С удовольствием! В 10 утра?' },
    { from: 'other', text: 'Идеально 🌟' },
  ],
  [
    { from: 'other', text: 'Привет! Давно на приложении?' },
    { from: 'me',    text: 'Привет! Несколько недель. Ты?' },
    { from: 'other', text: 'Примерно так же. Интересно, но немного странно 😄' },
    { from: 'me',    text: 'Согласен. Первое сообщение всегда сложнее отправить' },
    { from: 'other', text: 'Мне повезло — ты написал(а) первым(ой) 😊' },
    { from: 'me',    text: 'У тебя интересная анкета. Ты правда занимаешься йогой каждый день?' },
    { from: 'other', text: 'Почти. Это помогает держать голову в порядке' },
    { from: 'me',    text: 'Завидую дисциплине. Я больше хаотичный 😅' },
    { from: 'other', text: 'Это не плохо! Хаос часто приводит к интересному 😄' },
    { from: 'me',    text: 'Философски! Ты часто так думаешь?' },
    { from: 'other', text: 'По образованию психолог — не могу не анализировать 😄' },
    { from: 'me',    text: 'Тогда мне надо быть аккуратнее с тем, что говорю' },
    { from: 'other', text: 'Расслабься, в нерабочее время я просто Катя 😊' },
  ],
  [
    { from: 'other', text: 'Привет! Ты готовишь? Вижу кулинария в интересах 🍳' },
    { from: 'me',    text: 'Привет! Да, это моя страсть. Итальянская и азиатская' },
    { from: 'other', text: 'Обожаю итальянскую! Ты правда умеешь делать пасту?' },
    { from: 'me',    text: 'Карбонара — моё фирменное 😄' },
    { from: 'other', text: 'Я растаяла. Это путь к сердцу 😄' },
    { from: 'me',    text: 'Тогда, может, как-нибудь приготовлю для тебя?' },
    { from: 'other', text: 'Это от которого нельзя отказаться 😊' },
    { from: 'me',    text: 'Именно так и задумывалось' },
    { from: 'other', text: 'Принято! Что ещё умеешь?' },
    { from: 'me',    text: 'Тайский карри, японские роллы, французские крепы...' },
    { from: 'other', text: 'Подожди, ты Chef или кто? 😮' },
    { from: 'me',    text: 'Любитель с серьёзным подходом 😄' },
  ],
  [
    { from: 'other', text: 'Привет! Ты тоже за границей? Я в Варшаве' },
    { from: 'me',    text: 'Привет! Да, в Берлине уже год. Как тебе Варшава?' },
    { from: 'other', text: 'Нравится! Активный город. Ты скучаешь по Украине?' },
    { from: 'me',    text: 'Иногда. По друзьям, по атмосфере. А ты?' },
    { from: 'other', text: 'Очень. Особенно по домашней еде мамы 😄' },
    { from: 'me',    text: 'Это вечная история 😊 Чем занимаешься в Варшаве?' },
    { from: 'other', text: 'Маркетинг. А ты в Берлине?' },
    { from: 'me',    text: 'IT. Берлин для этого идеальный' },
    { from: 'other', text: 'Давно хотела туда. Есть любимые места?' },
    { from: 'me',    text: 'Много! Приезжай — покажу' },
    { from: 'other', text: 'Это приглашение? 😊' },
    { from: 'me',    text: 'Абсолютно 😄 Ты как к спонтанным поездкам?' },
    { from: 'other', text: 'Положительно! Особенно если есть хороший гид 😊' },
  ],
  [
    { from: 'other', text: 'Привет! Ты реально читаешь по 2 книги в неделю?' },
    { from: 'me',    text: 'Привет! Ха, стараюсь! Сейчас что-нибудь читаешь?' },
    { from: 'other', text: '"Сто лет одиночества" — второй раз перечитываю' },
    { from: 'me',    text: 'Маркес! Магический реализм — это особое' },
    { from: 'other', text: 'Ещё что читала повторно — "Маленький принц" и "Мастер и Маргарита"' },
    { from: 'me',    text: '"Маленький принц" — это вечно 😊 Могу что-то порекомендовать?' },
    { from: 'other', text: 'Конечно!' },
    { from: 'me',    text: '"Норвежский лес" Мураками — если ещё не читала' },
    { from: 'other', text: 'Давно хотела! Спасибо 😊' },
    { from: 'me',    text: 'Потом расскажи своё мнение — мне интересно' },
  ],
  [
    { from: 'other', text: 'Привет! Журналист — о чём пишешь?' },
    { from: 'me',    text: 'Привет! Технологии и общество. Ты чем занимаешься?' },
    { from: 'other', text: 'Архитектор. Мы оба создаём что-то для людей, по сути 😊' },
    { from: 'me',    text: 'Хорошая мысль! Что проектируешь?' },
    { from: 'other', text: 'Общественные пространства — парки, библиотеки' },
    { from: 'me',    text: 'Это потрясающе. Я хотел бы написать статью про таких архитекторов' },
    { from: 'other', text: 'Намекаешь на интервью? 😄' },
    { from: 'me',    text: 'Можно начать с этого 😊 Расскажи о любимом проекте' },
    { from: 'other', text: 'Парк в Кракове. Придумала "тихие зоны" для интровертов' },
    { from: 'me',    text: 'Это гениально! Ты правда думаешь о людях' },
    { from: 'other', text: 'Стараюсь. Говорят, это редкость 😄' },
    { from: 'me',    text: 'И за это тебя стоит знать лучше 😊' },
  ],
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  const authConn = await mongoose.createConnection(AUTH_URI).asPromise();
  const chatConn = await mongoose.createConnection(CHAT_URI).asPromise();
  console.log('✅ Подключились к molo_auth и molo_chat');

  // Находим главного пользователя
  let roman;
  if (MY_USER_ID) {
    roman = await authConn.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(MY_USER_ID) },
      { projection: { _id: 1, name: 1 } }
    );
  } else {
    roman = await authConn.collection('users').findOne(
      { email: TARGET_EMAIL },
      { projection: { _id: 1, name: 1 } }
    );
  }

  if (!roman) {
    console.error(`❌ Пользователь не найден. Укажи MY_USER_ID или TARGET_EMAIL`);
    process.exit(1);
  }
  console.log(`🎯 Главный пользователь: ${roman.name} (${roman._id})`);

  // Берём реальных тестовых пользователей из molo_auth
  const testUsers = await authConn.collection('users').find(
    {
      _id: { $ne: roman._id },
      email: { $exists: false },
      deviceId: { $exists: false },
      onboardingComplete: true,
      name: { $exists: true },
    },
    { projection: { _id: 1, name: 1, userPhoto: 1, isOnline: 1 } }
  ).sort({ _id: 1 }).toArray();

  if (testUsers.length === 0) {
    console.error('❌ Тестовые пользователи не найдены. Сначала запусти seedMasterTest.js');
    process.exit(1);
  }
  console.log(`📋 Найдено тестовых пользователей: ${testUsers.length}`);

  // Схемы
  const ConvSchema = new mongoose.Schema({
    participants:  [mongoose.Schema.Types.ObjectId],
    lastMessage: {
      text: String, senderId: mongoose.Schema.Types.ObjectId,
      createdAt: Date, isRead: Boolean, nonce: { type: String, default: null },
    },
    unreadCount: { type: Map, of: Number, default: {} },
    isPrivate:   { type: Boolean, default: false },
    deletedFor:  [mongoose.Schema.Types.ObjectId],
    createdAt:   Date, updatedAt: Date,
    _isSeed:     Boolean,
  });
  const MsgSchema = new mongoose.Schema({
    conversationId: mongoose.Schema.Types.ObjectId,
    senderId:       mongoose.Schema.Types.ObjectId,
    receiverId:     mongoose.Schema.Types.ObjectId,
    messageType:    { type: String, default: 'text' },
    text:           String,
    isRead:         Boolean,
    createdAt:      Date,
    _isSeed:        Boolean,
  });

  const Conversation = chatConn.models.Conversation || chatConn.model('Conversation', ConvSchema);
  const Message      = chatConn.models.Message      || chatConn.model('Message', MsgSchema);

  if (CLEAN) {
    await Message.deleteMany({ _isSeed: true });
    const res = await Conversation.deleteMany({ _isSeed: true });
    console.log(`🧹 Удалено старых чатов: ${res.deletedCount}`);
  }

  const now = Date.now();
  let totalConvs = 0, totalMsgs = 0;

  for (let i = 0; i < testUsers.length; i++) {
    const other = testUsers[i];
    const thread = THREADS[i % THREADS.length];

    const exists = await Conversation.findOne({
      participants: { $all: [roman._id, other._id], $size: 2 },
    });
    if (exists) { continue; }

    const convStart = new Date(now - rand(3, 30) * 86400000);
    const conv = await Conversation.create({
      participants: [roman._id, other._id],
      isPrivate: false,
      unreadCount: { [String(roman._id)]: rand(0, 3) },
      createdAt: convStart, updatedAt: convStart,
      _isSeed: true,
    });

    const messages = [];
    let lastTs = convStart.getTime();

    for (let mi = 0; mi < thread.length; mi++) {
      lastTs += rand(60, 900) * 1000;
      if (lastTs > now) lastTs = now - rand(0, 3600) * 1000;
      const fromMe = thread[mi].from === 'me';
      messages.push({
        conversationId: conv._id,
        senderId:   fromMe ? roman._id : other._id,
        receiverId: fromMe ? other._id : roman._id,
        messageType: 'text',
        text: thread[mi].text,
        isRead: mi < thread.length - rand(0, 2),
        createdAt: new Date(lastTs),
        _isSeed: true,
      });
    }

    await Message.insertMany(messages);
    totalMsgs += messages.length;

    const last = messages[messages.length - 1];
    await Conversation.findByIdAndUpdate(conv._id, {
      lastMessage: { text: last.text, senderId: last.senderId, createdAt: last.createdAt, isRead: last.isRead },
      updatedAt: last.createdAt,
    });

    totalConvs++;
    if (totalConvs % 5 === 0 || i === testUsers.length - 1) {
      console.log(`  [${totalConvs}/${testUsers.length}] чатов, сообщений: ${totalMsgs}`);
    }
  }

  console.log(`\n🎉 Готово! Чатов: ${totalConvs}  Сообщений: ${totalMsgs}`);
  console.log('\n   Удалить seed-чаты:');
  console.log('   CLEAN=true node scripts/seedTestChats.js\n');

  await authConn.close();
  await chatConn.close();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
