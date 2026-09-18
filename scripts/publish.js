'use strict';
// Copies the freshly built release binary to the project root as a single
// double-clickable entry point.
//
// Why this exists: src-tauri/target/ holds `debug` and `release` side by side and the two
// binaries share a name, so picking the wrong one in Explorer is easy and the symptoms are
// confusing rather than obvious — the debug build opens a console window and points at the
// dev server on 127.0.0.1, which is not running outside `npm run dev`. Without this step the
// root copy also goes stale silently after a rebuild, which is worse still.
//
// Usage: npm runs this automatically as the postbuild hook of `npm run build`.

const fs = require('node:fs');
const path = require('node:path');

const exe = process.platform === 'win32' ? '.exe' : '';
const from = path.join(__dirname, '..', 'src-tauri', 'target', 'release', `quiet-table${exe}`);
const to = path.join(__dirname, '..', `夜局${exe}`);

fs.copyFileSync(from, to);
console.log(`已发布 ${to} · ${(fs.statSync(to).size / 1048576).toFixed(1)} MB`);
