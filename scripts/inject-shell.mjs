/**
 * Injects the pre-rendered application shell into the built index.html.
 *
 * The app is a client-rendered SPA, so the built HTML otherwise contains an empty
 * <div id="root">. Crawlers and preview bots that do not execute JavaScript would
 * see no page content at all. `sites/app-shell.html` holds the real first-paint
 * markup captured from the running app; it is replaced by React on hydration.
 */
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';

const shellPath = 'sites/app-shell.html';
const indexPath = 'dist/index.html';
const marker = process.argv.includes('--strip') ? '' : null;

if (!existsSync(shellPath)) {
  console.log('[shell] sites/app-shell.html not found — skipping prerender injection');
  process.exit(0);
}
if (!existsSync(indexPath)) {
  console.error('[shell] dist/index.html not found — run the Vite build first');
  process.exit(1);
}

const shell = readFileSync(shellPath, 'utf8').trim();
let html = readFileSync(indexPath, 'utf8');

const anchor = '<div id="root"></div>';
if (!html.includes(anchor)) {
  console.error('[shell] could not find the empty root element in dist/index.html');
  process.exit(1);
}

html = html.replace(anchor, `<div id="root">${shell}</div>`);
writeFileSync(indexPath, html);
console.log(
  `[shell] injected ${(statSync(shellPath).size / 1024).toFixed(0)} kB of rendered markup into dist/index.html (${marker === null ? 'as captured' : 'stripped'})`,
);
