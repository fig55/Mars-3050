'use strict';
// Copies the freshly built release artifact to the project root as a single
// double-clickable entry point.
//
// Why this exists: build artifacts live several directories below the project root. Keeping
// one predictable root-level entry point makes local testing straightforward and prevents an
// old copy from silently surviving a successful rebuild.
//
// Usage: npm runs this automatically as the postbuild hook of `npm run build`.

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const target = path.join(root, 'src-tauri', 'target');

if (process.platform === 'darwin') {
  const buildTarget = process.argv.includes('--mac-universal')
    ? path.join(target, 'universal-apple-darwin')
    : target;
  const from = path.join(buildTarget, 'release', 'bundle', 'macos', '夜局.app');
  const to = path.join(root, '夜局.app');

  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`已发布 ${to}`);
  process.exit(0);
}

const exe = process.platform === 'win32' ? '.exe' : '';
const from = path.join(target, 'release', `quiet-table${exe}`);
const to = path.join(root, `夜局${exe}`);

fs.copyFileSync(from, to);
console.log(`已发布 ${to} · ${(fs.statSync(to).size / 1048576).toFixed(1)} MB`);
