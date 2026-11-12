// 作品と設定の保存（この端末のブラウザの localStorage のみ）
//   teratool1.paint.settings      … 色の調整・表示設定・開いている作品
//   teratool1.paint.works         … 作品の一覧 [{ id, name, w, h, updated }]
//   teratool1.paint.work.<id>     … 作品の中身 { w, h, d, done, navRow }
import { st, MAX } from '../state.js';
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
    if (v < 0 || v > 16) return null;
    d[i] = v;
  }
  return d;
}

// 保存形式（d は文字列）を検証して { w, h, d: Uint8Array, done: number[], navRow } に
export function parseWork(o) {
  if (!o || !Number.isInteger(o.w) || !Number.isInteger(o.h)) return null;
  if (o.w < 1 || o.h < 1 || o.w > MAX || o.h > MAX) return null;
  const d = decode(o.d, o.w * o.h);
  if (!d) return null;
  const done = Array.isArray(o.done) ? o.done.filter((y) => Number.isInteger(y) && y >= 0 && y < o.h) : [];
  const navRow = Number.isInteger(o.navRow) && o.navRow >= 0 && o.navRow < o.h ? o.navRow : o.h - 1;
  return { w: o.w, h: o.h, d, done, navRow };
}

export function listWorks() {
  const a = read(K_INDEX);
  return Array.isArray(a) ? a.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string') : [];
}
export function loadWork(id) { return parseWork(read(kWork(id))); }

// 作品を保存し、一覧の情報も更新する。容量不足なら false
export function putWork(id, name, w) {
  const ok = write(kWork(id), { w: w.w, h: w.h, d: encode(w.d), done: [...(w.done || [])], navRow: w.navRow ?? w.h - 1 });
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
  st.done = new Set(w.done); st.navRow = w.navRow;
  return true;
}

let warned = false;
export function saveCurrent() {
  if (!st.workId) return;
  const done = [...st.done].filter((y) => y < st.H);
  const ok = putWork(st.workId, st.workName, { w: st.W, h: st.H, d: st.data, done, navRow: Math.min(st.navRow, st.H - 1) });
  if (!ok && !warned) { warned = true; toast('保存できませんでした（ブラウザの保存容量がいっぱいの可能性）'); }
  if (ok) warned = false;
}

export function saveSettings() {
  write(K_SETTINGS, {
    v: 2, pal: st.pal, grid: st.showGrid, major: st.showMajor, sel: st.sel,
    mirror: st.mirror, fromBottom: st.naviFromBottom, current: st.workId,
  });
}

export function save() { saveCurrent(); saveSettings(); }
let timer = 0;
export function scheduleSave() { clearTimeout(timer); timer = setTimeout(save, 400); }

function applySettings(o) {
  if (!o) return;
  if (Array.isArray(o.pal) && o.pal.length === 16 && o.pal.every((h) => /^#[0-9a-f]{6}$/i.test(h))) st.pal = o.pal.slice();
  if (typeof o.grid === 'boolean') st.showGrid = o.grid;
  if (typeof o.major === 'boolean') st.showMajor = o.major;
  if (o.sel >= 1 && o.sel <= 16) st.sel = o.sel;
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

// 起動時: 設定を読み、最後に開いていた作品（なければサンプル）を開く
export function boot() {
  migrateLegacy();
  const s = read(K_SETTINGS);
  applySettings(s);
  const list = listWorks();
  const ids = [s && s.current, ...list.map((e) => e.id)].filter(Boolean);
  for (const id of ids) if (applyWork(id)) return;
  const sample = sampleWork();
  const id = createWork('作品 1', { ...sample, done: [], navRow: sample.h - 1 });
  if (id && applyWork(id)) return;
  // 保存できない環境（プライベートモード等）でも描けるようにする
  st.workId = null; st.workName = '作品 1';
  st.W = sample.w; st.H = sample.h; st.data = sample.d;
}
