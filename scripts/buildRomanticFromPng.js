/**
 * Разовый сборщик премиум-пака «romantic» из PNG-иконок (alien.studio, Flaticon).
 * Берёт PNG из molo/assets/MassageIcons, конвертит в webp 256×256 и кладёт в
 * packs/romantic/ вместе с manifest.json. Дальше заливается uploadStickerPack.js.
 *
 *   node scripts/buildRomanticFromPng.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = '/Users/roman/Documents/STARTUP/Molo/repos/molo/assets/MassageIcons';
const OUT = path.join(__dirname, '..', 'packs', 'romantic');
const PACK_ID = 'romantic';
const SIZE = 256; // рендерится в пикере ~70pt, 256 хватает и на retina

// Порядок и человекочитаемые id-суффиксы (только [a-z0-9_]). Файл = <src>.png.
const ITEMS = [
  ['in-love',       'inlove'],
  ['heart-eyes',    'hearteyes'],
  ['kiss',          'kiss'],
  ['kissing',       'kissing'],
  ['kissingGirl',   'kissinggirl'],
  ['holding-hands', 'holdinghands'],
  ['wine',          'wine'],
  ['happy',         'happy'],
  ['smile',         'smile'],
  ['satisfied',     'satisfied'],
  ['cool',          'cool'],
  ['wink',          'wink'],
  ['embarrased',    'embarrased'],
  ['suspicion',     'suspicion'],
  ['grouchy',       'grouchy'],
  ['cry',           'cry'],
  ['sleep',         'sleep'],
  ['mask',          'mask'],
  ['distance',      'distance'],
  ['dead',          'dead'],
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // чистим старые webp пака (заменяем эмодзи-сердечки на новый арт)
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.webp')) fs.unlinkSync(path.join(OUT, f));
  }

  const stickers = [];
  for (const [srcName, id] of ITEMS) {
    const srcPath = path.join(SRC, `${srcName}.png`);
    if (!fs.existsSync(srcPath)) throw new Error(`Нет файла: ${srcPath}`);
    const file = `${id}.webp`;
    await sharp(srcPath)
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(OUT, file));
    stickers.push({ id: `${PACK_ID}_${id}`, file });
    console.log(`  ✓ ${file}`);
  }

  const manifest = {
    packId: PACK_ID,
    name: 'Сердечки',
    tabEmoji: '❤️',
    order: 40,
    isPremium: true,
    published: true,
    stickers,
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Собрано ${stickers.length} стикеров → ${OUT}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
