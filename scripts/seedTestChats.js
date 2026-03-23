/**
 * Seed script: создаёт 50 тестовых чатов с ~50 случайными сообщениями в каждом.
 *
 * Использование:
 *   MY_USER_ID=<твой_userId> node scripts/seedTestChats.js
 *
 * Опционально:
 *   CHAT_COUNT=50      — кол-во чатов (по умолчанию 50)
 *   MSG_COUNT=50       — сообщений на чат (по умолчанию 50)
 *   MONGO_URI=...      — переопределить строку подключения
 *   CLEAN=true         — удалить ранее созданные seed-данные перед запуском
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');

// ---------- Конфиг ----------
const MONGO_URI   = process.env.MONGO_URI || 'mongodb://localhost:27017/users';
const MY_USER_ID  = process.env.MY_USER_ID;
const CHAT_COUNT  = parseInt(process.env.CHAT_COUNT  || '50', 10);
const MSG_COUNT   = parseInt(process.env.MSG_COUNT   || '50', 10);
const CLEAN       = process.env.CLEAN === 'true';

if (!MY_USER_ID) {
  console.error('❌  Укажи MY_USER_ID=<твой ObjectId> перед запуском');
  process.exit(1);
}

// ---------- Модели (inline, чтобы не тянуть src/db.js) ----------
const connect = async () => mongoose.connect(MONGO_URI);

const userSchema = new mongoose.Schema({
  name: String,
  age: Number,
  userPhoto: { type: Array, default: [] },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null },
  city: String,
  userLocation: String,
  publicKey: { type: String, default: null },
  _isSeedUser: { type: Boolean, default: false }, // маркер seed-данных
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const conversationSchema = new mongoose.Schema({
  participants:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: {
    text:      { type: String, default: '' },
    nonce:     { type: String, default: null },
    senderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    isRead:    { type: Boolean, default: false },
  },
  unreadCount: { type: Map, of: Number, default: {} },
  isPrivate:   { type: Boolean, default: false },
  deletedFor:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
  _isSeed:     { type: Boolean, default: false }, // маркер seed-данных
});
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messageType:    { type: String, enum: ['text', 'voice', 'image'], default: 'text' },
  text:           { type: String, trim: true, default: '' },
  isRead:         { type: Boolean, default: false },
  readAt:         { type: Date, default: null },
  nonce:          { type: String, default: null },
  heartedBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedFor:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedForAll:  { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
  _isSeed:        { type: Boolean, default: false }, // маркер seed-данных
});
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

// ---------- Пул случайных русских фраз ----------
const PHRASES = [
  'Привет! Как дела?',
  'Всё хорошо, спасибо 😊',
  'Чем занимаешься?',
  'Ничего особенного, отдыхаю',
  'Слушай, давно хотел спросить...',
  'Да? Что такое?',
  'Ты сегодня свободен?',
  'Нет, к сожалению 😕',
  'Может встретимся на выходных?',
  'Звучит отлично!',
  'Как прошёл твой день?',
  'Устал немного, но всё ок',
  'Смотрел что-нибудь интересное?',
  'Да, новый сезон очень крутой',
  'Расскажи подробнее!',
  'Там такой поворот в конце 😱',
  'Не спойли мне! Я ещё не досмотрел',
  'Ой, прости 😅',
  'Ничего, прощаю 😄',
  'Кстати, ты слышал новость?',
  'Нет, что случилось?',
  'Потом расскажу, сейчас бегу',
  'Ладно, удачи!',
  'Спасибо ❤️',
  'Пока пока!',
  'До завтра 👋',
  'Окей, до связи',
  'Не забудь написать',
  'Конечно напишу',
  'Жду!',
  'Кстати, ты уже видел новое место в центре?',
  'Нет, а что там?',
  'Кафе открылось, говорят очень вкусно',
  'Надо сходить как-нибудь',
  'Давай в эту пятницу?',
  'Договорились!',
  'Отлично, буду ждать 🥳',
  'Кстати, погода сегодня просто замечательная',
  'Да, тепло наконец-то',
  'Самое время для прогулки',
  'Хочешь прогуляться сейчас?',
  'Почему бы и нет, давай!',
  'Встречаемся через час?',
  'Ок, пиши когда выходишь',
  'Уже выхожу!',
  'Жду тебя у фонтана',
  'Иду, минут 10',
  'Не спеши, я подожду',
  'Уже вижу тебя, привет! 👋',
  'Наконец-то! Пошли 😄',
  'Сегодня был такой длинный день',
  'Понимаю, тоже устал',
  'Когда ты отдыхать-то будешь?',
  'Скоро отпуск',
  'Куда планируешь?',
  'Ещё не решил, может море',
  'О, завидую! Я давно не был на море',
  'Поехали вместе!',
  'Это была бы идея 😃',
  'Серьёзно говорю, давай планировать',
  'Окей, обсудим в эти выходные',
  'Договорились 🤝',
  'Жду не дождусь!',
  'Я тоже',
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr)      => arr[rand(0, arr.length - 1)];

// ---------- Генерация имён ----------
const NAMES = [
  'Анна','Мария','Дарья','Екатерина','Ольга','Наталья','Елена','Ирина',
  'Александра','Юлия','Виктория','Татьяна','Людмила','Надежда','Галина',
  'Алексей','Дмитрий','Сергей','Андрей','Максим','Иван','Никита','Кирилл',
  'Михаил','Владимир','Артём','Роман','Павел','Евгений','Антон',
];
const CITIES = ['Москва','Санкт-Петербург','Казань','Новосибирск','Екатеринбург','Краснодар','Минск','Алматы'];

// ---------- Главная функция ----------
async function seed() {
  await connect();
  console.log(`✅  Подключились к ${MONGO_URI}`);

  const myId = new mongoose.Types.ObjectId(MY_USER_ID);

  // Очистка старых seed-данных
  if (CLEAN) {
    console.log('🧹  Удаляю старые seed-данные...');
    const oldConvs  = await Conversation.find({ _isSeed: true }).select('_id');
    const oldConvIds = oldConvs.map(c => c._id);
    await Message.deleteMany({ _isSeed: true });
    await Conversation.deleteMany({ _isSeed: true });
    await User.deleteMany({ _isSeedUser: true });
    console.log(`   Удалено чатов: ${oldConvIds.length}`);
  }

  // 1. Создаём тестовых пользователей
  console.log(`👥  Создаю ${CHAT_COUNT} тестовых пользователей...`);
  const fakeUsers = [];
  for (let i = 0; i < CHAT_COUNT; i++) {
    const name = `${pick(NAMES)} ${i + 1}`;
    const user = await User.create({
      name,
      age: rand(18, 35),
      city: pick(CITIES),
      isOnline: Math.random() > 0.6,
      _isSeedUser: true,
    });
    fakeUsers.push(user);
  }
  console.log(`   Создано пользователей: ${fakeUsers.length}`);

  // 2. Создаём чаты и сообщения
  let totalMessages = 0;
  const now = Date.now();

  for (let ci = 0; ci < fakeUsers.length; ci++) {
    const otherUser = fakeUsers[ci];

    // Создаём conversation
    const conv = await Conversation.create({
      participants: [myId, otherUser._id],
      isPrivate: false,
      unreadCount: { [myId.toString()]: rand(0, 5) },
      createdAt: new Date(now - rand(1, 30) * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now - rand(0, 3) * 24 * 60 * 60 * 1000),
      _isSeed: true,
    });

    // Генерируем сообщения
    const msgCount = rand(MSG_COUNT - 10, MSG_COUNT + 10);
    const messages = [];
    let lastMsgDate = new Date(conv.createdAt);

    for (let mi = 0; mi < msgCount; mi++) {
      // Случайный промежуток между сообщениями
      lastMsgDate = new Date(lastMsgDate.getTime() + rand(30, 600) * 1000);
      if (lastMsgDate > new Date()) lastMsgDate = new Date();

      // Чередуем отправителей
      const fromMe = Math.random() > 0.45;
      const senderId   = fromMe ? myId : otherUser._id;
      const receiverId = fromMe ? otherUser._id : myId;

      messages.push({
        conversationId: conv._id,
        senderId,
        receiverId,
        messageType: 'text',
        text: pick(PHRASES),
        isRead: mi < msgCount - rand(0, 5), // последние несколько — непрочитанные
        createdAt: new Date(lastMsgDate),
        _isSeed: true,
      });
    }

    await Message.insertMany(messages);
    totalMessages += messages.length;

    // Обновляем lastMessage у conversation
    const last = messages[messages.length - 1];
    await Conversation.findByIdAndUpdate(conv._id, {
      lastMessage: {
        text:      last.text,
        senderId:  last.senderId,
        createdAt: last.createdAt,
        isRead:    last.isRead,
      },
      updatedAt: last.createdAt,
    });

    if ((ci + 1) % 10 === 0 || ci === fakeUsers.length - 1) {
      console.log(`   [${ci + 1}/${fakeUsers.length}] чатов создано, сообщений: ${totalMessages}`);
    }
  }

  console.log('\n🎉  Готово!');
  console.log(`   Чатов:      ${fakeUsers.length}`);
  console.log(`   Сообщений:  ${totalMessages}`);
  console.log('\nЧтобы удалить seed-данные:');
  console.log(`   CLEAN=true MY_USER_ID=${MY_USER_ID} node scripts/seedTestChats.js`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌  Ошибка:', err);
  mongoose.disconnect();
  process.exit(1);
});
