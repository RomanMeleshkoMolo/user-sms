const mongoose = require('mongoose');
const { chatConn } = require('../src/db');

// Один стикер внутри пака. В сообщении хранится только `id` (см. messageModel.sticker),
// а визуал (URL картинки + подпись) восстанавливается по нему из этого каталога.
const stickerSchema = new mongoose.Schema({
  // Глобально уникальный id, префиксованный packId: 'love2024_kiss'.
  // Именно он летит в поле message.sticker (≤64 символов).
  id: { type: String, required: true },

  // S3-ключ картинки: 'stickers/love2024/kiss.webp'. URL НЕ храним —
  // он собирается на чтении из STICKER_PUBLIC_BASE (CDN / public-read),
  // чтобы не протухал и не раздувал документ.
  key: { type: String, required: true },

  // Необязательная подпись под стикером.
  caption: { type: String, default: null },

  // Габариты оригинала — клиенту для верстки сетки без «прыжков» лэйаута.
  width: { type: Number, default: null },
  height: { type: Number, default: null },
}, { _id: false });

const stickerPackSchema = new mongoose.Schema({
  // Человекочитаемый идентификатор пака: 'love2024'. Уникален.
  packId: { type: String, required: true, unique: true, index: true },

  // Название пака (заголовок вкладки в пикере).
  name: { type: String, required: true },

  // Эмодзи-иконка вкладки в пикере (как tabEmoji в старом каталоге).
  tabEmoji: { type: String, default: '🎁' },

  // Порядок сортировки вкладок (меньше = левее).
  order: { type: Number, default: 100 },

  // Платный пак: отправка стикера из него разрешена только премиум-юзерам.
  // Гейт форсится на сервере в sendMessage, клиентский замочек — только UX.
  isPremium: { type: Boolean, default: false },

  // Версия пака. Бампается скриптом при любом изменении содержимого —
  // клиент по ней инвалидирует свой кеш манифеста.
  version: { type: Number, default: 1 },

  // Черновики не отдаются клиенту, пока published !== true.
  published: { type: Boolean, default: false },

  stickers: { type: [stickerSchema], default: [] },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Обратный лукап sticker.id → пак: нужен для премиум-гейта на отправке.
stickerPackSchema.index({ 'stickers.id': 1 });
// Отдача клиенту: только опубликованные, в порядке order.
stickerPackSchema.index({ published: 1, order: 1 });

const StickerPack = chatConn.models.StickerPack || chatConn.model('StickerPack', stickerPackSchema);

module.exports = StickerPack;
