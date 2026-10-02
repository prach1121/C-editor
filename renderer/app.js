'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- icons ---------- */
const I = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  code: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8.5h18"/><path d="m10.5 11.5-2.5 2.5 2.5 2.5"/><path d="m13.5 11.5 2.5 2.5-2.5 2.5"/>',
  bug: '<path d="M8.5 9h7v6a3.5 3.5 0 0 1-7 0z"/><path d="M9.5 5l1.6 2M14.5 5l-1.6 2M4 10h4.5M15.5 10H20M4 15h4.5M15.5 15H20M5.5 20l3.2-3M18.5 20l-3.2-3M12 9v9"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  over: '<path d="M4 14a8 8 0 0 1 15-3.5"/><path d="M19.5 5v5.5H14"/><circle cx="12" cy="19.5" r="1.4" fill="currentColor"/>',
  into: '<path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><circle cx="12" cy="20" r="1.4" fill="currentColor"/>',
  outi: '<path d="M12 15V4"/><path d="m7 8 5-5 5 5"/><circle cx="12" cy="20" r="1.4" fill="currentColor"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18"/>'
};
const svg = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
document.querySelectorAll('[data-i]').forEach((e) => { e.innerHTML = svg(e.dataset.i); });
const ICO_ERR = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f14c4c"/><path d="M8.2 8.2l7.6 7.6M15.8 8.2l-7.6 7.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
const ICO_WARN = '<svg viewBox="0 0 24 24"><path d="M12 2.5 23 21.5H1z" fill="#f5b50a" stroke="#f5b50a" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 9v6" stroke="#1a1a1a" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18" r="1.4" fill="#1a1a1a"/></svg>';

/* ---------- helpers ---------- */
const base = (p) => p.split(/[\\/]/).pop();
const dir = (p) => { if (!p) return ''; const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i < 0 ? '' : p.slice(0, i); };
const extOf = (n) => { n = n.toLowerCase(); const i = n.lastIndexOf('.'); return i < 0 ? n : n.slice(i + 1); };
const KIND = { js: 'js', cjs: 'js', php: 'php', phtml: 'php', cs: 'cs', html: 'html', htm: 'html' };
const kindOf = (t) => (t ? KIND[extOf(t.name)] || null : null);
const FC = { js: '#e5c07b', mjs: '#e5c07b', cjs: '#e5c07b', ts: '#4b8bbe', jsx: '#61afef', tsx: '#61afef', cs: '#b57edc', html: '#e8664a', htm: '#e8664a', php: '#8d9ad6', css: '#56a0e0', scss: '#e06c9f', json: '#cbcb41', md: '#6cb6d9', py: '#5aa0d8', java: '#e0795a', c: '#6a9fd8', cpp: '#6a9fd8', h: '#9aa6b8', go: '#4fc3d9', rs: '#d98a5f', sh: '#7fcf7f', sql: '#d9a05b', xml: '#e8964a', svg: '#e8b04a', yml: '#d9737a', yaml: '#d9737a' };
const fileIcon = (n) => `<span class="fi" style="color:${FC[extOf(n)] || '#7d8596'}">${svg('file')}</span>`;
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
let toastT;
function toast(m) { const e = $('#toast'); e.textContent = m; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 3800); }

/* ---------- state ---------- */
const S = { tabs: [], cur: null, root: null, live: true, bound: false, serverUrl: null, serverRoot: null, running: false, side: null, dock: null, diags: new Map(), seq: 0, runTab: null, dbg: { on: false, paused: false, mark: null, frame: 0 } };
const ta = $('#ta'), hl = $('#hl'), gut = $('#gut'), fr = $('#frame');
const MISS = { php: 'PHP was not found in PATH. Install PHP and restart C.', cs: 'The .NET SDK (dotnet) was not found in PATH. Install it and restart C.' };

/* ---------- tabs ---------- */
function mkTab(o) {
  const t = { id: ++S.seq, path: o.path || null, name: o.name, text: o.text, saved: o.text, eol: o.eol || '\n', bps: new Set(), st: 0, sl: 0, sel: 0 };
  S.tabs.push(t); return t;
}
const dirty = (t) => t.text !== t.saved;
function renderTabs() {
  $('#tabs').innerHTML = S.tabs.map((t) => `<div class="tab${t === S.cur ? ' on' : ''}${dirty(t) ? ' d' : ''}" data-id="${t.id}">${fileIcon(t.name)}<span>${esc(t.name)}</span><button class="x" data-x="${t.id}">${svg('x')}</button></div>`).join('');
  const a = $('.tab.on'); if (a) a.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
$('#tabs').addEventListener('click', (e) => {
  const x = e.target.closest('[data-x]');
  if (x) { closeTab(S.tabs.find((a) => a.id == x.dataset.x)); return; }
  const el = e.target.closest('.tab');
  if (el) { const t = S.tabs.find((a) => a.id == el.dataset.id); if (t && t !== S.cur) activate(t); }
});
$('#tabs').addEventListener('auxclick', (e) => { if (e.button !== 1) return; const el = e.target.closest('.tab'); if (el) closeTab(S.tabs.find((a) => a.id == el.dataset.id)); });

function stash() { const t = S.cur; if (t) { t.st = ta.scrollTop; t.sl = ta.scrollLeft; t.sel = ta.selectionStart; } }
function activate(t) {
  stash(); S.cur = t;
  $('#empty').hidden = true; $('#ed').hidden = false;
  ta.value = t.text; lastKey = '';
  renderTabs(); renderCode();
  ta.scrollTop = t.st; ta.scrollLeft = t.sl; syncScroll();
  ta.setSelectionRange(t.sel, t.sel); ta.focus();
  status(); renderProblems(); updateCurLine();
  const k = kindOf(t);
  if (k && S.live) { showDock(k === 'html' || k === 'php' ? 'preview' : 'output'); liveRun(t); }
}
function closeTab(t) {
  if (!t) return;
  if (dirty(t) && !confirm(`Discard unsaved changes to ${t.name}?`)) return;
  if (S.bound && t.path) api.overlay(t.path, null);
  const i = S.tabs.indexOf(t); S.tabs.splice(i, 1); S.diags.delete(t.id);
  if (S.cur === t) {
    S.cur = null;
    if (S.tabs.length) activate(S.tabs[Math.min(i, S.tabs.length - 1)]);
    else { $('#ed').hidden = true; $('#empty').hidden = false; renderTabs(); status(); renderProblems(); }
  } else renderTabs();
}
async function openPath(p, line) {
  let t = S.tabs.find((x) => x.path === p);
  if (!t) {
    const r = await api.read(p);
    if (r.dir) { await setRoot(p); side('explorer'); return; }
    if (r.error) { toast(`${base(p)}: ${r.error}`); return; }
    t = mkTab({ path: p, name: base(p), text: r.text.replace(/\r\n/g, '\n'), eol: r.text.includes('\r\n') ? '\r\n' : '\n' });
  }
  if (t !== S.cur) activate(t);
  if (line) gotoLine(line);
}
function newFile() { const t = mkTab({ name: 'untitled.txt', text: '' }); activate(t); }

/* ---------- editor rendering ---------- */
let lastKey = '', rq = 0;
function diagLines(t) {
  const m = new Map();
  for (const d of S.diags.get(t.id) || []) { if (d.sev === 'error') m.set(d.line, 'er'); else if (!m.has(d.line)) m.set(d.line, 'wr'); }
  return m;
}
function renderCode() {
  const t = S.cur; if (!t) return;
  const x = t.text;
  hl.innerHTML = (x.length < 300000 ? HL.highlight(x, extOf(t.name)) : esc(x)) + '\n';
  gutter();
}
function gutter() {
  const t = S.cur; if (!t) return;
  const x = t.text; let n = 1;
  for (let i = x.indexOf('\n'); i !== -1; i = x.indexOf('\n', i + 1)) n++;
  const ds = diagLines(t);
  const key = t.id + '|' + n + '|' + [...t.bps].sort().join(',') + '|' + [...ds].join(',');
  if (key === lastKey) return; lastKey = key;
  let h = '';
  for (let i = 1; i <= n; i++) h += `<div class="ln${t.bps.has(i) ? ' bp' : ''}${ds.has(i) ? ' ' + ds.get(i) : ''}">${i}</div>`;
  gut.innerHTML = h; gut.scrollTop = ta.scrollTop;
}
const schedRender = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; renderCode(); }); };
function syncScroll() { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; }
ta.addEventListener('scroll', () => { syncScroll(); updateCurLine(); });
function status() {
  const t = S.cur;
  if (!t) { $('#pos').textContent = '0 line 0 Col'; return; }
  const v = ta.value, pos = ta.selectionStart; let line = 1, i = -1;
  for (;;) { i = v.indexOf('\n', i + 1); if (i === -1 || i >= pos) break; line++; }
  const ls = pos > 0 ? v.lastIndexOf('\n', pos - 1) : -1;
  $('#pos').textContent = `${line} line ${pos - ls} Col`;
}
document.addEventListener('selectionchange', () => { if (document.activeElement === ta) status(); });
function lineStart(v, s) { return s > 0 ? v.lastIndexOf('\n', s - 1) + 1 : 0; }
function gotoLine(line) {
  const v = ta.value; let pos = 0;
  for (let i = 1; i < line; i++) { const n = v.indexOf('\n', pos); if (n < 0) break; pos = n + 1; }
  ta.focus(); ta.setSelectionRange(pos, pos);
  ta.scrollTop = Math.max(0, (line - 1) * 20 - ta.clientHeight / 2); syncScroll(); status(); updateCurLine();
}

/* ---------- editing behaviour ---------- */
const ins = (s) => document.execCommand('insertText', false, s);
const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
function indentBlock(out) {
  const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd, ls = lineStart(v, s);
  const seg = v.slice(ls, en);
  const nw = out ? seg.replace(/^(?: {1,2}|\t)/gm, '') : seg.replace(/^/gm, '  ');
  ta.setSelectionRange(ls, en); ins(nw);
  if (s === en) ta.setSelectionRange(ls + nw.length, ls + nw.length); else ta.setSelectionRange(ls, ls + nw.length);
}
ta.addEventListener('keydown', (e) => {
  const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    if (e.shiftKey || (s !== en && v.slice(s, en).includes('\n'))) indentBlock(e.shiftKey); else ins('  ');
    return;
  }
  if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    const ls = lineStart(v, s), ind = /^[ \t]*/.exec(v.slice(ls, s))[0], b = v[s - 1], a = v[en];
    const open = !!b && '{[('.includes(b);
    if (open && a === PAIRS[b]) { ins('\n' + ind + '  \n' + ind); const p = s + 1 + ind.length + 2; ta.setSelectionRange(p, p); }
    else ins('\n' + ind + (open ? '  ' : ''));
    return;
  }
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const k = e.key;
  if (PAIRS[k]) {
    const nx = v[en], pv = v[s - 1];
    if (s !== en) { e.preventDefault(); const sel = v.slice(s, en); ins(k + sel + PAIRS[k]); ta.setSelectionRange(s + 1, s + 1 + sel.length); return; }
    if ('"\'`'.includes(k)) {
      if (nx === k) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
      if (/\w/.test(pv || '')) return;
    }
    if (!nx || /[\s)\]}.,;:]/.test(nx)) { e.preventDefault(); ins(k + PAIRS[k]); ta.setSelectionRange(s + 1, s + 1); }
  } else if (')]}'.includes(k) && s === en && v[s] === k) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); }
});
ta.addEventListener('input', () => {
  const t = S.cur; if (!t) return;
  const was = dirty(t); t.text = ta.value;
  if (was !== dirty(t)) renderTabs();
  schedRender(); status(); liveSoon(t);
});
gut.addEventListener('mousedown', (e) => {
  if (!S.cur) return;
  const y = e.clientY - gut.getBoundingClientRect().top + gut.scrollTop - 8;
  const line = Math.floor(y / 20) + 1; if (line >= 1) toggleBp(line);
});

/* ---------- files ---------- */
async function openFiles() { const ps = await api.openFiles(); for (const p of ps) await openPath(p); }
async function openFolder() { const p = await api.openFolder(); if (p) { await setRoot(p); side('explorer'); } }
async function save() {
  const t = S.cur; if (!t) return false;
  if (!t.path) return saveAs();
  const r = await api.write(t.path, t.text.replace(/\n/g, t.eol));
  if (r.error) { toast(r.error); return false; }
  t.saved = t.text; renderTabs(); return true;
}
async function saveAs() {
  const t = S.cur; if (!t) return false;
  const r = await api.saveAs({ name: t.name, dir: dir(t.path) || S.root, text: t.text.replace(/\n/g, t.eol) });
  if (!r) return false;
  if (r.error) { toast(r.error); return false; }
  t.path = r.path; t.name = base(r.path); t.saved = t.text; lastKey = '';
  renderTabs(); renderCode(); if (S.root) setRoot(S.root); liveSoon(t); return true;
}

/* ---------- side panels ---------- */
function side(name) {
  S.side = name;
  document.querySelectorAll('.rb').forEach((b) => b.classList.toggle('on', b.dataset.p === name));
  document.querySelectorAll('.pn').forEach((p) => { p.hidden = p.id !== 'p-' + name; });
  if (name === 'sandbox') checkPort();
  if (name === 'debug') renderBps();
}
document.querySelectorAll('.rb').forEach((b) => b.addEventListener('click', () => side(b.dataset.p)));

async function setRoot(p) {
  S.root = p; $('#rootname').textContent = base(p) || p; $('#tree').innerHTML = '';
  await fillDir(p, $('#tree'), 0);
}
async function fillDir(d, box, depth) {
  const items = await api.readDir(d); box.innerHTML = '';
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'row'; row.style.paddingLeft = (8 + depth * 14) + 'px';
    row.innerHTML = (it.dir ? svg('chev') : '<span class="sp"></span>') + (it.dir ? `<span class="fi fo">${svg('folder')}</span>` : fileIcon(it.name)) + `<span class="nm">${esc(it.name)}</span>`;
    box.appendChild(row);
    if (it.dir) {
      const kids = document.createElement('div'); kids.hidden = true; box.appendChild(kids);
      row.onclick = async () => {
        const open = kids.hidden; kids.hidden = !open; row.classList.toggle('open', open);
        if (open && !kids.dataset.l) { kids.dataset.l = '1'; await fillDir(it.path, kids, depth + 1); }
      };
    } else row.onclick = () => openPath(it.path);
  }
}
$('#q').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const q = e.target.value.trim(); if (!q) return;
  const box = $('#sres');
  if (!S.root) { box.innerHTML = '<div class="mut" style="margin-top:12px">Open a folder to search.</div>'; return; }
  box.innerHTML = '<div class="mut" style="margin-top:12px">Searching...</div>';
  const r = await api.search(S.root, q);
  if (!r.length) { box.innerHTML = '<div class="mut" style="margin-top:12px">No results.</div>'; return; }
  let h = '', last = '';
  r.forEach((x, i) => {
    if (x.path !== last) { last = x.path; h += `<div class="res-f">${esc(x.rel)}</div>`; }
    h += `<div class="res-l" data-i="${i}"><b>${x.line}</b>${esc(x.text)}</div>`;
  });
  box.innerHTML = h;
  box.onclick = (ev) => { const el = ev.target.closest('.res-l'); if (el) { const x = r[el.dataset.i]; openPath(x.path, x.line); } };
});

/* ---------- sandbox panel ---------- */
const hostIn = $('#host'), bindIn = $('#bind'), bindTg = $('#bindTg'), liveTg = $('#liveTg');
const setTg = (el, on) => { el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); };
const PS = { available: ['Port available', 'ok'], busy: ['Port in use', 'bad'], bound: ['Serving on this port', 'ok'], invalid: ['Invalid address', 'warn'] };
function setPS(state, text) { const e = $('#pstat'); const p = PS[state] || ['', '']; e.textContent = text || p[0]; e.className = 'ps ' + p[1]; }
async function checkPort() { setPS(await api.portCheck(hostIn.value)); }
hostIn.addEventListener('input', debounce(checkPort, 350));
setInterval(() => { if (S.side === 'sandbox' && !document.hidden) checkPort(); }, 4000);
liveTg.onclick = () => { S.live = !S.live; setTg(liveTg, S.live); if (S.live && S.cur) liveRun(S.cur); };
bindTg.onclick = async () => {
  if (S.bound) {
    await api.serverStop(); S.bound = false; S.serverUrl = null; fr.dataset.u = '';
    setTg(bindTg, false); $('#sroot').textContent = ''; $('#bOpenUrl').hidden = true;
    if (S.cur) updatePreview(S.cur); checkPort(); return;
  }
  const root = S.root || (S.cur && S.cur.path ? dir(S.cur.path) : null);
  if (!root) { toast('Open a folder or a saved file first.'); return; }
  const r = await api.serverStart(bindIn.value, root);
  if (!r.ok) { setPS('busy', r.error); toast(r.error); return; }
  S.bound = true; S.serverUrl = r.url; S.serverRoot = root;
  setTg(bindTg, true); $('#sroot').textContent = 'Serving ' + root; $('#bOpenUrl').hidden = false;
  checkPort(); if (S.cur) updatePreview(S.cur);
};
$('#bOpenUrl').onclick = () => { if (S.serverUrl) api.openExternal(S.serverUrl); };

/* ---------- dock (output / preview / problems) ---------- */
const PANES = { output: 'pane-output', preview: 'pane-preview', problems: 'pane-problems' };
function showDock(name) {
  S.dock = name; $('#dock').classList.add('open');
  document.querySelectorAll('.dt').forEach((b) => b.classList.toggle('on', b.dataset.d === name));
  for (const k in PANES) $('#' + PANES[k]).hidden = k !== name;
}
document.querySelectorAll('.dt').forEach((b) => b.addEventListener('click', () => showDock(b.dataset.d)));
$('#dClose').onclick = () => $('#dock').classList.remove('open');
$('#sbDock').onclick = () => { const d = $('#dock'); if (d.classList.contains('open')) d.classList.remove('open'); else showDock(S.dock || 'output'); };
$('#dClear').onclick = clearOut;
$('#grip').addEventListener('mousedown', (e) => {
  e.preventDefault();
  const move = (m) => { const h = Math.min(Math.max(window.innerHeight - m.clientY - 28, 80), window.innerHeight - 200); document.documentElement.style.setProperty('--dockh', h + 'px'); };
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
});
const outEl = $('#pane-output'); let outN = 0;
function out(k, t) {
  if (!t) return;
  const d = document.createElement('div'); d.className = 'o ' + k; d.textContent = String(t).replace(/\n$/, '');
  outEl.appendChild(d); if (++outN > 1500) { outEl.firstChild.remove(); outN--; }
  outEl.scrollTop = outEl.scrollHeight;
}
function clearOut() { outEl.innerHTML = ''; outN = 0; }

/* ---------- diagnostics ---------- */
function setDiags(t, list) { S.diags.set(t.id, list || []); if (t === S.cur) { renderProblems(); gutter(); } }
function renderProblems() {
  const t = S.cur, list = t ? S.diags.get(t.id) || [] : [];
  const e = list.filter((d) => d.sev === 'error').length, w = list.length - e;
  $('#ecount').textContent = e; $('#wcount').textContent = w;
  $('#pbadge').textContent = list.length ? list.length : '';
  $('#pane-problems').innerHTML = list.length
    ? list.map((d, i) => `<div class="pr" data-i="${i}">${d.sev === 'error' ? ICO_ERR : ICO_WARN}<span>${esc(d.msg)}</span><span class="loc">Line ${d.line}, Col ${d.col || 1}</span></div>`).join('')
    : '<div class="mut">No problems.</div>';
}
$('#pane-problems').addEventListener('click', (e) => {
  const el = e.target.closest('.pr'); if (!el || !S.cur) return;
  const d = (S.diags.get(S.cur.id) || [])[el.dataset.i]; if (d) gotoLine(d.line);
});

/* ---------- real-time sandbox ---------- */
let liveTimer = 0, liveSeq = 0, worker = null, workerTimer = 0;
function liveSoon(t) {
  if (S.bound && t.path && kindOf(t) === 'html') api.overlay(t.path, t.text);
  if (!S.live) return;
  const k = kindOf(t); if (!k) return;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => liveRun(t), k === 'cs' ? 1500 : k === 'php' ? 500 : 350);
}
function stopWorker() { clearTimeout(workerTimer); if (worker) { worker.terminate(); worker = null; } }
function liveJs(t) {
  stopWorker(); clearOut(); setDiags(t, []);
  const boot = '(function(){var p=function(k,a){try{postMessage({k:k,t:a.map(function(x){try{if(typeof x==="string")return x;if(x instanceof Error)return x.stack||String(x);var j=JSON.stringify(x,null,2);return j===undefined?String(x):j}catch(e){return String(x)}}).join(" ")})}catch(e){}};["log","info","warn","error","debug"].forEach(function(k){console[k]=function(){p(k,[].slice.call(arguments))}});setTimeout(function(){postMessage({k:"sync"})},0)})();';
  const url = URL.createObjectURL(new Blob([boot + '\n' + t.text], { type: 'text/javascript' }));
  const w = new Worker(url); worker = w; let synced = false;
  w.onmessage = (e) => { const m = e.data; if (m.k === 'sync') { synced = true; return; } out(m.k === 'error' ? 'err' : m.k === 'warn' ? 'warn' : 'out', m.t); };
  w.onerror = (e) => {
    e.preventDefault(); out('err', e.message);
    if (/(document|window|alert|localStorage|require|process|module) is not defined/.test(e.message)) out('sys', 'Real-time JavaScript runs in an isolated worker without DOM or Node APIs. Use an HTML file for DOM code, or press F5 to run with Node.');
    setDiags(t, [{ sev: 'error', line: Math.max(1, (e.lineno || 2) - 1), col: e.colno || 1, msg: e.message }]);
  };
  workerTimer = setTimeout(() => {
    if (!synced) { out('err', 'Stopped: the script did not finish within 3 seconds (infinite loop?)'); setDiags(t, [{ sev: 'warning', line: 1, col: 1, msg: 'Script did not finish within 3 seconds' }]); }
    w.terminate(); if (worker === w) worker = null; URL.revokeObjectURL(url);
  }, 3000);
}
async function liveRun(t) {
  const k = kindOf(t); if (!k || t !== S.cur) return;
  const my = ++liveSeq;
  if (k === 'html') { setDiags(t, []); updatePreview(t); return; }
  if (k === 'js') { liveJs(t); return; }
  if (k === 'php') {
    const r = await api.livePhp({ content: t.text, cwd: dir(t.path) });
    if (my !== liveSeq || t !== S.cur) return;
    clearOut();
    if (r.missing) { out('err', MISS.php); return; }
    out('out', r.so); if (r.se) out('err', r.se);
    setDiags(t, r.diags);
    if (S.bound && t.path) updatePreview(t); else pvSet(r.so);
    return;
  }
  if (k === 'cs') {
    clearOut(); out('sys', 'Checking C# ...');
    const r = await api.liveCs({ content: t.text });
    if (my !== liveSeq || t !== S.cur) return;
    clearOut();
    if (r.missing) { out('err', MISS.cs); return; }
    setDiags(t, r.diags);
    out(r.ok ? 'sys' : 'err', r.ok ? 'C# compiles with no errors. Press F5 to run.' : `C# has ${r.diags.filter((d) => d.sev === 'error').length} error(s). See Problems.`);
  }
}
function pvSet(h) {
  fr.dataset.u = ''; fr.sandbox = 'allow-scripts allow-forms allow-modals';
  fr.removeAttribute('src'); fr.srcdoc = h;
}
function withBase(t) {
  if (!t.path) return t.text;
  const b = '<base href="file:///' + encodeURI(dir(t.path).replace(/\\/g, '/').replace(/^\/+/, '')) + '/">';
  return /<head[^>]*>/i.test(t.text) ? t.text.replace(/<head[^>]*>/i, (m) => m + b) : b + t.text;
}
function serverUrlFor(t) {
  if (!S.bound || !t.path || !S.serverRoot) return null;
  const a = t.path.replace(/\\/g, '/'), r = S.serverRoot.replace(/\\/g, '/').replace(/\/$/, '');
  if (!a.toLowerCase().startsWith(r.toLowerCase() + '/')) return null;
  return S.serverUrl + '/' + encodeURI(a.slice(r.length + 1));
}
function updatePreview(t) {
  const k = kindOf(t); if (k !== 'html' && k !== 'php') return;
  const u = serverUrlFor(t);
  if (u) {
    if (k === 'html') api.overlay(t.path, t.text);
    if (fr.dataset.u !== u) { fr.dataset.u = u; fr.sandbox = 'allow-scripts allow-same-origin allow-forms allow-modals'; fr.removeAttribute('srcdoc'); fr.src = u; }
    return;
  }
  if (k === 'html') pvSet(withBase(t));
}

/* ---------- run ---------- */
function setRunBtn() { const b = $('#bRun'); b.classList.toggle('stop', S.running); b.innerHTML = svg(S.running ? 'stop' : 'play'); b.title = S.running ? 'Stop (Shift+F5)' : 'Run (F5)'; }
async function run() {
  const t = S.cur; if (!t) return;
  if (S.running) { stopAll(); return; }
  const k = kindOf(t);
  if (!k) { toast('Sandbox runs C#, JavaScript, HTML and PHP files.'); return; }
  if (k === 'html') { showDock('preview'); updatePreview(t); return; }
  clearOut(); showDock('output'); S.running = true; S.runTab = t; setRunBtn();
  await api.run({ kind: k, content: t.text, cwd: dir(t.path) || null, file: t.path });
}
function stopAll() { api.kill(); if (S.dbg.on) api.dbg.cmd('stop'); }
api.on('run:out', (d) => out(d.k, d.t));
api.on('run:end', (d) => { S.running = false; setRunBtn(); out('sys', `[exited with code ${d.code}]`); });
api.on('run:diag', (d) => { if (S.runTab) setDiags(S.runTab, d); });

/* ---------- debugger ---------- */
const allBps = () => S.tabs.filter((t) => t.path).flatMap((t) => [...t.bps].map((line) => ({ file: t.path, line })));
function toggleBp(line) {
  const t = S.cur; if (!t) return;
  if (t.bps.has(line)) t.bps.delete(line); else t.bps.add(line);
  gutter(); renderBps();
  if (S.dbg.on) api.dbg.bps(allBps());
}
function renderBps() {
  const l = S.tabs.flatMap((t) => [...t.bps].sort((a, b) => a - b).map((n) => ({ t, n })));
  $('#bplist').innerHTML = l.length ? l.map((x, i) => `<div class="li" data-i="${i}"><div style="display:flex;gap:8px"><i class="bpd"></i>${esc(x.t.name)}</div><span>Line ${x.n}</span></div>`).join('') : '<div class="mut">None</div>';
  $('#bplist').onclick = (e) => { const el = e.target.closest('.li'); if (!el) return; const x = l[el.dataset.i]; activate(x.t); gotoLine(x.n); };
}
function dbgUI() {
  const on = S.dbg.on, p = S.dbg.paused;
  $('#dStart').disabled = on; $('#dStop').disabled = !on;
  ['dCont', 'dOver', 'dInto', 'dOut'].forEach((i) => { $('#' + i).disabled = !p; });
  $('#dstat').textContent = on ? (p ? 'Paused' : 'Running') : 'Not running';
}
function renderVars(sc) {
  $('#vars').innerHTML = sc.length ? sc.map((s) => `<div class="grp">${esc(s.name)}</div>` + s.vars.map((v) => `<div class="li"><b style="font-weight:400">${esc(v.n)}</b><span class="vv">${esc(v.v)}</span></div>`).join('')).join('') : '<div class="mut">Nothing to show</div>';
}
function updateCurLine() {
  const m = S.dbg.mark, t = S.cur, el = $('#curline');
  if (!m || !t || t.path !== m.path) { el.hidden = true; return; }
  el.hidden = false; el.style.top = (8 + (m.line - 1) * 20 - ta.scrollTop) + 'px';
}
async function startDebug() {
  const t = S.cur; if (!t) return;
  side('debug');
  if (kindOf(t) !== 'js') { toast('The debugger runs JavaScript files. Use Run for C# and PHP.'); return; }
  if (S.dbg.on) return;
  if (!t.path || dirty(t)) { if (!(await save())) return; }
  clearOut(); showDock('output');
  const r = await api.dbg.start({ file: t.path, cwd: dir(t.path), bps: allBps() });
  if (!r.ok) { out('err', r.error); return; }
  S.dbg.on = true; S.dbg.paused = false; S.running = true; setRunBtn(); dbgUI();
}
api.on('dbg:paused', async (d) => {
  S.dbg.paused = true; S.dbg.frame = d.frames[0].i; dbgUI();
  $('#dstat').textContent = 'Paused: ' + d.reason;
  $('#stack').innerHTML = d.frames.map((f, k) => `<div class="li${k === 0 ? ' on' : ''}" data-i="${f.i}" data-k="${k}"><b style="font-weight:400">${esc(f.fn)}</b><span>${esc(base(f.file))}:${f.line}</span></div>`).join('');
  $('#stack').onclick = async (e) => {
    const el = e.target.closest('.li'); if (!el) return;
    const f = d.frames[el.dataset.k]; S.dbg.frame = f.i;
    document.querySelectorAll('#stack .li').forEach((x) => x.classList.toggle('on', x === el));
    renderVars(await api.dbg.scopes(f.i)); await reveal(f);
  };
  renderVars(d.scopes); await reveal(d.frames[0]);
});
async function reveal(f) { S.dbg.mark = { path: f.file, line: f.line }; await openPath(f.file); gotoLine(f.line); updateCurLine(); }
api.on('dbg:resumed', () => { S.dbg.paused = false; S.dbg.mark = null; updateCurLine(); dbgUI(); $('#stack').innerHTML = ''; $('#vars').innerHTML = ''; });
api.on('dbg:end', () => { S.dbg.on = false; S.dbg.paused = false; S.dbg.mark = null; S.running = false; setRunBtn(); updateCurLine(); dbgUI(); $('#stack').innerHTML = ''; $('#vars').innerHTML = ''; });
$('#dStart').onclick = startDebug;
$('#dCont').onclick = () => api.dbg.cmd('resume');
$('#dOver').onclick = () => api.dbg.cmd('over');
$('#dInto').onclick = () => api.dbg.cmd('into');
$('#dOut').onclick = () => api.dbg.cmd('out');
$('#dStop').onclick = () => api.dbg.cmd('stop');
$('#evin').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  if (!S.dbg.on) { $('#evout').className = 'err'; $('#evout').textContent = 'Start the debugger first.'; return; }
  const r = await api.dbg.eval({ expr: e.target.value, frame: S.dbg.paused ? Math.max(0, S.dbg.frame) : 0 });
  $('#evout').className = r.ok ? 'mut' : 'err'; $('#evout').textContent = r.v;
});

/* ---------- top bar, keys, drop, close ---------- */
$('#bOpenFile').onclick = openFiles;
$('#bOpenFolder').onclick = openFolder; $('#bOpenFolder2').onclick = openFolder;
$('#bSave').onclick = save; $('#bSaveAs').onclick = saveAs;
$('#bRun').onclick = run; $('#bDbg').onclick = startDebug;
document.addEventListener('keydown', (e) => {
  const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (c && k === 's') { e.preventDefault(); e.shiftKey ? saveAs() : save(); }
  else if (c && k === 'o') { e.preventDefault(); e.shiftKey ? openFolder() : openFiles(); }
  else if (c && k === 'n') { e.preventDefault(); newFile(); }
  else if (c && k === 'w') { e.preventDefault(); closeTab(S.cur); }
  else if (c && e.shiftKey && k === 'f') { e.preventDefault(); side('search'); $('#q').focus(); }
  else if (e.key === 'F5') { e.preventDefault(); if (e.shiftKey) stopAll(); else if (S.dbg.paused) api.dbg.cmd('resume'); else run(); }
  else if (e.key === 'F6') { e.preventDefault(); startDebug(); }
  else if (e.key === 'F9') { e.preventDefault(); if (S.cur) toggleBp(Number(/^(\d+)/.exec($('#pos').textContent)[1]) || 1); }
  else if (e.key === 'F10') { e.preventDefault(); api.dbg.cmd('over'); }
  else if (e.key === 'F11') { e.preventDefault(); api.dbg.cmd(e.shiftKey ? 'out' : 'into'); }
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  for (const f of e.dataTransfer.files) { const p = api.pathOf(f); if (p) await openPath(p); }
});
api.on('ask-close', () => { if (!S.tabs.some(dirty) || confirm('You have unsaved changes. Quit anyway?')) api.quit(); });

side('explorer'); setRunBtn(); dbgUI(); renderProblems(); status();
