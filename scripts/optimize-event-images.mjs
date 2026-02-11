import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PROJECT_ROOT = process.cwd();

// Directorio raíz de eventos
const EVENTS_ROOT = path.join(PROJECT_ROOT, 'src', 'assets', 'images', 'events');

// Ajustes “sweet spot” para web
const QUALITY = 82; // 80-85 recomendado
const EFFORT = 5; // 0-6 (más = más lento, mejor compresión)
const exts = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff']);

function getMaxSizeByName(filename) {
  const f = filename.toLowerCase();

  if (f.startsWith('hero')) return 2560;
  if (f.startsWith('portrait')) return 2048;
  if (f.startsWith('gallery-')) return 1920;

  return 2048;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function processOne(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // Si ya es webp o no es una imagen soportada, ignorar
  if (ext === '.webp' || !exts.has(ext)) return null;

  const dir = path.dirname(filePath);
  const name = path.parse(filePath).name;
  const outPath = path.join(dir, `${name}.webp`);

  // Si ya existe el webp, asumimos que está optimizado y borramos el original
  // O podríamos re-optimizar. Por seguridad, si existe, solo borramos el original.
  if (fs.existsSync(outPath)) {
      // fs.unlinkSync(filePath); // Descomentar para borrar automáticamente si ya existe
      return { skipped: true, path: filePath, reason: 'Ya existe .webp' };
  }

  const maxSize = getMaxSizeByName(name);
  const inStat = fs.statSync(filePath);
  const inSize = inStat.size;

  // Carga imagen
  let img = sharp(filePath, { failOnError: false });

  // Info para saber si redimensionar
  const meta = await img.metadata();
  const w = meta.width ?? maxSize;
  const h = meta.height ?? maxSize;

  if (Math.max(w, h) > maxSize) {
    img = img.resize({
      width: w >= h ? maxSize : null,
      height: h > w ? maxSize : null,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Escribe WebP optimizado
  await img
    .webp({
      quality: QUALITY,
      effort: EFFORT,
      smartSubsample: true,
    })
    .toFile(outPath);

  const outStat = fs.statSync(outPath);
  const outSize = outStat.size;

  const saved = inSize - outSize;
  const savedPct = inSize > 0 ? (saved / inSize) * 100 : 0;

  // Eliminar original
  fs.unlinkSync(filePath);

  return {
    rel: path.relative(EVENTS_ROOT, filePath),
    outRel: path.relative(EVENTS_ROOT, outPath),
    inSize,
    outSize,
    saved,
    savedPct,
  };
}

async function main() {
  if (!fs.existsSync(EVENTS_ROOT)) {
    console.error('No existe el directorio de entrada:', EVENTS_ROOT);
    process.exit(1);
  }

  const all = walk(EVENTS_ROOT).filter((f) => exts.has(path.extname(f).toLowerCase()));

  if (all.length === 0) {
    console.log('No se encontraron imágenes nuevas para optimizar en:', EVENTS_ROOT);
    process.exit(0);
  }

  console.log('Directorio:', EVENTS_ROOT);
  console.log(`Imágenes detectadas para procesar: ${all.length}\n`);

  let totalIn = 0;
  let totalOut = 0;
  let ok = 0;

  for (const f of all) {
    try {
      const r = await processOne(f);
      if (!r) continue;

      if (r.skipped) {
          console.log(`SKIP ${path.relative(EVENTS_ROOT, r.path)} -> WebP ya existe.`);
          // Opcional: fs.unlinkSync(r.path);
          continue;
      }

      ok++;
      totalIn += r.inSize;
      totalOut += r.outSize;

      console.log(
        `OPT ${r.rel} -> ${r.outRel}  ` +
        `${formatBytes(r.inSize)} -> ${formatBytes(r.outSize)}  ` +
        `(-${r.savedPct.toFixed(1)}%) [Original eliminado]`,
      );
    } catch (err) {
      console.error('ERR', path.relative(EVENTS_ROOT, f), err?.message ?? err);
    }
  }

  if (ok > 0) {
      const saved = totalIn - totalOut;
      const savedPct = totalIn > 0 ? (saved / totalIn) * 100 : 0;

      console.log('\nResumen:');
      console.log('Procesadas:', ok);
      console.log('Total antes:', formatBytes(totalIn));
      console.log('Total después:', formatBytes(totalOut));
      console.log('Ahorro:', formatBytes(saved), `(-${savedPct.toFixed(1)}%)`);
  } else {
      console.log('\nNada que procesar.');
  }
}

main();
