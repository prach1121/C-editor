'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const { spawn, execFile } = require('child_process');
const { fileURLToPath, pathToFileURL } = require('url');

// Low memory profile
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

let win = null;
let force = false;
const send = (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send(ch, d); };

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1280, height: 780, minWidth: 820, minHeight: 520,
    backgroundColor: '#07080b', title: 'C', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, spellcheck: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('close', (e) => { if (!force) { e.preventDefault(); send('ask-close'); } });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { cleanup(); app.quit(); });
function cleanup() { stopServer(); killRun(); dbgKill(); for (const k of Object.keys(liveProcs)) killTree(liveProcs[k]); }

ipcMain.handle('app:quit', () => { force = true; if (win) win.close(); });
ipcMain.handle('app:external', (_e, u) => { if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(u)) shell.openExternal(u); });

/* ---------- helpers ---------- */
function killTree(p) {
  if (!p || p.exitCode !== null) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true });
    else p.kill('SIGKILL');
  } catch (_) {}
}
const exeCache = {};
function findExe(n) {
  return new Promise((res) => {
    if (exeCache[n]) return res(exeCache[n]);
    execFile(process.platform === 'win32' ? 'where' : 'which', [n], { windowsHide: true }, (e, so) => {
      if (e || !so) return res(null);
      exeCache[n] = so.split(/\r?\n/)[0].trim();
      res(exeCache[n]);
    });
  });
}
function parseHP(s) {
  s = String(s || '').trim().replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '');
  const i = s.lastIndexOf(':');
  if (i < 0) return null;
  const host = s.slice(0, i) || 'localhost';
  const port = Number(s.slice(i + 1));
  if (!(port > 0 && port < 65536)) return null;
  return { host, port };
}
const listenHost = (h) => (h === 'localhost' ? '127.0.0.1' : h);

/* ---------- dialogs and files ---------- */
ipcMain.handle('dlg:files', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('dlg:folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dlg:saveAs', async (_e, { name, dir, text }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: dir ? path.join(dir, name) : name });
  if (r.canceled || !r.filePath) return null;
  try { await fs.promises.writeFile(r.filePath, text, 'utf8'); } catch (e) { return { error: e.message }; }
  broadcast();
  return { path: r.filePath };
});
ipcMain.handle('fs:dir', async (_e, d) => {
  try {
    const ents = await fs.promises.readdir(d, { withFileTypes: true });
    return ents
      .filter((e) => e.name !== '.git' && e.name !== 'node_modules')
      .map((e) => ({ name: e.name, path: path.join(d, e.name), dir: e.isDirectory() }))
      .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : a.dir ? -1 : 1))
      .slice(0, 3000);
  } catch (_) { return []; }
});
ipcMain.handle('fs:read', async (_e, p) => {
  try {
    const st = await fs.promises.stat(p);
    if (st.isDirectory()) return { dir: true };
    if (st.size > 10 * 1024 * 1024) return { error: 'File is larger than 10 MB' };
    const b = await fs.promises.readFile(p);
    if (b.subarray(0, 8000).includes(0)) return { error: 'Binary file, cannot edit as text' };
    let t = b.toString('utf8');
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
    return { text: t };
  } catch (e) { return { error: e.message }; }
});
ipcMain.handle('fs:write', async (_e, p, text) => {
  try { await fs.promises.writeFile(p, text, 'utf8'); broadcast(); return { ok: true }; }
  catch (e) { return { error: e.message }; }
});
ipcMain.handle('fs:search', async (_e, { root, q }) => {
  const res = []; const ql = q.toLowerCase();
  const walk = async (d, depth) => {
    if (res.length >= 300 || depth > 8) return;
    let ents; try { ents = await fs.promises.readdir(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      if (res.length >= 300) return;
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { await walk(p, depth + 1); continue; }
      try {
        const st = await fs.promises.stat(p); if (st.size > 1e6) continue;
        const b = await fs.promises.readFile(p); if (b.subarray(0, 4000).includes(0)) continue;
        const lines = b.toString('utf8').split('\n');
        for (let i = 0; i < lines.length && res.length < 300; i++) {
          if (lines[i].toLowerCase().includes(ql)) res.push({ path: p, rel: path.relative(root, p), line: i + 1, text: lines[i].trim().slice(0, 160) });
        }
      } catch (_) {}
    }
  };
  await walk(root, 0);
  return res;
});

/* ---------- port + local sandbox server ---------- */
let server = null, serverInfo = null;
const overlay = new Map();
const sse = new Set();
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.mp4': 'video/mp4'
};
const RELOAD = '<script>try{new EventSource("/__reload").onmessage=function(){location.reload()}}catch(e){}</script>';
const inject = (h) => (/<\/body>/i.test(h) ? h.replace(/<\/body>/i, RELOAD + '</body>') : h + RELOAD);
function broadcast() { for (const c of sse) { try { c.write('data: r\n\n'); } catch (_) {} } }

ipcMain.handle('port:check', (_e, s) => new Promise((res) => {
  const hp = parseHP(s);
  if (!hp) return res('invalid');
  if (serverInfo && serverInfo.port === hp.port) return res('bound');
  const t = net.createServer();
  t.once('error', (e) => res(e.code === 'EADDRINUSE' || e.code === 'EACCES' ? 'busy' : 'invalid'));
  t.once('listening', () => t.close(() => res('available')));
  t.listen(hp.port, listenHost(hp.host));
}));

function stopServer() {
  for (const c of sse) { try { c.end(); } catch (_) {} }
  sse.clear(); overlay.clear();
  if (server) { try { server.close(); if (server.closeAllConnections) server.closeAllConnections(); } catch (_) {} }
  server = null; serverInfo = null;
}
ipcMain.handle('srv:stop', () => { stopServer(); return true; });
ipcMain.handle('srv:overlay', (_e, p, text) => {
  const k = path.normalize(p);
  if (text == null) overlay.delete(k); else overlay.set(k, text);
  broadcast();
  return true;
});
ipcMain.handle('srv:start', (_e, bind, root) => new Promise((res) => {
  stopServer();
  const hp = parseHP(bind);
  if (!hp) return res({ ok: false, error: 'Invalid address. Use host:port, for example localhost:2000' });
  root = path.normalize(root);
  const s = http.createServer((req, rsp) => handle(req, rsp, root));
  s.once('error', (e) => res({ ok: false, error: e.code === 'EADDRINUSE' ? 'Port in use' : e.message }));
  s.listen(hp.port, listenHost(hp.host), () => {
    server = s; serverInfo = hp;
    res({ ok: true, url: `http://${hp.host}:${hp.port}` });
  });
}));

async function handle(req, rsp, root) {
  const reply = (c, t, b) => { rsp.writeHead(c, { 'Content-Type': t, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }); rsp.end(b); };
  try {
    const u = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(u.pathname);
    if (p === '/__reload') {
      rsp.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
      rsp.write('\n'); sse.add(rsp); req.on('close', () => sse.delete(rsp)); return;
    }
    let fp = path.normalize(path.join(root, p));
    const rel = path.relative(root, fp);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return reply(403, 'text/plain', 'Forbidden');
    let st = await fs.promises.stat(fp).catch(() => null);
    if (st && st.isDirectory()) {
      let f = null;
      for (const n of ['index.html', 'index.htm', 'index.php']) {
        const c = path.join(fp, n);
        if (overlay.has(c) || fs.existsSync(c)) { f = c; break; }
      }
      if (!f) {
        const ents = await fs.promises.readdir(fp, { withFileTypes: true });
        const base = p.endsWith('/') ? p : p + '/';
        const li = ents.map((e) => `<li><a href="${encodeURI(base + e.name)}">${e.name}${e.isDirectory() ? '/' : ''}</a></li>`).join('');
        return reply(200, 'text/html; charset=utf-8', `<body style="font:14px sans-serif"><ul>${li}</ul></body>`);
      }
      fp = f; st = null;
    }
    const ext = path.extname(fp).toLowerCase();
    if (ext === '.php' && fs.existsSync(fp)) return runPhpHttp(fp, req, rsp, root, u, reply);
    let buf;
    if (overlay.has(fp)) buf = Buffer.from(overlay.get(fp));
    else if (st || fs.existsSync(fp)) buf = await fs.promises.readFile(fp);
    else return reply(404, 'text/plain', 'Not found');
    if (ext === '.html' || ext === '.htm') buf = Buffer.from(inject(buf.toString('utf8')));
    reply(200, MIME[ext] || 'application/octet-stream', buf);
  } catch (e) { reply(500, 'text/plain', String(e.message)); }
}

async function runPhpHttp(fp, req, rsp, root, u, reply) {
  const cgi = await findExe('php-cgi');
  const php = cgi || (await findExe('php'));
  if (!php) return reply(500, 'text/plain', 'PHP was not found in PATH.');
  const env = {
    ...process.env, GATEWAY_INTERFACE: 'CGI/1.1', REDIRECT_STATUS: '1', SCRIPT_FILENAME: fp, SCRIPT_NAME: u.pathname,
    REQUEST_URI: req.url, REQUEST_METHOD: req.method, QUERY_STRING: u.search.slice(1), SERVER_PROTOCOL: 'HTTP/1.1',
    CONTENT_TYPE: req.headers['content-type'] || '', CONTENT_LENGTH: req.headers['content-length'] || '0',
    DOCUMENT_ROOT: root, HTTP_COOKIE: req.headers.cookie || '', HTTP_HOST: req.headers.host || ''
  };
  const cp = spawn(php, cgi ? [] : ['-f', fp], { env, cwd: path.dirname(fp), windowsHide: true });
  const chunks = [];
  cp.stdout.on('data', (d) => chunks.push(d));
  cp.stdin.on('error', () => {});
  req.pipe(cp.stdin);
  cp.on('error', (e) => reply(500, 'text/plain', e.message));
  cp.on('close', () => {
    let out = Buffer.concat(chunks); let status = 200;
    const h = { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
    if (cgi) {
      const s = out.toString('latin1'); const m = /\r?\n\r?\n/.exec(s);
      if (m) {
        out = out.subarray(m.index + m[0].length);
        s.slice(0, m.index).split(/\r?\n/).forEach((l) => {
          const i = l.indexOf(':'); if (i < 0) return;
          const k = l.slice(0, i).trim(), v = l.slice(i + 1).trim(), kl = k.toLowerCase();
          if (kl === 'status') status = parseInt(v, 10) || 200;
          else if (kl === 'content-type') h['Content-Type'] = v;
          else if (kl === 'set-cookie') (h['Set-Cookie'] = h['Set-Cookie'] || []).push(v);
          else h[k] = v;
        });
      }
    }
    const body = /text\/html/i.test(h['Content-Type']) ? Buffer.from(inject(out.toString('utf8'))) : out;
    rsp.writeHead(status, h); rsp.end(body);
  });
}

/* ---------- run / live ---------- */
let runProc = null;
const liveProcs = {};
function killRun() { if (runProc) { killTree(runProc); runProc = null; } }
ipcMain.handle('run:kill', () => { killRun(); return true; });

function capture(cmd, args, { input, cwd, timeout = 5000, env } = {}, slot) {
  return new Promise((res) => {
    if (slot && liveProcs[slot]) killTree(liveProcs[slot]);
    const p = spawn(cmd, args, { cwd, env: env || process.env, windowsHide: true });
    if (slot) liveProcs[slot] = p;
    let so = '', se = '';
    const to = setTimeout(() => killTree(p), timeout);
    p.stdout.on('data', (d) => { if (so.length < 200000) so += d; });
    p.stderr.on('data', (d) => { if (se.length < 200000) se += d; });
    p.on('error', (e) => { clearTimeout(to); res({ code: -1, so, se: e.message }); });
    p.on('close', (c) => { clearTimeout(to); res({ code: c, so, se }); });
    p.stdin.on('error', () => {});
    if (input != null) p.stdin.write(input);
    p.stdin.end();
  });
}

function parseCs(txt) {
  const seen = new Set(), res = [];
  const re = /\((\d+),(\d+)\):\s*(error|warning)\s+(\w+):\s*([^\r\n\[]*)/g; let m;
  while ((m = re.exec(txt))) {
    const k = m[1] + ':' + m[2] + ':' + m[4]; if (seen.has(k)) continue; seen.add(k);
    res.push({ sev: m[3], line: +m[1], col: +m[2], msg: m[4] + ': ' + m[5].trim() });
  }
  return res;
}
function parsePhp(txt) {
  const seen = new Set(), res = [];
  const re = /(Parse error|Fatal error|Warning|Notice|Deprecated):\s+(.*?) in .*? on line (\d+)/g; let m;
  while ((m = re.exec(txt))) {
    const k = m[3] + m[2]; if (seen.has(k)) continue; seen.add(k);
    res.push({ sev: /Parse|Fatal/.test(m[1]) ? 'error' : 'warning', line: +m[3], col: 1, msg: m[1] + ': ' + m[2] });
  }
  return res;
}

let dotnetMajor = null;
async function csProject(dn, content, sub) {
  const dir = path.join(os.tmpdir(), 'c-sandbox', sub);
  await fs.promises.mkdir(dir, { recursive: true });
  if (!dotnetMajor) {
    const v = await capture(dn, ['--version'], { timeout: 15000 });
    dotnetMajor = (/^(\d+)/.exec(v.so.trim()) || [])[1] || '8';
  }
  const proj = `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net${dotnetMajor}.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>disable</Nullable><InvariantGlobalization>true</InvariantGlobalization><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs" /></ItemGroup></Project>`;
  const pj = path.join(dir, 'App.csproj');
  const cur = await fs.promises.readFile(pj, 'utf8').catch(() => '');
  if (cur !== proj) await fs.promises.writeFile(pj, proj);
  await fs.promises.writeFile(path.join(dir, 'Program.cs'), content);
  return dir;
}
const dotnetEnv = () => ({
  ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_CLI_UI_LANGUAGE: 'en',
  UseSharedCompilation: 'false', MSBUILDDISABLENODEREUSE: '1', DOTNET_gcServer: '0', DOTNET_TieredPGO: '0'
});
const PHP_BLOCK = 'exec,system,passthru,shell_exec,proc_open,popen,pcntl_exec,unlink,rmdir,rename,file_put_contents,fopen,mkdir,copy,chmod,touch,symlink,link,curl_exec,fsockopen,mail';

ipcMain.handle('live:php', async (_e, { content, cwd }) => {
  const php = await findExe('php');
  if (!php) return { missing: true };
  const base = cwd || os.tmpdir();
  const r = await capture(php, [
    '-d', 'display_errors=1', '-d', 'error_reporting=E_ALL', '-d', 'log_errors=0', '-d', 'html_errors=0',
    '-d', 'disable_functions=' + PHP_BLOCK, '-d', 'open_basedir=' + base + path.delimiter + os.tmpdir()
  ], { input: content, cwd: base, timeout: 4000 }, 'php');
  return { so: r.so, se: r.se, diags: parsePhp(r.so + '\n' + r.se) };
});
ipcMain.handle('live:cs', async (_e, { content }) => {
  const dn = await findExe('dotnet');
  if (!dn) return { missing: true };
  const dir = await csProject(dn, content, 'cs-live');
  const r = await capture(dn, ['build', '--nologo', '-v', 'q', '-clp:NoSummary'], { cwd: dir, timeout: 120000, env: dotnetEnv() }, 'cs');
  return { diags: parseCs(r.so + '\n' + r.se), ok: r.code === 0 };
});

ipcMain.handle('run:start', async (_e, { kind, content, cwd, file }) => {
  killRun();
  const out = (k, t) => send('run:out', { k, t });
  const end = (c) => send('run:end', { code: c });
  const go = (cmd, args, opts, input, parse) => {
    const p = spawn(cmd, args, { cwd: cwd || os.tmpdir(), windowsHide: true, ...opts });
    runProc = p; let all = '';
    p.stdin.on('error', () => {});
    if (input != null) p.stdin.write(input);
    p.stdin.end();
    p.stdout.on('data', (d) => { all += d; out('out', d.toString()); });
    p.stderr.on('data', (d) => { all += d; out('err', d.toString()); });
    p.on('error', (e) => { out('err', e.message); end(-1); });
    p.on('close', (c) => { if (runProc === p) runProc = null; if (parse) send('run:diag', parse(all)); end(c); });
  };
  if (kind === 'js') {
    go(process.execPath, ['-e', content], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
  } else if (kind === 'php') {
    const php = await findExe('php');
    if (!php) { out('err', 'PHP was not found in PATH. Install PHP and restart C.'); end(-1); return; }
    go(php, ['-d', 'display_errors=1', '-d', 'error_reporting=E_ALL', '-d', 'html_errors=0'], {}, content, parsePhp);
  } else if (kind === 'cs') {
    const dn = await findExe('dotnet');
    if (!dn) { out('err', 'The .NET SDK (dotnet) was not found in PATH. Install it and restart C.'); end(-1); return; }
    out('sys', 'Building...\n');
    const dir = await csProject(dn, content, 'cs-run');
    go(dn, ['run', '--nologo', '-v', 'q'], { cwd: dir, env: dotnetEnv() }, null, parseCs);
  } else { out('err', 'No runner for this file type.'); end(-1); }
  return { ok: true };
});

/* ---------- JavaScript debugger (Node inspector) ---------- */
let dbg = null;
function dbgKill() {
  if (!dbg) return;
  const d = dbg; dbg = null;
  try { if (d.ws) d.ws.close(); } catch (_) {}
  killTree(d.proc);
}
function cdp(method, params = {}) {
  return new Promise((res, rej) => {
    if (!dbg || !dbg.ws || dbg.ws.readyState !== 1) return rej(new Error('Debugger is not connected'));
    const id = ++dbg.id; dbg.pend.set(id, { res, rej });
    dbg.ws.send(JSON.stringify({ id, method, params }));
  });
}
const fmtVal = (v) => (v.type === 'string' ? JSON.stringify(v.value) : 'value' in v ? String(v.value) : v.description || v.type);
const urlPath = (u) => { try { return u.startsWith('file:') ? fileURLToPath(u) : u; } catch (_) { return u; } };
const HIDE = new Set(['exports', 'require', 'module', '__filename', '__dirname']);

async function scopesFor(i) {
  const f = dbg && dbg.raw && dbg.raw[i]; if (!f) return [];
  const res = [];
  for (const sc of f.scopeChain) {
    if (sc.type === 'global') continue;
    try {
      const r = await cdp('Runtime.getProperties', { objectId: sc.object.objectId, ownProperties: true });
      const vars = r.result.filter((p) => p.value !== undefined && !(sc.type === 'local' && HIDE.has(p.name))).slice(0, 80)
        .map((p) => ({ n: p.name, v: fmtVal(p.value) }));
      res.push({ name: sc.type[0].toUpperCase() + sc.type.slice(1), vars });
    } catch (_) {}
  }
  return res;
}
async function setBps(list) {
  for (const id of dbg.bpIds) { try { await cdp('Debugger.removeBreakpoint', { breakpointId: id }); } catch (_) {} }
  dbg.bpIds = [];
  for (const b of list || []) {
    try {
      const r = await cdp('Debugger.setBreakpointByUrl', { lineNumber: b.line - 1, url: pathToFileURL(b.file).href });
      dbg.bpIds.push(r.breakpointId);
    } catch (_) {}
  }
}
async function onCdp(msg) {
  if (!dbg) return;
  if (msg.id) { const p = dbg.pend.get(msg.id); if (p) { dbg.pend.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); } return; }
  if (msg.method === 'Debugger.paused') {
    const p = msg.params;
    if (dbg.first) {
      dbg.first = false;
      if (!(p.hitBreakpoints && p.hitBreakpoints.length)) { cdp('Debugger.resume').catch(() => {}); return; }
    }
    dbg.raw = p.callFrames; dbg.paused = true;
    let frames = p.callFrames.map((f, i) => ({ i, fn: f.functionName || '(anonymous)', file: urlPath(f.url), line: f.location.lineNumber + 1, col: f.location.columnNumber + 1 }));
    const user = frames.filter((f) => !/^node:/.test(f.file));
    if (user.length) frames = user;
    const scopes = await scopesFor(frames[0].i);
    send('dbg:paused', { reason: p.reason, frames, scopes });
  } else if (msg.method === 'Debugger.resumed') {
    dbg.paused = false; send('dbg:resumed', {});
  }
}
ipcMain.handle('dbg:start', (_e, { file, cwd, bps }) => new Promise((resolve) => {
  dbgKill();
  let WebSocket; try { WebSocket = require('ws'); } catch (_) { return resolve({ ok: false, error: 'Run npm install first (missing ws module)' }); }
  const proc = spawn(process.execPath, ['--inspect-brk=0', file], { cwd, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true });
  const me = { proc, ws: null, id: 0, pend: new Map(), raw: null, bpIds: [], first: true, paused: false };
  dbg = me;
  let done = false, buf = '';
  proc.stdout.on('data', (d) => send('run:out', { k: 'out', t: d.toString() }));
  proc.stderr.on('data', (d) => {
    const s = d.toString(); buf += s;
    const m = /ws:\/\/[^\s]+/.exec(buf);
    if (m && !done) {
      done = true;
      const ws = new WebSocket(m[0]); me.ws = ws;
      ws.on('open', async () => {
        try {
          await cdp('Runtime.enable'); await cdp('Debugger.enable'); await setBps(bps);
          await cdp('Runtime.runIfWaitingForDebugger'); resolve({ ok: true });
        } catch (e) { resolve({ ok: false, error: e.message }); }
      });
      ws.on('message', (raw) => { try { onCdp(JSON.parse(raw.toString())); } catch (_) {} });
      ws.on('error', (e) => resolve({ ok: false, error: e.message }));
    }
    const clean = s.split('\n').filter((l) => !/^(Debugger listening|For help, see|Debugger attached|Waiting for the debugger)/.test(l)).join('\n');
    if (clean.trim()) send('run:out', { k: 'err', t: clean });
  });
  proc.on('error', (e) => resolve({ ok: false, error: e.message }));
  proc.on('exit', (code) => {
    send('run:end', { code });
    if (dbg === me) { dbg = null; send('dbg:end', { code }); }
    if (!done) resolve({ ok: false, error: 'Process exited before the debugger attached' });
  });
}));
ipcMain.handle('dbg:cmd', async (_e, c) => {
  if (!dbg) return false;
  if (c === 'stop') { dbgKill(); send('dbg:end', { code: null }); return true; }
  const map = { resume: 'Debugger.resume', over: 'Debugger.stepOver', into: 'Debugger.stepInto', out: 'Debugger.stepOut', pause: 'Debugger.pause' };
  try { await cdp(map[c]); } catch (_) {}
  return true;
});
ipcMain.handle('dbg:bps', async (_e, list) => { if (dbg) await setBps(list); return true; });
ipcMain.handle('dbg:scopes', async (_e, i) => (dbg ? scopesFor(i) : []));
ipcMain.handle('dbg:eval', async (_e, { expr, frame }) => {
  try {
    const r = dbg && dbg.paused && dbg.raw && dbg.raw[frame || 0]
      ? await cdp('Debugger.evaluateOnCallFrame', { callFrameId: dbg.raw[frame || 0].callFrameId, expression: expr })
      : await cdp('Runtime.evaluate', { expression: expr });
    if (r.exceptionDetails) return { ok: false, v: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text };
    return { ok: true, v: fmtVal(r.result) };
  } catch (e) { return { ok: false, v: e.message }; }
});
