/* ペンキドット絵 — 16色のペンキでドット絵を描くツール。
   すべてブラウザ内で動作し、外部への通信は行わない。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  // GitHub Pages では同じユーザーの全リポジトリが同じオリジンを共有するため、キーに名前空間を付ける
  var MAX = 200, KEY = 'teratool1.paint.v1';
  var MINS = 0.5, MAXS = 64;

  // 濃いペンキ12色 + 濃い版がない黒・白・グレー・茶。見た目は白いブロックに塗った想定の近似値。
  var DEFAULTS = [
    ['濃い赤', '#ff0000'], ['濃いオレンジ', '#ff8000'], ['濃い黄', '#ffff00'], ['濃いライム', '#80ff00'],
    ['濃い緑', '#00ff00'], ['濃いティール', '#00ff80'], ['濃いシアン', '#00ffff'], ['濃い空色', '#0080ff'],
    ['濃い青', '#0000ff'], ['濃い紫', '#8000ff'], ['濃いバイオレット', '#ff00ff'], ['濃いピンク', '#ff0080'],
    ['黒', '#101010'], ['白', '#ffffff'], ['グレー', '#808080'], ['茶', '#8a5a2b']
  ];

  var SAMPLE = [
    '................',
    '..kkkk....kkkk..',
    '.krrrrk..krrrrk.',
    'krpprrrkkrrrrrrk',
    'krpwrrrrrrrrrrrk',
    'krprrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    '.krrrrrrrrrrrrk.',
    '..krrrrrrrrrrk..',
    '...krrrrrrrrk...',
    '....krrrrrrk....',
    '.....krrrrk.....',
    '......krrk......',
    '.......kk.......',
    '................',
    '................'
  ];
  var SAMPLE_MAP = { '.': 0, 'r': 1, 'p': 12, 'k': 13, 'w': 14 };

  /* ---------- state ---------- */
  var pal = DEFAULTS.map(function (d) { return d[1]; });
  var rgbs = [];
  var W = 16, H = 16, data = new Uint8Array(W * H);
  var sel = 1, tool = 'pen', showGrid = true, showMajor = true;
  var view = { x: 0, y: 0, s: 12 };
  var autoFit = true;
  var undoStack = [], redoStack = [];
  var dirty = true, raf = 0;
  var hover = null, lastCell = null, spaceDown = false;

  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function refreshRgb() { rgbs = pal.map(hexToRgb); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- elements ---------- */
  var cv = $('cv'), ctx = cv.getContext('2d');
  var stage = $('stage');
  var img = document.createElement('canvas'), ictx = img.getContext('2d');
  var bg = document.createElement('canvas'), bctx = bg.getContext('2d');
  var bgKey = '';
  var palEl = $('palette'), swEls = [], badgeEls = [];

  /* ---------- toast ---------- */
  var tt = 0;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* ---------- persistence (per-viewer convenience) ---------- */
  function encode(d) { var s = ''; for (var i = 0; i < d.length; i++) s += String.fromCharCode(48 + d[i]); return s; }
  function decode(s, n) {
    if (typeof s !== 'string' || s.length !== n) return null;
    var d = new Uint8Array(n);
    for (var i = 0; i < n; i++) { var v = s.charCodeAt(i) - 48; if (v < 0 || v > 16) return null; d[i] = v; }
    return d;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, w: W, h: H, d: encode(data), pal: pal, grid: showGrid, major: showMajor, sel: sel }));
    } catch (e) { /* storage unavailable */ }
  }
  var saveT = 0;
  function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(save, 500); }
  function loadSaved() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (!o || o.v !== 1 || !(o.w >= 1 && o.w <= MAX && o.h >= 1 && o.h <= MAX)) return false;
      var d = decode(o.d, o.w * o.h);
      if (!d) return false;
      W = o.w; H = o.h; data = d;
      if (Array.isArray(o.pal) && o.pal.length === 16 && o.pal.every(function (h) { return /^#[0-9a-f]{6}$/i.test(h); })) pal = o.pal.slice();
      if (typeof o.grid === 'boolean') showGrid = o.grid;
      if (typeof o.major === 'boolean') showMajor = o.major;
      if (o.sel >= 1 && o.sel <= 16) sel = o.sel;
      return true;
    } catch (e) { return false; }
  }
  function loadSample() {
    W = 16; H = 16; data = new Uint8Array(W * H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var ch = (SAMPLE[y] || '').charAt(x) || '.';
      data[y * W + x] = SAMPLE_MAP[ch] || 0;
    }
  }

  /* ---------- history ---------- */
  function snapshot() { return { w: W, h: H, d: data.slice() }; }
  function pushUndo(s) {
    undoStack.push(s); if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0; updateHist();
  }
  function applySnap(s) {
    var sizeChanged = s.w !== W || s.h !== H;
    W = s.w; H = s.h; data = s.d;
    afterData(sizeChanged);
  }
  function undo() {
    if (!undoStack.length) return;
    cancelStroke();
    redoStack.push(snapshot()); applySnap(undoStack.pop()); updateHist();
  }
  function redo() {
    if (!redoStack.length) return;
    cancelStroke();
    undoStack.push(snapshot()); applySnap(redoStack.pop()); updateHist();
  }
  function updateHist() { $('btnUndo').disabled = !undoStack.length; $('btnRedo').disabled = !redoStack.length; }
  function afterData(sizeChanged) {
    updateSizeUI();
    if (sizeChanged) { autoFit = true; fit(); }
    dirty = true; schedule(); scheduleSave();
  }

  /* ---------- rendering ---------- */
  function rebuildImage() {
    if (img.width !== W || img.height !== H) { img.width = W; img.height = H; }
    var id = ictx.createImageData(W, H), d = id.data;
    for (var i = 0, n = W * H; i < n; i++) {
      var v = data[i];
      if (v) { var c = rgbs[v - 1], o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
    }
    ictx.putImageData(id, 0, 0);
  }
  function rebuildBg(a, b) {
    bg.width = W; bg.height = H;
    bctx.fillStyle = a; bctx.fillRect(0, 0, W, H);
    bctx.fillStyle = b;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if ((x + y) & 1) bctx.fillRect(x, y, 1, 1);
  }
  function drawLines(step, count, horizontal, color, offset, lw, from, to, limit) {
    // vertical lines when horizontal=false
    ctx.beginPath();
    for (var i = 0; i <= count; i += step) {
      var p = (horizontal ? view.y : view.x) + i * view.s;
      if (p < -2 || p > limit + 2) continue;
      var q = Math.floor(p) + offset;
      if (horizontal) { ctx.moveTo(from, q); ctx.lineTo(to, q); } else { ctx.moveTo(q, from); ctx.lineTo(q, to); }
    }
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  }
  function render() {
    var dpr = window.devicePixelRatio || 1;
    var cw = stage.clientWidth, ch = stage.clientHeight;
    if (!cw || !ch) return;
    var pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    var cs = getComputedStyle(document.documentElement);
    var ca = cs.getPropertyValue('--check-a').trim(), cb = cs.getPropertyValue('--check-b').trim();
    var key = ca + '|' + cb + '|' + W + 'x' + H;
    if (key !== bgKey) { rebuildBg(ca, cb); bgKey = key; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = cs.getPropertyValue('--stage').trim() || '#ccc';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = false;
    var w = W * view.s, h = H * view.s;
    ctx.drawImage(bg, view.x, view.y, w, h);
    ctx.drawImage(img, view.x, view.y, w, h);

    var x0 = Math.max(0, view.x), x1 = Math.min(cw, view.x + w);
    var y0 = Math.max(0, view.y), y1 = Math.min(ch, view.y + h);
    if (showGrid && view.s >= 6) {
      drawLines(1, W, false, 'rgba(0,0,0,0.22)', 0.5, 1, y0, y1, cw);
      drawLines(1, H, true, 'rgba(0,0,0,0.22)', 0.5, 1, x0, x1, ch);
      if (view.s >= 12) {
        drawLines(1, W, false, 'rgba(255,255,255,0.16)', 1.5, 1, y0, y1, cw);
        drawLines(1, H, true, 'rgba(255,255,255,0.16)', 1.5, 1, x0, x1, ch);
      }
    }
    if (showGrid && showMajor && view.s >= 2) {
      drawLines(10, W, false, 'rgba(0,0,0,0.6)', 0.5, 1, y0, y1, cw);
      drawLines(10, H, true, 'rgba(0,0,0,0.6)', 0.5, 1, x0, x1, ch);
      drawLines(10, W, false, 'rgba(255,255,255,0.5)', 1.5, 1, y0, y1, cw);
      drawLines(10, H, true, 'rgba(255,255,255,0.5)', 1.5, 1, x0, x1, ch);
    }
    ctx.strokeStyle = cs.getPropertyValue('--outline').trim() || '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.floor(view.x) - 0.5, Math.floor(view.y) - 0.5, Math.round(w) + 1, Math.round(h) + 1);

    if (hover && tool !== 'pan' && !spaceDown) {
      var hx = view.x + hover.x * view.s, hy = view.y + hover.y * view.s, hs = view.s;
      if (hs >= 5) {
        ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeRect(hx + 1, hy + 1, hs - 2, hs - 2);
        ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.strokeRect(hx + 0.5, hy + 0.5, hs - 1, hs - 1);
      } else {
        ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.strokeRect(hx - 0.5, hy - 0.5, hs + 1, hs + 1);
      }
    }
  }
  function updateCounts() {
    var c = new Array(16).fill(0), i;
    for (i = 0; i < data.length; i++) { var v = data[i]; if (v) c[v - 1]++; }
    var total = 0, used = 0;
    for (i = 0; i < 16; i++) {
      badgeEls[i].textContent = c[i] ? String(c[i]) : '';
      swEls[i].setAttribute('aria-label', DEFAULTS[i][0] + (c[i] ? '（' + c[i] + 'マス）' : ''));
      total += c[i]; if (c[i]) used++;
    }
    $('stats').textContent = total + 'マス・' + used + '色';
  }
  function frame() {
    if (dirty) { rebuildImage(); updateCounts(); dirty = false; }
    render();
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; frame(); });
  }
  function updateReadout() {
    var t = '';
    if (lastCell) t += 'x ' + (lastCell.x + 1) + ' ・ y ' + (lastCell.y + 1) + ' ・ ';
    t += '×' + (Math.round(view.s * 10) / 10);
    $('readout').textContent = t;
  }
  function updateSizeUI() {
    $('sizeLabel').textContent = W + ' × ' + H + 'マス';
    $('inW').value = W; $('inH').value = H;
  }

  /* ---------- view ---------- */
  function fit() {
    var cw = stage.clientWidth, ch = stage.clientHeight, pad = 14;
    if (!cw || !ch) return;
    var s = Math.min((cw - pad * 2) / W, (ch - pad * 2) / H);
    s = s >= 1 ? Math.floor(s) : Math.max(MINS, s);
    s = clamp(s, MINS, MAXS);
    view.s = s;
    view.x = Math.round((cw - W * s) / 2);
    view.y = Math.round((ch - H * s) / 2);
    frame(); updateReadout();
  }
  function zoomAt(px, py, ns) {
    ns = clamp(ns, MINS, MAXS);
    var cx = (px - view.x) / view.s, cy = (py - view.y) / view.s;
    view.s = ns;
    view.x = Math.round(px - cx * ns); view.y = Math.round(py - cy * ns);
    autoFit = false; schedule(); updateReadout();
  }
  function stepUp(s) { return s < 4 ? s * 1.25 : Math.max(Math.round(s * 1.2), Math.floor(s) + 1); }
  function stepDown(s) { return s <= 4 ? s / 1.25 : Math.min(Math.round(s / 1.2), Math.ceil(s) - 1); }
  function zoomCenter(dir) {
    var cw = stage.clientWidth, ch = stage.clientHeight;
    zoomAt(cw / 2, ch / 2, dir > 0 ? stepUp(view.s) : stepDown(view.s));
  }

  /* ---------- tools & palette ---------- */
  function setTool(t) {
    tool = t;
    document.querySelectorAll('.tool').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
    updateCursor();
  }
  function updateCursor() { cv.style.cursor = (tool === 'pan' || spaceDown) ? 'grab' : 'crosshair'; }
  function refreshSel() {
    swEls.forEach(function (b, i) { b.setAttribute('aria-pressed', String(i + 1 === sel)); });
    $('selName').textContent = '選択中：' + DEFAULTS[sel - 1][0];
  }
  function setSel(v) {
    sel = v; refreshSel();
    if (tool === 'eraser' || tool === 'pan' || tool === 'pick') setTool('pen');
    scheduleSave();
  }
  function buildPalette() {
    palEl.innerHTML = ''; swEls = []; badgeEls = [];
    DEFAULTS.forEach(function (d, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sw'; b.title = d[0];
      b.style.setProperty('--c', pal[i]);
      var n = document.createElement('span'); n.className = 'n'; b.appendChild(n);
      b.addEventListener('click', function () { setSel(i + 1); });
      palEl.appendChild(b); swEls.push(b); badgeEls.push(n);
    });
    refreshSel();
  }
  var palInputs = [];
  function buildPalEditor() {
    var box = $('palEdit'); box.innerHTML = ''; palInputs = [];
    DEFAULTS.forEach(function (d, i) {
      var lab = document.createElement('label');
      var inp = document.createElement('input'); inp.type = 'color'; inp.value = pal[i]; inp.id = 'pc' + i;
      inp.addEventListener('input', function () {
        pal[i] = inp.value; refreshRgb(); swEls[i].style.setProperty('--c', pal[i]);
        dirty = true; schedule(); scheduleSave();
      });
      var sp = document.createElement('span'); sp.textContent = d[0];
      lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab); palInputs.push(inp);
    });
  }

  /* ---------- drawing ---------- */
  var stroke = null;
  function cellAt(px, py) {
    var x = Math.floor((px - view.x) / view.s), y = Math.floor((py - view.y) / view.s);
    return (x >= 0 && y >= 0 && x < W && y < H) ? { x: x, y: y } : null;
  }
  function put(x, y, v) {
    var i = y * W + x;
    if (data[i] !== v) { data[i] = v; stroke.changed = true; dirty = true; }
  }
  function line(x0, y0, x1, y1, v) {
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      put(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function paintTo(c) {
    if (!c) { stroke.last = null; return; }
    var v = tool === 'eraser' ? 0 : sel;
    if (stroke.last) line(stroke.last.x, stroke.last.y, c.x, c.y, v); else put(c.x, c.y, v);
    stroke.last = c;
  }
  function flood(x, y, v) {
    var t = data[y * W + x];
    if (t === v) return false;
    var st = [y * W + x]; data[y * W + x] = v;
    while (st.length) {
      var i = st.pop(), cx = i % W, cy = (i / W) | 0;
      if (cx > 0 && data[i - 1] === t) { data[i - 1] = v; st.push(i - 1); }
      if (cx < W - 1 && data[i + 1] === t) { data[i + 1] = v; st.push(i + 1); }
      if (cy > 0 && data[i - W] === t) { data[i - W] = v; st.push(i - W); }
      if (cy < H - 1 && data[i + W] === t) { data[i + W] = v; st.push(i + W); }
    }
    return true;
  }
  function beginAction(p) {
    var c = cellAt(p.x, p.y);
    if (c) lastCell = c;
    if (tool === 'pick') {
      if (c) { var v = data[c.y * W + c.x]; if (v) { sel = v; refreshSel(); setTool('pen'); scheduleSave(); } else { setTool('eraser'); } }
      return;
    }
    if (tool === 'fill') {
      if (!c) return;
      var snap = snapshot();
      if (flood(c.x, c.y, sel)) { pushUndo(snap); dirty = true; scheduleSave(); }
      schedule(); return;
    }
    stroke = { snap: snapshot(), last: null, changed: false };
    paintTo(c); schedule();
  }
  function endStroke() {
    if (stroke) {
      if (stroke.changed) { pushUndo(stroke.snap); scheduleSave(); }
      stroke = null;
    }
  }
  function cancelStroke() {
    if (stroke) { data.set(stroke.snap.d); stroke = null; dirty = true; schedule(); }
  }

  /* ---------- pointer handling ---------- */
  var pointers = new Map(), mode = null, gest = null, panLast = null;
  function local(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function startGesture() {
    var v = Array.from(pointers.values()), a = v[0], b = v[1];
    var m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    gest = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), s0: view.s, cx: (m.x - view.x) / view.s, cy: (m.y - view.y) / view.s, m: m };
    mode = 'gesture';
  }
  function doGesture() {
    var v = Array.from(pointers.values()); if (v.length < 2 || !gest) return;
    var a = v[0], b = v[1];
    var d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    var m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    var ns = clamp(gest.s0 * d / gest.d0, MINS, MAXS);
    view.s = ns; view.x = m.x - gest.cx * ns; view.y = m.y - gest.cy * ns;
    gest.m = m; autoFit = false; schedule(); updateReadout();
  }
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    var p = local(e); pointers.set(e.pointerId, p);
    if (pointers.size === 2) { cancelStroke(); startGesture(); return; }
    if (pointers.size > 2) return;
    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) { mode = 'pan'; panLast = p; cv.style.cursor = 'grabbing'; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (spaceDown || tool === 'pan') { mode = 'pan'; panLast = p; cv.style.cursor = 'grabbing'; return; }
    mode = 'draw'; beginAction(p);
  });
  cv.addEventListener('pointermove', function (e) {
    var p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    var c = cellAt(p.x, p.y);
    if (e.pointerType === 'mouse') { hover = c; schedule(); }
    if (c) { lastCell = c; updateReadout(); }
    if (mode === 'gesture') doGesture();
    else if (mode === 'pan' && panLast) {
      view.x += p.x - panLast.x; view.y += p.y - panLast.y; panLast = p; autoFit = false; schedule();
    } else if (mode === 'draw' && stroke) { paintTo(c); schedule(); }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode === 'draw') endStroke();
    else if (mode === 'pan') { mode = null; panLast = null; updateCursor(); }
    else if (mode === 'gesture' && pointers.size < 2) {
      mode = 'none';
      if (gest && view.s >= 3) zoomAt(gest.m.x, gest.m.y, Math.round(view.s));
      gest = null;
    }
    if (pointers.size === 0) mode = null;
    if (e.pointerType !== 'mouse') hover = null;
    schedule();
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = null; schedule(); } });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = local(e);
    zoomAt(p.x, p.y, e.deltaY < 0 ? stepUp(view.s) : stepDown(view.s));
  }, { passive: false });

  /* ---------- keyboard ---------- */
  window.addEventListener('keydown', function (e) {
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') { closeSheet(); return; }
    var k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || sheetOpen()) return;
    if (k === ' ' && tag !== 'BUTTON') { e.preventDefault(); spaceDown = true; updateCursor(); return; }
    if (k === 'b') setTool('pen');
    else if (k === 'e') setTool('eraser');
    else if (k === 'f') setTool('fill');
    else if (k === 'i') setTool('pick');
    else if (k === 'h') setTool('pan');
    else if (k === 'g') toggleGrid();
    else if (k === '+' || k === '=') zoomCenter(1);
    else if (k === '-') zoomCenter(-1);
  });
  window.addEventListener('keyup', function (e) { if (e.key === ' ') { spaceDown = false; updateCursor(); schedule(); } });

  /* ---------- top bar / dock buttons ---------- */
  function toggleGrid() {
    showGrid = !showGrid; $('btnGrid').setAttribute('aria-pressed', String(showGrid)); schedule(); scheduleSave();
  }
  $('btnGrid').addEventListener('click', toggleGrid);
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('zIn').addEventListener('click', function () { zoomCenter(1); });
  $('zOut').addEventListener('click', function () { zoomCenter(-1); });
  $('zFit').addEventListener('click', function () { autoFit = true; fit(); });
  document.querySelectorAll('.tool').forEach(function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); }); });

  /* ---------- sheet ---------- */
  var scrim = $('scrim'), lastFocus = null;
  function sheetOpen() { return !scrim.hidden; }
  function openSheet() { lastFocus = document.activeElement; scrim.hidden = false; $('btnClose').focus(); }
  function closeSheet() { if (scrim.hidden) return; scrim.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  $('btnMenu').addEventListener('click', openSheet);
  $('btnClose').addEventListener('click', closeSheet);
  scrim.addEventListener('pointerdown', function (e) { if (e.target === scrim) closeSheet(); });

  function resizeTo(nw, nh) {
    nw = clamp(Math.round(nw) || 0, 1, MAX); nh = clamp(Math.round(nh) || 0, 1, MAX);
    if (nw === W && nh === H) { updateSizeUI(); return; }
    pushUndo(snapshot());
    var nd = new Uint8Array(nw * nh);
    for (var y = 0; y < Math.min(H, nh); y++) for (var x = 0; x < Math.min(W, nw); x++) nd[y * nw + x] = data[y * W + x];
    W = nw; H = nh; data = nd;
    afterData(true);
    toast(W + ' × ' + H + 'マスにしました');
  }
  $('presets').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    var n = +b.dataset.n; resizeTo(n, n);
  });
  $('btnResize').addEventListener('click', function () { resizeTo(+$('inW').value, +$('inH').value); });
  $('btnClear').addEventListener('click', function () {
    pushUndo(snapshot()); data = new Uint8Array(W * H); afterData(false); closeSheet(); toast('全部消しました（元に戻せます）');
  });
  $('chkMajor').addEventListener('change', function () { showMajor = $('chkMajor').checked; schedule(); scheduleSave(); });
  $('btnPalReset').addEventListener('click', function () {
    pal = DEFAULTS.map(function (d) { return d[1]; }); refreshRgb();
    swEls.forEach(function (b, i) { b.style.setProperty('--c', pal[i]); });
    palInputs.forEach(function (inp, i) { inp.value = pal[i]; });
    dirty = true; schedule(); scheduleSave(); toast('色を初期値に戻しました');
  });

  /* ---------- image import ---------- */
  function srgb2lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function toLab(r, g, b) {
    var R = srgb2lin(r), G = srgb2lin(g), B = srgb2lin(b);
    var X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
    var Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
    var Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    var fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function prepareSource(im) {
    var sw = im.naturalWidth, sh = im.naturalHeight, m = Math.max(sw, sh);
    if (m > 2048) { var k = 2048 / m; sw = Math.max(1, Math.round(sw * k)); sh = Math.max(1, Math.round(sh * k)); }
    var c = document.createElement('canvas'); c.width = sw; c.height = sh;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, sw, sh);
    return { w: sw, h: sh, nw: im.naturalWidth, nh: im.naturalHeight, d: x.getImageData(0, 0, sw, sh).data };
  }
  function resample(src, tw, th) {
    var sw = src.w, sh = src.h, sd = src.d, out = new Float32Array(tw * th * 4);
    for (var ty = 0; ty < th; ty++) {
      var y0 = Math.floor(ty * sh / th), y1 = Math.max(y0 + 1, Math.ceil((ty + 1) * sh / th));
      for (var tx = 0; tx < tw; tx++) {
        var x0 = Math.floor(tx * sw / tw), x1 = Math.max(x0 + 1, Math.ceil((tx + 1) * sw / tw));
        var r = 0, g = 0, b = 0, a = 0, n = 0;
        for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
          var i = (y * sw + x) * 4, al = sd[i + 3];
          r += sd[i] * al; g += sd[i + 1] * al; b += sd[i + 2] * al; a += al; n++;
        }
        var o = (ty * tw + tx) * 4;
        if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
        out[o + 3] = a / n;
      }
    }
    return out;
  }
  function quantize(src, longSide, dither) {
    var tw, th;
    if (longSide === 0) { tw = src.nw; th = src.nh; }
    else { var k = longSide / Math.max(src.nw, src.nh); tw = Math.max(1, Math.round(src.nw * k)); th = Math.max(1, Math.round(src.nh * k)); }
    var m = Math.max(tw, th);
    if (m > MAX) { var k2 = MAX / m; tw = Math.max(1, Math.round(tw * k2)); th = Math.max(1, Math.round(th * k2)); }
    var px = resample(src, tw, th);
    var labs = rgbs.map(function (c) { return toLab(c[0], c[1], c[2]); });
    function nearest(r, g, b) {
      var l = toLab(r, g, b), best = 0, bd = Infinity;
      for (var i = 0; i < 16; i++) {
        var q = labs[i], d0 = l[0] - q[0], d1 = l[1] - q[1], d2 = l[2] - q[2], d = d0 * d0 + d1 * d1 + d2 * d2;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    var out = new Uint8Array(tw * th);
    for (var y = 0; y < th; y++) for (var x = 0; x < tw; x++) {
      var o = (y * tw + x) * 4;
      if (px[o + 3] < 128) continue;
      var r = clamp(px[o], 0, 255), g = clamp(px[o + 1], 0, 255), b = clamp(px[o + 2], 0, 255);
      var idx = nearest(r, g, b);
      out[y * tw + x] = idx + 1;
      if (dither) {
        var pr = rgbs[idx], er = r - pr[0], eg = g - pr[1], eb = b - pr[2];
        var spread = function (xx, yy, f) {
          if (xx < 0 || xx >= tw || yy >= th) return;
          var oo = (yy * tw + xx) * 4;
          if (px[oo + 3] < 128) return;
          px[oo] += er * f; px[oo + 1] += eg * f; px[oo + 2] += eb * f;
        };
        spread(x + 1, y, 7 / 16); spread(x - 1, y + 1, 3 / 16); spread(x, y + 1, 5 / 16); spread(x + 1, y + 1, 1 / 16);
      }
    }
    return { w: tw, h: th, d: out };
  }

  var srcCache = null, importResult = null;
  function updateImportPreview() {
    if (!srcCache) return;
    var r = quantize(srcCache, +$('importSize').value, $('importDither').checked);
    importResult = r;
    var pc = $('importPrev'); pc.width = r.w; pc.height = r.h;
    var pctx = pc.getContext('2d'), id = pctx.createImageData(r.w, r.h), d = id.data, used = {};
    for (var i = 0; i < r.d.length; i++) {
      var v = r.d[i]; if (!v) continue;
      var c = rgbs[v - 1], o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; used[v] = 1;
    }
    pctx.putImageData(id, 0, 0);
    $('importInfo').textContent = r.w + ' × ' + r.h + 'マス・' + Object.keys(used).length + '色を使用。取り込むと今の絵は置きかわります（元に戻せます）。';
  }
  $('importFile').addEventListener('change', function () {
    var f = $('importFile').files && $('importFile').files[0];
    if (!f) return;
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      try {
        srcCache = prepareSource(im);
        $('importSize').value = Math.max(im.naturalWidth, im.naturalHeight) <= 128 ? '0' : '64';
        $('importBody').hidden = false;
        updateImportPreview();
      } catch (err) { toast('画像を読み込めませんでした'); }
      URL.revokeObjectURL(url);
    };
    im.onerror = function () { toast('画像を読み込めませんでした'); URL.revokeObjectURL(url); };
    im.src = url;
  });
  $('importSize').addEventListener('change', updateImportPreview);
  $('importDither').addEventListener('change', updateImportPreview);
  $('btnImport').addEventListener('click', function () {
    if (!importResult) return;
    pushUndo(snapshot());
    var sizeChanged = importResult.w !== W || importResult.h !== H;
    W = importResult.w; H = importResult.h; data = importResult.d.slice();
    afterData(true); closeSheet(); toast(W + ' × ' + H + 'マスで取り込みました');
  });

  /* ---------- export ---------- */
  var exportUrl = null;
  function download(blob, name) {
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = exportUrl; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    // ダウンロードできない環境向けに、長押し保存用の画像も出しておく
    $('exportImg').src = exportUrl;
    $('exportFallback').hidden = false;
  }
  $('btnExport').addEventListener('click', function () {
    var sc = +$('exportScale').value || 1;
    var c = document.createElement('canvas'); c.width = W * sc; c.height = H * sc;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, W * sc, H * sc);
    c.toBlob(function (blob) {
      if (!blob) { toast('書き出しに失敗しました'); return; }
      var name = 'paint-' + W + 'x' + H + (sc > 1 ? '-x' + sc : '') + '.png';
      download(blob, name);
      toast('PNGを書き出しました');
    }, 'image/png');
  });

  /* ---------- theme changes ---------- */
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { schedule(); }); } catch (_) {}
  new MutationObserver(function () { schedule(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('pagehide', save);

  /* ---------- init ---------- */
  var restored = loadSaved();
  if (!restored) loadSample();
  refreshRgb();
  buildPalette();
  buildPalEditor();
  $('btnGrid').setAttribute('aria-pressed', String(showGrid));
  $('chkMajor').checked = showMajor;
  setTool('pen');
  updateSizeUI(); updateHist();
  new ResizeObserver(function () { if (autoFit) fit(); else schedule(); }).observe(stage);
  requestAnimationFrame(function () { fit(); });
})();
