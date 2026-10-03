/**
 * Imports the 3D illustrations (600x600 PNG, made in Canva) into the app.
 *
 * Usage: node tools/pics/import.mjs <folder with <id>.png>
 *   ids: w-<word> (picture words), s-<sticker id>, m-<mascot>, b-<book>-<page>
 * Output: public/pics/<id>.webp (480 px) and content/kids/pics.json, the list
 * of ids the app can show. Words without a picture keep their emoji.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = process.argv[2];
if (!src) throw new Error('usage: node tools/pics/import.mjs <folder>');
const out = path.join(root, 'public/pics');
fs.mkdirSync(out, { recursive: true });
let added = 0;
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.png'))) {
  const id = f.slice(0, -4);
  if (!/^[a-z0-9-]+$/.test(id)) continue;
  const dest = path.join(out, `${id}.webp`);
  if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= fs.statSync(path.join(src, f)).mtimeMs) continue;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(src, f), '-vf', 'scale=480:480:flags=lanczos', '-c:v', 'libwebp', '-quality', '82', dest]);
  added++;
}
const ids = fs.readdirSync(out).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort();
fs.writeFileSync(path.join(root, 'content/kids/pics.json'), JSON.stringify(ids, null, 0) + '\n');
console.log(`${added} converted, ${ids.length} pictures in total`);
