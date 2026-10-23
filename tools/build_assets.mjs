// Builds web-optimised photo + audio assets from the local source folders.
//
//   SRC=/Users/djati/Movies/freyaproject node tools/build_assets.mjs
//
// Output (committed to the repo so Vercel needs no source assets):
//   public/photos/box{1-6}/{nn}.webp        full size (max 1600px long edge)
//   public/photos/box{1-6}/{nn}-t.webp      thumbnail (360px long edge)
//   public/photos/board/{nn}.webp           cardboard-wall photos (max 1600px)
//   public/audio/*.mp3
//   src/data/memories.json                  titles / notes / file refs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.env.SRC ?? '/Users/djati/Movies/freyaproject';
const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'public');

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'curated_manifest.json'), 'utf8'));
const boardMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/cardboard_map.json'), 'utf8'));

const BOXES = [
  { key: 'box_1_academy_jkt48', era: 'academy_jkt48', slug: 'Box_AcademyJKT48', color: '#ff8fb8' },
  { key: 'box_2_new_era', era: 'new_era', slug: 'Box_NewEra', color: '#8ec5ff' },
  { key: 'box_3_meme_queen', era: 'meme_queen', slug: 'Box_MemeQueen', color: '#9be3a8' },
  { key: 'box_4_senbatsu', era: 'senbatsu', slug: 'Box_Senbatsu', color: '#b69cff' },
  { key: 'box_5_movie_star', era: 'movie_star', slug: 'Box_MovieStar', color: '#ffc29a' },
  { key: 'box_6_the_captain', era: 'the_captain', slug: 'Box_TheCaptain', color: '#ff9aa8' },
];

async function resize(input, output, long, quality) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(input)
    .rotate()
    .resize({ width: long, height: long, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toFile(output);
}

const pad = (n) => String(n).padStart(2, '0');
const out = { boxes: [], board: {} };

for (const [i, b] of BOXES.entries()) {
  const n = i + 1;
  const era = manifest.eras[b.era];
  const photos = [];
  // The folder on disk is the source of truth (the manifest lags behind re-curations);
  // titles/notes are joined by original filename where the manifest knows them.
  const meta = new Map();
  for (const p of era.hero_photos) meta.set(p.filename, p);
  for (const p of manifest.boxes[b.key]) if (!meta.has(p.original_filename)) meta.set(p.original_filename, p);
  const dir = path.join(SRC, 'Photo/curated_boxes', b.key);
  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  for (const file of files) {
    const m = file.match(/^(\d+)_(.+)$/);
    const id = pad(Number(m[1]));
    const info = meta.get(m[2]);
    await resize(path.join(dir, file), path.join(PUB, `photos/box${n}/${id}.webp`), 1600, 78);
    await resize(path.join(dir, file), path.join(PUB, `photos/box${n}/${id}-t.webp`), 360, 70);
    photos.push({
      id,
      title: info?.title ?? `${era.era_name} #${id}`,
      category: info?.category ?? era.era_name,
      note: info?.curator_note ?? '',
      full: `/photos/box${n}/${id}.webp`,
      thumb: `/photos/box${n}/${id}-t.webp`,
    });
  }
  out.boxes.push({ n, slug: b.slug, label: era.box_label, name: era.era_name, color: b.color, photos });
  console.log('box', n, photos.length);
}

// cardboard wall: object name -> source file (from the Blender scene)
for (const [obj, file] of Object.entries(boardMap)) {
  const src = path.join(SRC, 'output/cardboard_wall_photos', file);
  if (!fs.existsSync(src)) { console.warn('missing board photo', file); continue; }
  const id = obj.replace(/\D/g, '');
  await resize(src, path.join(PUB, `photos/board/${id}.webp`), 1400, 78);
  out.board[obj] = `/photos/board/${id}.webp`;
}

// audio
fs.mkdirSync(path.join(PUB, 'audio'), { recursive: true });
for (const [from, to] of [
  ['bgm/JKT48 - Waiting Room.mp3', 'waiting-room.mp3'],
  ['bgm/indoor-footsteps.mp3', 'footsteps.mp3'],
  ['bgm/door-open.mp3', 'box-open.mp3'],
]) fs.copyFileSync(path.join(SRC, from), path.join(PUB, 'audio', to));

fs.mkdirSync(path.join(ROOT, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/data/memories.json'), JSON.stringify(out, null, 1));
console.log('done');
