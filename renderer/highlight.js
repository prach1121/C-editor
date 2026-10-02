(function (root) {
  'use strict';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const END = String.raw`(?![\s\S])`;
  const R = {
    cc: String.raw`//.*|/\*[\s\S]*?(?:\*/|` + END + ')',
    hash: String.raw`#.*`,
    dash: String.raw`--.*|/\*[\s\S]*?(?:\*/|` + END + ')',
    phpc: String.raw`//.*|#.*|/\*[\s\S]*?(?:\*/|` + END + ')',
    dq: String.raw`"(?:\\[\s\S]|[^"\\\n])*"?`,
    sq: String.raw`'(?:\\[\s\S]|[^'\\\n])*'?`,
    bt: String.raw`\x60(?:\\[\s\S]|[^\x60\\])*\x60?`,
    tdq: String.raw`"""[\s\S]*?(?:"""|` + END + ')',
    tsq: String.raw`'''[\s\S]*?(?:'''|` + END + ')',
    csv: String.raw`[$@]{1,2}"(?:""|\\.|[^"\\])*"?`,
    num: String.raw`\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?)[a-zA-Z]*\b`,
    id: String.raw`[A-Za-z_$][\w$]*`,
    pv: String.raw`\$[A-Za-z_]\w*`,
    pre: String.raw`^[ \t]*#[ \t]*[a-z]+.*`
  };

  function mk(o) {
    const w = (s) => new Set((s || '').split(' ').filter(Boolean));
    const d = { ctrl: w(o.ctrl), kw: w(o.kw), ty: w(o.ty), ci: !!o.ci, pas: !!o.pas, keys: !!o.keys };
    const p = [];
    if (o.pre) p.push('(?<p>' + R.pre + ')');
    if (o.cm) p.push('(?<m>' + o.cm + ')');
    p.push('(?<s>' + o.str.join('|') + ')');
    p.push('(?<n>' + R.num + ')');
    if (o.dollar) p.push('(?<v>' + R.pv + ')');
    p.push('(?<i>' + R.id + ')');
    d.re = new RegExp(p.join('|'), 'gm');
    return d;
  }

  function run(code, d) {
    let out = '', last = 0, m;
    const re = d.re; re.lastIndex = 0;
    while ((m = re.exec(code))) {
      const t = m[0];
      if (!t) { re.lastIndex++; continue; }
      const g = m.groups; let c = '';
      if (g.p) c = 'p';
      else if (g.m) c = 'm';
      else if (g.s) { c = 's'; if (d.keys && /^\s*:/.test(code.slice(re.lastIndex, re.lastIndex + 8))) c = 'v'; }
      else if (g.n) c = 'n';
      else if (g.v) c = 'v';
      else {
        const x = d.ci ? t.toLowerCase() : t;
        if (d.ctrl.has(x)) c = 'c';
        else if (d.kw.has(x)) c = 'k';
        else if (d.ty.has(x)) c = 't';
        else if (code.charCodeAt(re.lastIndex) === 40) c = 'f';
        else if (d.pas && /^[A-Z]/.test(t)) c = 't';
      }
      out += esc(code.slice(last, m.index));
      out += c ? '<span class="' + c + '">' + esc(t) + '</span>' : esc(t);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  const D = {};
  const CTRL = 'if else for while do switch case break continue return try catch finally throw default goto';
  D.js = mk({
    cm: R.cc, str: [R.dq, R.sq, R.bt], pas: true,
    ctrl: CTRL + ' await yield import export from as',
    kw: 'const let var function class new this typeof instanceof in of delete void async static extends super get set null undefined true false NaN Infinity debugger with interface type enum implements public private protected readonly namespace declare abstract keyof is',
    ty: 'console window document Math JSON Object Array String Number Boolean Promise Map Set Date RegExp Error require module exports process Buffer any string number boolean unknown never symbol'
  });
  D.cs = mk({
    cm: R.cc, str: [R.csv, R.dq, R.sq], pre: true, pas: true,
    ctrl: CTRL + ' foreach await yield using',
    kw: 'namespace class struct interface enum public private protected internal static readonly const new this base virtual override abstract sealed partial async void var null true false is as in out ref params get set value delegate event operator implicit explicit lock unsafe checked unchecked typeof sizeof nameof record init required',
    ty: 'int long short byte sbyte uint ulong ushort float double decimal bool char string object dynamic String Console List Dictionary Task Math DateTime Exception IEnumerable'
  });
  D.php = mk({
    cm: R.phpc, str: [R.dq, R.sq], dollar: true, ci: true, pas: false,
    ctrl: 'if else elseif for foreach while do switch case break continue return try catch finally throw default match yield include include_once require require_once endif endforeach endwhile endfor endswitch',
    kw: 'function class interface trait extends implements new public private protected static abstract final const var echo print namespace use global null true false array isset empty unset exit die list fn readonly enum self parent instanceof as and or xor',
    ty: 'string int float bool void mixed object callable iterable'
  });
  D.py = mk({
    cm: R.hash, str: [R.tdq, R.tsq, R.dq, R.sq],
    ctrl: 'if elif else for while break continue return try except finally raise with as import from yield pass lambda assert del',
    kw: 'def class global nonlocal None True False self async await in is not and or',
    ty: 'int str float bool list dict set tuple print len range object type'
  });
  D.java = mk({
    cm: R.cc, str: [R.dq, R.sq], pas: true,
    ctrl: CTRL + ' import package',
    kw: 'class interface enum extends implements public private protected static final abstract new this super void null true false instanceof synchronized volatile transient throws native val var fun let func struct override open data object when',
    ty: 'int long short byte float double boolean char String Object List Map Integer System Int Double Bool Boolean Unit'
  });
  D.c = mk({
    cm: R.cc, str: [R.dq, R.sq], pre: true,
    ctrl: CTRL,
    kw: 'struct union enum typedef static const extern volatile inline sizeof class namespace template typename public private protected virtual override new delete this nullptr true false auto using operator register unsigned signed',
    ty: 'int long short char float double void bool size_t std string vector'
  });
  D.go = mk({
    cm: R.cc, str: [R.dq, R.sq, R.bt],
    ctrl: 'if else for switch case break continue return default goto select range defer go fallthrough',
    kw: 'package import func var const type struct interface map chan nil true false iota',
    ty: 'int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 string bool byte rune error any fmt'
  });
  D.rs = mk({
    cm: R.cc, str: [R.dq, R.sq],
    ctrl: 'if else for while loop match break continue return',
    kw: 'fn let mut const static struct enum impl trait pub use mod crate self super Self as in ref move where type async await unsafe dyn true false',
    ty: 'i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box'
  });
  D.rb = mk({
    cm: R.hash, str: [R.dq, R.sq],
    ctrl: 'if elsif else unless while until for case when break next return begin rescue ensure raise yield',
    kw: 'def class module end do self nil true false require include extend attr_accessor puts', ty: ''
  });
  D.sh = mk({
    cm: R.hash, str: [R.dq, R.sq], dollar: true,
    ctrl: 'if then else elif fi for while do done case esac in return',
    kw: 'function export local echo cd set unset source alias exit', ty: ''
  });
  D.sql = mk({
    cm: R.dash, str: [R.sq, R.dq], ci: true,
    kw: 'select from where insert into values update set delete create table drop alter add join inner left right outer on group by order having limit as and or not null primary key foreign references index distinct union all like in is between exists case when then else end',
    ty: 'int integer varchar text date datetime boolean float decimal'
  });
  D.json = mk({ str: [R.dq], kw: 'true false null', keys: true });
  D.cfg = mk({ cm: R.hash, str: [R.dq, R.sq], kw: 'true false null yes no on off' });

  const cssRe = new RegExp(
    '(?<m>' + R.cc + ')|(?<s>' + R.dq + '|' + R.sq + ')|(?<c>#[\\da-fA-F]{3,8}\\b)|(?<n>-?\\d*\\.?\\d+(?:[a-zA-Z%]+)?)|(?<a>@[\\w-]+)|(?<q>[.#][A-Za-z_][\\w-]*)|(?<i>-{0,2}[A-Za-z_][\\w-]*)', 'g');
  function css(code) {
    let out = '', last = 0, m; cssRe.lastIndex = 0;
    while ((m = cssRe.exec(code))) {
      const t = m[0];
      if (!t) { cssRe.lastIndex++; continue; }
      const g = m.groups; let c = '';
      if (g.m) c = 'm'; else if (g.s) c = 's'; else if (g.c || g.n) c = 'n'; else if (g.a) c = 'c'; else if (g.q) c = 'y';
      else {
        const rest = code.slice(cssRe.lastIndex, cssRe.lastIndex + 160);
        const e = rest.indexOf('\n'); const ln = e < 0 ? rest : rest.slice(0, e);
        if (code.charCodeAt(cssRe.lastIndex) === 40) c = 'f';
        else if (/^\s*:/.test(ln) && !ln.includes('{')) c = 'v';
      }
      out += esc(code.slice(last, m.index));
      out += c ? '<span class="' + c + '">' + esc(t) + '</span>' : esc(t);
      last = cssRe.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  const htmlRe = /<!--[\s\S]*?(?:-->|(?![\s\S]))|<\?(?:php|=)?[\s\S]*?(?:\?>|(?![\s\S]))|<script\b[^>]*>[\s\S]*?(?=<\/script|(?![\s\S]))|<style\b[^>]*>[\s\S]*?(?=<\/style|(?![\s\S]))|<![A-Za-z][^>]*>?|<\/?[A-Za-z][\w:.-]*(?:"[^"]*"|'[^']*'|[^'">])*>?/g;
  function tag(t) {
    const m = /^(<\/?)([\w:.-]+)([\s\S]*?)(\/?>?)$/.exec(t);
    if (!m) return esc(t);
    let a = '';
    m[3].replace(/("[^"]*"?|'[^']*'?)|([\w:@.-]+)|([\s\S])/g, (x, s, n, o) => {
      a += s ? '<span class="s">' + esc(s) + '</span>' : n ? '<span class="a">' + n + '</span>' : esc(o);
      return x;
    });
    return '<span class="b">' + esc(m[1]) + '</span><span class="g">' + m[2] + '</span>' + a + '<span class="b">' + esc(m[4]) + '</span>';
  }
  function html(code) {
    let out = '', last = 0, m; htmlRe.lastIndex = 0;
    while ((m = htmlRe.exec(code))) {
      const t = m[0];
      if (!t) { htmlRe.lastIndex++; continue; }
      out += esc(code.slice(last, m.index)); last = htmlRe.lastIndex;
      if (t.startsWith('<!--')) out += '<span class="m">' + esc(t) + '</span>';
      else if (t.startsWith('<?')) {
        const mm = /^(<\?(?:php|=)?)([\s\S]*?)(\?>)?$/.exec(t);
        out += '<span class="p">' + esc(mm[1]) + '</span>' + run(mm[2], D.php) + (mm[3] ? '<span class="p">?&gt;</span>' : '');
      } else if (/^<script\b/i.test(t)) {
        const o = /^<script\b[^>]*>/i.exec(t)[0]; out += tag(o) + run(t.slice(o.length), D.js);
      } else if (/^<style\b/i.test(t)) {
        const o = /^<style\b[^>]*>/i.exec(t)[0]; out += tag(o) + css(t.slice(o.length));
      } else if (t.startsWith('<!')) out += '<span class="b">' + esc(t) + '</span>';
      else out += tag(t);
    }
    return out + esc(code.slice(last));
  }

  const MAP = {};
  const set = (names, fn) => names.split(' ').forEach((n) => { MAP[n] = fn; });
  set('js jsx mjs cjs ts tsx', (c) => run(c, D.js));
  set('cs csx', (c) => run(c, D.cs));
  set('php phtml', html);
  set('html htm xhtml xml svg xaml vue csproj config plist', html);
  set('css scss less sass', css);
  set('json jsonc', (c) => run(c, D.json));
  set('py pyw', (c) => run(c, D.py));
  set('java kt kts swift dart scala groovy', (c) => run(c, D.java));
  set('c h cpp hpp cc cxx hh', (c) => run(c, D.c));
  set('go', (c) => run(c, D.go));
  set('rs', (c) => run(c, D.rs));
  set('rb', (c) => run(c, D.rb));
  set('sh bash zsh', (c) => run(c, D.sh));
  set('sql', (c) => run(c, D.sql));
  set('yml yaml toml ini conf env cfg properties', (c) => run(c, D.cfg));

  const HL = { highlight: (code, ext) => (MAP[ext] ? MAP[ext](code) : esc(code)) };
  root.HL = HL;
  if (typeof module !== 'undefined') module.exports = HL;
})(typeof window !== 'undefined' ? window : globalThis);
