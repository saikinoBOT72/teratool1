// 作品と設定の保存（この端末のブラウザの localStorage のみ）
//   teratool1.paint.settings      … 色の調整・表示設定・開いている作品
//   teratool1.paint.works         … 作品の一覧 [{ id, name, w, h, updated }]
//   teratool1.paint.work.<id>     … 作品の中身 { p: 3, w, h, d, navRow }
//   p = マスの値の付け方の版（3 = 壁 × 29 + ペンキ）。古い版は起動時に一度だけ今の版へ置きかえて保存し直す
//     p なし: 旧16色 / p: 2: ペンキ 1〜29 のみ（壁は全体で1つ）→ どちらも当時選んでいた壁として扱う
import { st, MAX, NPAINT, NVAL, wallIndex } from '../state.js';
import { uid, toast } from '../util.js';
import { sampleWork } from './sample.js';

const P = 'teratool1.paint.';
const K_SETTINGS = P + 'settings', K_INDEX = P + 'works', K_LEGACY = P + 'v1';
const kWork = (id) => P + 'work.' + id;

function read(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
}
function remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

/* ---- 1マス1文字（'0' + 番号）で文字列にする ---- */
export function encode(d) {
  let s = '';
  for (let i = 0; i < d.length; i++) s += String.fromCharCode(48 + d[i]);
  return s;
}
export function decode(s, n) {
  if (typeof s !== 'string' || s.length !== n) return null;
  const d = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = s.charCodeAt(i) - 48;
    if (v < 0 || v > NVAL) return null;
    d[i] = v;
  }
  return d;
}

// 旧16色（濃い12色 + 黒・白・グレー・茶）→ 新しい番号（1 + PAINTS の位置）
const OLD = { 1: 14, 2: 18, 3: 17, 4: 25, 5: 24, 6: 23, 7: 22, 8: 21, 9: 20, 10: 19, 11: 16, 12: 15, 13: 27, 14: 28, 15: 29, 16: 26 };
export const PAINT_VERSION = 3;

// 保存形式（d は文字列）を検証して { w, h, d: Uint8Array, navRow } に
export function parseWork(o) {
  if (!o || !Number.isInteger(o.w) || !Number.isInteger(o.h)) return null;
  if (o.w < 1 || o.h < 1 || o.w > MAX || o.h > MAX) return null;
  const d = decode(o.d, o.w * o.h);
  if (!d) return null;
  if (o.p !== PAINT_VERSION) {
    const old = o.p !== 2, max = old ? 16 : NPAINT, base = wallIndex() * NPAINT;
    for (let i = 0; i < d.length; i++) {
      if (d[i] > max) return null;
      if (d[i]) d[i] = (old ? OLD[d[i]] : d[i]) + base;
    }
  }
  const navRow = Number.isInteger(o.navRow) && o.navRow >= 0 && o.navRow < o.h ? o.navRow : o.h - 1;
  return { w: o.w, h: o.h, d, navRow };
}

export function listWorks() {
  const a = read(K_INDEX);
  return Array.isArray(a) ? a.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string') : [];
}
export function loadWork(id) { return parseWork(read(kWork(id))); }

// 作品を保存し、一覧の情報も更新する。容量不足なら false
export function putWork(id, name, w) {
  const ok = write(kWork(id), { p: PAINT_VERSION, w: w.w, h: w.h, d: encode(w.d), navRow: w.navRow ?? w.h - 1 });
  if (!ok) return false;
  const list = listWorks().filter((e) => e.id !== id);
  list.unshift({ id, name, w: w.w, h: w.h, updated: Date.now() });
  return write(K_INDEX, list);
}

export function createWork(name, w) {
  const id = uid();
  return putWork(id, name, w) ? id : null;
}

export function deleteWork(id) {
  remove(kWork(id));
  write(K_INDEX, listWorks().filter((e) => e.id !== id));
}

export function renameWork(id, name) {
  write(K_INDEX, listWorks().map((e) => (e.id === id ? { ...e, name } : e)));
  if (st.workId === id) st.workName = name;
}

export function nextName(base = '作品') {
  const names = new Set(listWorks().map((e) => e.name));
  let n = 1;
  while (names.has(base + ' ' + n)) n++;
  return base + ' ' + n;
}

/* ---- 開いている作品 ---- */
export function applyWork(id) {
  const w = loadWork(id);
  if (!w) return false;
  const entry = listWorks().find((e) => e.id === id);
  st.workId = id; st.workName = entry ? entry.name : '作品';
  st.W = w.w; st.H = w.h; st.data = w.d;
  st.navRow = w.navRow;
  return true;
}

let warned = false;
export function saveCurrent() {
  if (!st.workId) return;
  const ok = putWork(st.workId, st.workName, { w: st.W, h: st.H, d: st.data, navRow: Math.min(st.navRow, st.H - 1) });
  if (!ok && !warned) { warned = true; toast('保存できませんでした（ブラウザの保存容量がいっぱいの可能性）'); }
  if (ok) warned = false;
}

export function saveSettings() {
  write(K_SETTINGS, {
    v: 3, grid: st.showGrid, major: st.showMajor, sel: st.sel, mirror: st.mirror, fromBottom: st.naviFromBottom,
    colorMode: st.colorMode, gem: st.gem, lit: st.lit, current: st.workId,
  });
}

export function save() { saveCurrent(); saveSettings(); }
let timer = 0;
export function scheduleSave() { clearTimeout(timer); timer = setTimeout(save, 400); }

function applySettings(o) {
  if (!o) return;
  if (typeof o.grid === 'boolean') st.showGrid = o.grid;
  if (typeof o.major === 'boolean') st.showMajor = o.major;
  // v3 より前の選択中の色は旧16色の番号
  if (o.v >= 3 && Number.isInteger(o.sel) && o.sel >= 0 && o.sel <= NPAINT) st.sel = o.sel; // ペンキ番号
  else if (OLD[o.sel]) st.sel = OLD[o.sel];
  if (o.colorMode === 'world' || o.colorMode === 'map') st.colorMode = o.colorMode;
  if (o.gem === 'other' || o.gem === 'diamond') st.gem = o.gem;
  if (typeof o.lit === 'boolean') st.lit = o.lit;
  if (typeof o.mirror === 'boolean') st.mirror = o.mirror;
  if (typeof o.fromBottom === 'boolean') st.naviFromBottom = o.fromBottom;
}

// 旧形式（1枚だけ保存していた v1）を「作品 1」として引き継ぐ
function migrateLegacy() {
  const o = read(K_LEGACY);
  if (!o) return;
  if (o.v === 1) {
    applySettings(o);
    const w = parseWork({ w: o.w, h: o.h, d: o.d });
    if (w && createWork('作品 1', w)) saveSettings();
    else return; // 保存に失敗したら旧データは消さない
  }
  remove(K_LEGACY);
}

// 古い版の作品を今の版に置きかえて保存し直す（設定を読んだ後に呼ぶ）
function migrateWorks() {
  for (const e of listWorks()) {
    const raw = read(kWork(e.id));
    if (!raw || raw.p === PAINT_VERSION) continue;
    const w = parseWork(raw);
    if (w) write(kWork(e.id), { p: PAINT_VERSION, w: w.w, h: w.h, d: encode(w.d), navRow: w.navRow });
  }
}

// 起動時: 設定を読み、最後に開いていた作品（なければサンプル）を開く
export function boot() {
  const s = read(K_SETTINGS);
  applySettings(s);
  migrateLegacy();
  migrateWorks();
  const list = listWorks();
  const ids = [s && s.current, ...list.map((e) => e.id)].filter(Boolean);
  for (const id of ids) if (applyWork(id)) return;
  const sample = sampleWork();
  const id = createWork('作品 1', { ...sample, navRow: sample.h - 1 });
  if (id && applyWork(id)) return;
  // 保存できない環境（プライベートモード等）でも描けるようにする
  st.workId = null; st.workName = '作品 1';
  st.W = sample.w; st.H = sample.h; st.data = sample.d;
}
