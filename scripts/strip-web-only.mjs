// Removes assets that should not ship to the web build (Cloudflare Pages has a
// 25 MB per-file limit, and the local barcode DB isn't needed on desktop —
// the scanner falls back to Supabase + Open Food Facts).
// Only runs on Cloudflare; local builds and iOS keep the file.
import { rmSync, existsSync } from 'node:fs';

const WEB_ONLY_HOSTS = ['CF_PAGES', 'NETLIFY', 'VERCEL'];
const isHostedBuild = WEB_ONLY_HOSTS.some(k => process.env[k]);

if (!isHostedBuild) {
  console.log('[strip-web-only] local/native build — keeping web-only assets');
  process.exit(0);
}

const path = 'dist/barcodeDB.json';
if (existsSync(path)) {
  rmSync(path, { force: true });
  console.log(`[strip-web-only] removed ${path} for hosted web build`);
} else {
  console.log(`[strip-web-only] ${path} not present, skipping`);
}
