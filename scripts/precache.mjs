import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const target = process.argv[2] || 'dist';
const base = process.argv[3] || '/';
async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map(async (file) =>
        file.isDirectory() ? walk(join(dir, file.name)) : join(dir, file.name),
      ),
    )
  ).flat();
}
const paths = (await walk(join(target, 'assets'))).map((path) => base + path.replace(target + '/', ''));
let sw = await readFile(join(target, 'sw.js'), 'utf8');
sw = sw
  .replace("const CACHE = 'batchlight-shell-v1';", `const CACHE = 'batchlight-shell-${Date.now()}';`)
  .replace(
    "['/', '/icon.svg', '/manifest.webmanifest']",
    JSON.stringify([base, base + 'icon.svg', base + 'manifest.webmanifest', ...paths]),
  );
if (!sw.includes(base + 'assets/'))
  throw new Error('Offline asset injection failed. Check the service worker template.');
await writeFile(join(target, 'sw.js'), sw);
console.log(`Prepared offline shell with ${paths.length} assets.`);
