/**
 * Интеграционный тест: симпатии → взаимный матч.
 *   A лайкает B, B лайкает A → в /likes/matches у обоих появляется взаимный лайк.
 * Лайк идёт через RabbitMQ-воркер (repos-user-likes-worker-1), поэтому матч ждём с поллингом.
 *
 * Запуск (из user-sms/):
 *   JWT_SECRET=$(docker exec repos-user-sms-1 printenv JWT_SECRET) node scripts/testLikesFlow.js
 */
const { USERS, signToken, api, sleep, check, done } = require('./_testUtils');

(async () => {
  console.log('=== ТЕСТ: Симпатии / Метч ===');
  console.log(`A = ${USERS.A.name} (${USERS.A.id})`);
  console.log(`B = ${USERS.B.name} (${USERS.B.id})\n`);

  const tokenA = signToken(USERS.A.id);
  const tokenB = signToken(USERS.B.id);

  // A лайкает B (202 queued при async-воркере, либо 200/201 при sync-фолбэке)
  const likeAB = await api(`/likes/${USERS.B.id}`, { token: tokenA, method: 'POST' });
  check('A лайкает B принят сервером', [200, 201, 202].includes(likeAB.status),
    `HTTP ${likeAB.status}${likeAB.status === 429 ? ' — дневной лимит лайков' : ''}`);

  // B лайкает A → взаимность → матч
  const likeBA = await api(`/likes/${USERS.A.id}`, { token: tokenB, method: 'POST' });
  check('B лайкает A принят сервером', [200, 201, 202].includes(likeBA.status),
    `HTTP ${likeBA.status}${likeBA.status === 429 ? ' — дневной лимит лайков' : ''}`);

  // Матч обрабатывается воркером асинхронно — поллим до 15с
  let matchedA = false;
  for (let i = 0; i < 15; i++) {
    const m = await api('/likes/matches', { token: tokenA });
    matchedA = Array.isArray(m.data?.matches)
      && m.data.matches.some((x) => String(x.otherUser?._id) === USERS.B.id);
    if (matchedA) break;
    await sleep(1000);
  }
  check('Матч A↔B виден в /likes/matches (сторона A)', matchedA);

  // И со стороны B
  const mB = await api('/likes/matches', { token: tokenB });
  const matchedB = Array.isArray(mB.data?.matches)
    && mB.data.matches.some((x) => String(x.otherUser?._id) === USERS.A.id);
  check('Матч виден со стороны B', matchedB);

  done();
})().catch((e) => { console.error('❌ Ошибка теста:', e.message); process.exit(1); });
