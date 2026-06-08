// Removes assets that should not ship to the web build. Cloudflare Pages has
// a 25 MB per-file limit. These big JSON blobs are only used by the mobile
// scanner / food-search flows and the code already falls back gracefully when
// they're absent (Supabase + Open Food Facts on web).
// Only runs on hosted CI builds — local builds and iOS keep the files.
import { rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ONLY_HOSTS = ['CF_PAGES', 'NETLIFY', 'VERCEL'];
const isHostedBuild = WEB_ONLY_HOSTS.some(k => process.env[k]);

if (!isHostedBuild) {
  console.log('[strip-web-only] local/native build — keeping web-only assets');
  process.exit(0);
}

const KNOWN_STRIPS = [
  'dist/barcodeDB.json',
  'dist/foodDatabase-full.json',
];

for (const target of KNOWN_STRIPS) {
  if (existsSync(target)) {
    const sizeMb = (statSync(target).size / 1024 / 1024).toFixed(1);
    rmSync(target, { force: true });
    console.log(`[strip-web-only] removed ${target} (${sizeMb} MB)`);
  } else {
    console.log(`[strip-web-only] ${target} not present, skipping`);
  }
}

// Safety net: scan dist/ for any other files over 24 MB and strip them too,
// so a new oversized asset doesn't silently break the deploy.
const SAFETY_LIMIT_BYTES = 24 * 1024 * 1024;
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else if (entry.isFile()) {
      try {
        const size = statSync(full).size;
        if (size > SAFETY_LIMIT_BYTES) {
          const sizeMb = (size / 1024 / 1024).toFixed(1);
          rmSync(full, { force: true });
          console.log(`[strip-web-only] safety-stripped ${full} (${sizeMb} MB — over 24 MB limit)`);
        }
      } catch { /* ignore */ }
    }
  }
}
if (existsSync('dist')) scan('dist');
