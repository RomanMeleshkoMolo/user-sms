/**
 * Интеграционный тест: сообщения.
 *   A (премиум) → B текстовое сообщение, B его читает; затем A шлёт премиум-стикер.
 *
 * Запуск (из user-sms/):
 *   JWT_SECRET=$(docker exec repos-user-sms-1 printenv JWT_SECRET) node scripts/testMessagesFlow.js
 */
const { USERS, signToken, api, check, done } = require('./_testUtils');

(async () => {
  console.log('=== ТЕСТ: Сообщения ===');
  console.log(`A = ${USERS.A.name} (${USERS.A.id})`);
  console.log(`B = ${USERS.B.name} (${USERS.B.id})\n`);

  const tokenA = signToken(USERS.A.id); // премиум — вправе начать беседу
  const tokenB = signToken(USERS.B.id);
  const text = `Тестовое сообщение ${Date.now()}`;

  // A → B: текст
  const send = await api(`/chats/${USERS.B.id}/messages`, {
    token: tokenA, method: 'POST', body: { messageType: 'text', text, replyTo: null },
  });
  check('A отправил текст B', send.status === 201,
    `HTTP ${send.status}${send.data?.code ? ' ' + send.data.code : ''}`);

  // B читает переписку с A (recipientId = собеседник = A)
  const msgs = await api(`/chats/${USERS.A.id}/messages`, { token: tokenB });
  const gotText = Array.isArray(msgs.data?.messages)
    && msgs.data.messages.some((m) => m.text === text);
  check('B получил тот же текст', gotText, `сообщений в чате: ${msgs.data?.messages?.length ?? '—'}`);

  // A → B: премиум-стикер (A премиум → должен пройти серверный премиум-гейт)
  const sticker = await api(`/chats/${USERS.B.id}/messages`, {
    token: tokenA, method: 'POST', body: { messageType: 'sticker', sticker: 'romantic_inlove', replyTo: null },
  });
  check('A отправил премиум-стикер romantic_inlove', sticker.status === 201,
    `HTTP ${sticker.status}${sticker.data?.code ? ' ' + sticker.data.code : ''}`);

  // Стикер долетел до B
  const msgs2 = await api(`/chats/${USERS.A.id}/messages`, { token: tokenB });
  const gotSticker = Array.isArray(msgs2.data?.messages)
    && msgs2.data.messages.some((m) => m.messageType === 'sticker' && m.sticker === 'romantic_inlove');
  check('B получил стикер', gotSticker);

  done();
})().catch((e) => { console.error('❌ Ошибка теста:', e.message); process.exit(1); });
