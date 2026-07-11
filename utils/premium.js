// Премиум активен, пока premiumUntil в будущем (источник правды — дата, не булев флаг).
function isPremiumActive(user) {
  return Boolean(user?.premiumUntil && new Date(user.premiumUntil) > new Date());
}

module.exports = { isPremiumActive };
