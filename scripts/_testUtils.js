/**
 * Общие утилиты для интеграционных тест-скриптов (симпатии / сообщения).
 * Бьёт по nginx-gateway (по умолчанию http://localhost:8080), токены подписывает
 * СЕКРЕТОМ КОНТЕЙНЕРА — host .env отличается, поэтому JWT_SECRET нужно передать
 * из контейнера:
 *   JWT_SECRET=$(docker exec repos-user-sms-1 printenv JWT_SECRET) node scripts/testLikesFlow.js
 */
const jwt = require('jsonwebtoken');

const BASE = process.env.TEST_BASE || 'http://localhost:8080';
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('❌ JWT_SECRET не задан. Запусти так:\n' +
    '   JWT_SECRET=$(docker exec repos-user-sms-1 printenv JWT_SECRET) node scripts/<файл>.js');
  process.exit(1);
}

// Тестовые юзеры (molo_auth). A — премиум (может начинать беседы и слать премиум-стикеры).
const USERS = {
  A: { id: '6a537ffb86bdfda580ee5527', name: 'Роман (premium)' },
  B: { id: '6a40f8ca68e2faf3a7ac9c25', name: 'Аня' },
};

const signToken = (userId) => jwt.sign({ sub: String(userId) }, SECRET, { expiresIn: '1h' });

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* не-JSON ответ */ }
  return { status: res.status, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  (' + extra + ')' : ''}`);
  if (!ok) failures += 1;
}
function done() {
  console.log(failures === 0
    ? '\n🎉 Все проверки прошли\n'
    : `\n💥 Провалено проверок: ${failures}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

module.exports = { BASE, USERS, signToken, api, sleep, check, done };
