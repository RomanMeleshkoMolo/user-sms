/**
 * Разовый сборщик премиум-пака «cats» из PNG-стикеров (Flaticon, автор Stickers).
 * Берёт все PNG из molo/assets/MassageIcons/Cats (имена с пробелами/скобками),
 * сортирует, конвертит в webp 256×256 → packs/cats/ + manifest.json.
 * Дальше заливается uploadStickerPack.js.
 *
 *   node scripts/buildCatsFromPng.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = '/Users/roman/Documents/STARTUP/Molo/repos/molo/assets/MassageIcons/Cats';
const OUT = path.join(__dirname, '..', 'packs', 'cats');
const PACK_ID = 'cats';
const SIZE = 256;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.webp')) fs.unlinkSync(path.join(OUT, f));
  }

  // Все PNG, натуральная сортировка (love (2) < love (10)).
  const files = fs.readdirSync(SRC)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!files.length) throw new Error(`Нет PNG в ${SRC}`);

  const stickers = [];
  let i = 0;
  for (const src of files) {
    i += 1;
    const id = `cat${String(i).padStart(2, '0')}`; // cat01..catNN
    const file = `${id}.webp`;
    await sharp(path.join(SRC, src))
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(OUT, file));
    stickers.push({ id: `${PACK_ID}_${id}`, file });
    console.log(`  ✓ ${src} → ${file}`);
  }

  const manifest = {
    packId: PACK_ID,
    name: 'Котики',
    tabEmoji: '🐱',
    order: 45, // сразу после romantic(40)
    isPremium: true,
    published: true,
    stickers,
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Собрано ${stickers.length} стикеров → ${OUT}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
