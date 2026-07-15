/**
 * Источник стикер-паков для buildStickerPacksFromEmoji.js.
 *
 * Каждая группа = отдельный пак (packId), из которого скрипт соберёт папку
 * packs/<packId>/ с .webp + manifest.json, а дальше uploadStickerPack.js зальёт
 * её в S3 + molo_chat.
 *
 * Поля стикера:
 *   name  — короткое имя файла и суффикс id (итоговый id = `<packId>_<name>`,
 *           файл = `<name>.webp`). Только [a-z0-9_], уникально внутри пака.
 *   emoji — сам эмодзи-символ; по нему качается векторный Twemoji SVG.
 *
 * Подписи под стикерами НЕ используются (в пикере/чате не рендерятся).
 *
 * order задаёт позицию вкладки в пикере (меньше = левее). Премиум-пак(и)
 * специально стоят в СЕРЕДИНЕ ряда, чтобы выделяться (короной + размером).
 *
 * Премиум-пак «Сердечки» (packId 'romantic'): только чистые сердечки, стоит по
 * центру. Кастомные эксклюзив-стикеры (арт-файлы .webp) добавляются в него
 * отдельно — доложить в packs/romantic/ + записи в manifest перед заливкой.
 */
module.exports = [
  {
    packId: 'greeting', name: 'Приветы', tabEmoji: '👋', order: 10, isPremium: false,
    stickers: [
      { name: 'wave',    emoji: '👋' },
      { name: 'heart',   emoji: '💛' },
      { name: 'hug',     emoji: '🤗' },
      { name: 'morning', emoji: '☀️' },
      { name: 'night',   emoji: '🌙' },
      { name: 'missyou', emoji: '🥺' },
      { name: 'smile',   emoji: '🙂' },
      { name: 'coffee',  emoji: '☕' },
    ],
  },
  {
    packId: 'mood', name: 'Эмоции', tabEmoji: '😎', order: 20, isPremium: false,
    stickers: [
      { name: 'laugh',  emoji: '😂' },
      { name: 'fire',   emoji: '🔥' },
      { name: 'cool',   emoji: '😎' },
      { name: 'party',  emoji: '🥳' },
      { name: 'cry',    emoji: '😭' },
      { name: 'think',  emoji: '🤔' },
      { name: 'wow',    emoji: '😮' },
      { name: 'sleepy', emoji: '😴' },
      { name: 'wink',   emoji: '😉' },
      { name: 'shy',    emoji: '😳' },
      { name: 'hundred',emoji: '💯' },
      { name: 'clap',   emoji: '👏' },
    ],
  },
  {
    // Бесплатный (был премиум). Принял смайлы-с-сердцами из бывшей «Романтики».
    packId: 'flirt', name: 'Флирт', tabEmoji: '😏', order: 30, isPremium: false,
    stickers: [
      { name: 'smirk',    emoji: '😏' },
      { name: 'kissmark', emoji: '💋' },
      { name: 'wink',     emoji: '😜' },
      { name: 'hearteyes',emoji: '😍' },
      { name: 'kiss',     emoji: '😘' },
      { name: 'blush',    emoji: '🥰' },
      { name: 'devil',    emoji: '😈' },
      { name: 'rose',     emoji: '🥀' },
      { name: 'redrose',  emoji: '🌹' },
      { name: 'fire',     emoji: '🔥' },
      { name: 'eyes',     emoji: '👀' },
    ],
  },
  {
    // ПРЕМИУМ «Сердечки» — по центру ряда вкладок (корона + размер), иконка ❤️.
    // Только чистые сердечки. Сюда же докладываются кастомные эксклюзив-стикеры.
    packId: 'romantic', name: 'Сердечки', tabEmoji: '❤️', order: 40, isPremium: true,
    stickers: [
      { name: 'bigheart',   emoji: '❤️' },
      { name: 'hearts',     emoji: '💕' },
      { name: 'cupid',      emoji: '💘' },
      { name: 'handheart',  emoji: '🫶' },
      { name: 'loveletter', emoji: '💌' },
      { name: 'sparkle',    emoji: '💖' },
      { name: 'revolving',  emoji: '💞' },
      { name: 'growing',    emoji: '💗' },
      { name: 'gift_heart', emoji: '💝' },
    ],
  },
  {
    packId: 'cute', name: 'Милашки', tabEmoji: '🐻', order: 50, isPremium: false,
    stickers: [
      { name: 'bear',    emoji: '🐻' },
      { name: 'cat',     emoji: '🐱' },
      { name: 'bunny',   emoji: '🐰' },
      { name: 'dog',     emoji: '🐶' },
      { name: 'panda',   emoji: '🐼' },
      { name: 'unicorn', emoji: '🦄' },
      { name: 'rainbow', emoji: '🌈' },
      { name: 'star',    emoji: '⭐' },
      { name: 'flower',  emoji: '🌸' },
      { name: 'penguin', emoji: '🐧' },
    ],
  },
  {
    packId: 'animals', name: 'Животные', tabEmoji: '🐾', order: 60, isPremium: false,
    stickers: [
      { name: 'fox',       emoji: '🦊' },
      { name: 'koala',     emoji: '🐨' },
      { name: 'tiger',     emoji: '🐯' },
      { name: 'lion',      emoji: '🦁' },
      { name: 'cow',       emoji: '🐮' },
      { name: 'pig',       emoji: '🐷' },
      { name: 'frog',      emoji: '🐸' },
      { name: 'monkey',    emoji: '🐵' },
      { name: 'hamster',   emoji: '🐹' },
      { name: 'owl',       emoji: '🦉' },
      { name: 'bee',       emoji: '🐝' },
      { name: 'butterfly', emoji: '🦋' },
    ],
  },
  {
    packId: 'food', name: 'Еда', tabEmoji: '🍕', order: 70, isPremium: false,
    stickers: [
      { name: 'pizza',      emoji: '🍕' },
      { name: 'burger',     emoji: '🍔' },
      { name: 'fries',      emoji: '🍟' },
      { name: 'taco',       emoji: '🌮' },
      { name: 'sushi',      emoji: '🍣' },
      { name: 'donut',      emoji: '🍩' },
      { name: 'icecream',   emoji: '🍦' },
      { name: 'cake',       emoji: '🍰' },
      { name: 'strawberry', emoji: '🍓' },
      { name: 'cherry',     emoji: '🍒' },
      { name: 'cookie',     emoji: '🍪' },
      { name: 'choco',      emoji: '🍫' },
    ],
  },
];
