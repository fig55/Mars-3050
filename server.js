const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const allowed = { '/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/engine.js': 'engine.js', '/app.js': 'app.js', '/assets/players.png': 'assets/players.png' };
http.createServer((req,res)=> {
  const file = allowed[req.url.split('?')[0]];
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname,file),(error,data)=> { if(error) { res.writeHead(500); return res.end('Read failed'); } res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : `${file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript'}; charset=utf-8`); res.end(data); });
}).listen(5173,'127.0.0.1',()=>console.log('夜局 http://127.0.0.1:5173'));
