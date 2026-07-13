/**
 * Собирает стикер-паки из эмодзи: качает векторные картинки эмодзи,
 * растрирует их в 512×512 .webp и генерит manifest.json для каждой группы.
 * Дальше готовые папки заливаются штатным uploadStickerPack.js.
 *
 * Использование:
 *   npm i sharp                 # разово, если не установлен
 *   node scripts/buildStickerPacksFromEmoji.js            # все паки
 *   node scripts/buildStickerPacksFromEmoji.js romantic   # только один
 *   STICKER_SRC=openmoji node scripts/buildStickerPacksFromEmoji.js
 *
 * Источники (лицензии — требуют атрибуции в приложении, см. About/Help):
 *   twemoji  (по умолчанию) — Twitter Twemoji, SVG, CC-BY 4.0
 *   openmoji — OpenMoji, 618px PNG, CC BY-SA 4.0
 *
 * После сборки:
 *   node scripts/uploadStickerPack.js packs/romantic
 *   ...и так по каждой папке (или циклом, см. подсказку в конце вывода).
 */
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Нужен sharp. Установи: npm i sharp');
  process.exit(1);
}

const SIZE = 512;                 // сторона итогового стикера, px
const PACKS_DIR = path.join(__dirname, '..', 'packs');
const SRC = process.env.STICKER_SRC === 'openmoji' ? 'openmoji' : 'twemoji';

// Пинним версии CDN, чтобы сборка была воспроизводимой.
const TWEMOJI_VER = '15.1.0';   // github.com/jdecked/twemoji (поддерживаемый форк)
const OPENMOJI_VER = '15.0.0';  // github.com/hfg-gmuend/openmoji

// Эмодзи → цепочка кодпоинтов. Для twemoji вырезаем variation selector FE0F,
// если рядом нет ZWJ (U+200D) — так называются файлы в ассетах twemoji.
function toCodePoints(emoji, { keepFE0F }) {
  const hasZWJ = emoji.indexOf('‍') >= 0;
  const src = (!keepFE0F && !hasZWJ) ? emoji.replace(/️/g, '') : emoji;
  const out = [];
  let hi = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if (hi) {
      out.push((0x10000 + ((hi - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      hi = 0;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      hi = c;
    } else {
      out.push(c.toString(16));
    }
  }
  return out;
}

function assetUrl(emoji) {
  if (SRC === 'openmoji') {
    const code = toCodePoints(emoji, { keepFE0F: true }).join('-').toUpperCase();
    return {
      url: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@${OPENMOJI_VER}/color/618x618/${code}.png`,
      isSvg: false,
    };
  }
  const code = toCodePoints(emoji, { keepFE0F: false }).join('-');
  return {
    url: `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VER}/assets/svg/${code}.svg`,
    isSvg: true,
  };
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Растрируем в квадрат SIZE×SIZE с прозрачным полем и лёгким внутренним отступом,
// чтобы эмодзи не липло к краям пузыря стикера.
async function toWebp(srcBuf, isSvg) {
  const pad = Math.round(SIZE * 0.06);
  const inner = SIZE - pad * 2;
  // Для SVG повышаем density → чёткий растр на 512px (интринсик у twemoji ~36px).
  const img = sharp(srcBuf, isSvg ? { density: 1024 } : undefined);
  const resized = await img
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .webp({ quality: 90, effort: 5 })
    .toBuffer();
}

async function buildPack(pack) {
  const dir = path.join(PACKS_DIR, pack.packId);
  fs.mkdirSync(dir, { recursive: true });

  const manifestStickers = [];
  for (const s of pack.stickers) {
    const file = `${s.name}.webp`;
    const id = `${pack.packId}_${s.name}`;
    const { url, isSvg } = assetUrl(s.emoji);
    try {
      const src = await fetchBuffer(url);
      const webp = await toWebp(src, isSvg);
      fs.writeFileSync(path.join(dir, file), webp);
      manifestStickers.push({
        id, file,
        caption: s.caption || null,
        width: SIZE, height: SIZE,
      });
      console.log(`  ✔ ${pack.packId}/${file}  (${(webp.length / 1024).toFixed(1)} КБ)  ${s.emoji}`);
    } catch (e) {
      console.error(`  ✖ ${pack.packId}/${file}  ${s.emoji} — ${e.message}`);
    }
  }

  if (manifestStickers.length === 0) {
    console.error(`  ⚠ Пак "${pack.packId}" пуст — manifest не пишу`);
    return null;
  }

  const manifest = {
    packId: pack.packId,
    name: pack.name,
    tabEmoji: pack.tabEmoji,
    order: pack.order,
    isPremium: Boolean(pack.isPremium),
    published: true,
    stickers: manifestStickers,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ ${pack.packId}: ${manifestStickers.length}/${pack.stickers.length} стикеров → packs/${pack.packId}\n`);
  return pack.packId;
}

async function main() {
  const source = require('./stickerSource');
  const only = process.argv[2];
  const packs = only ? source.filter((p) => p.packId === only) : source;

  if (packs.length === 0) {
    console.error(`❌ Пак "${only}" не найден. Доступны: ${source.map((p) => p.packId).join(', ')}`);
    process.exit(1);
  }

  console.log(`Источник: ${SRC}. Собираю ${packs.length} пак(ов) в ${SIZE}×${SIZE} webp...\n`);
  const built = [];
  for (const pack of packs) {
    const id = await buildPack(pack);
    if (id) built.push(id);
  }

  if (built.length) {
    console.log('Готово. Заливай паки в S3 + Mongo:');
    console.log(`  for p in ${built.join(' ')}; do node scripts/uploadStickerPack.js packs/$p; done`);
    console.log('\n⚠ Атрибуция: добавь упоминание источника эмодзи (Twemoji © Twitter, CC-BY 4.0)');
    console.log('   на экран About/Help приложения — этого требует лицензия.');
  }
}

main().catch((e) => {
  console.error('❌ ' + (e.message || String(e)));
  process.exit(1);
});
