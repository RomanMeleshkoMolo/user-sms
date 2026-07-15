/**
 * Универсальный сборщик премиум-пака из папки PNG (Flaticon-стикеры).
 * Все PNG из <srcDir> → webp 256×256 в packs/<packId>/ + manifest.json.
 * Дальше заливается uploadStickerPack.js.
 *
 *   node scripts/buildPackFromPng.js <srcDir> <packId> <name> <tabEmoji> [order] [idPrefix]
 *
 * Пример:
 *   node scripts/buildPackFromPng.js \
 *     /Users/roman/.../molo/assets/MassageIcons/CuteCats cutecats "Милые котики" 😻 47 c
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZE = 256;

async function main() {
  const [srcDir, packId, name, tabEmoji, orderArg, idPrefixArg] = process.argv.slice(2);
  if (!srcDir || !packId || !name || !tabEmoji) {
    console.error('Использование: node scripts/buildPackFromPng.js <srcDir> <packId> <name> <tabEmoji> [order] [idPrefix]');
    process.exit(1);
  }
  if (!/^[a-z0-9_]+$/.test(packId)) { console.error('packId должен быть [a-z0-9_]'); process.exit(1); }
  const order = orderArg ? Number(orderArg) : 100;
  const idPrefix = idPrefixArg || 's'; // суффикс id = <idPrefix><NN>

  const OUT = path.join(__dirname, '..', 'packs', packId);
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.webp')) fs.unlinkSync(path.join(OUT, f));
  }

  const files = fs.readdirSync(srcDir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!files.length) { console.error(`Нет PNG в ${srcDir}`); process.exit(1); }

  const stickers = [];
  let i = 0;
  for (const src of files) {
    i += 1;
    const id = `${idPrefix}${String(i).padStart(2, '0')}`;
    const file = `${id}.webp`;
    await sharp(path.join(srcDir, src))
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(OUT, file));
    stickers.push({ id: `${packId}_${id}`, file });
    console.log(`  ✓ ${src} → ${file}`);
  }

  const manifest = { packId, name, tabEmoji, order, isPremium: true, published: true, stickers };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Собрано ${stickers.length} стикеров → ${OUT}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
