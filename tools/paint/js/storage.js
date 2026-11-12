// localStorage への保存・復元（この端末のブラウザ内のみ）
import { st, MAX, STORAGE_KEY } from './state.js';

const SAMPLE = [
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
  '................',
];
const SAMPLE_MAP = { '.': 0, r: 1, p: 12, k: 13, w: 14 };

function encode(d) {
  let s = '';
  for (let i = 0; i < d.length; i++) s += String.fromCharCode(48 + d[i]);
  return s;
}
function decode(s, n) {
  if (typeof s !== 'string' || s.length !== n) return null;
  const d = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = s.charCodeAt(i) - 48;
    if (v < 0 || v > 16) return null;
    d[i] = v;
  }
  return d;
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1, w: st.W, h: st.H, d: encode(st.data),
      pal: st.pal, grid: st.showGrid, major: st.showMajor, sel: st.sel,
    }));
  } catch (e) { /* storage unavailable */ }
}

let saveTimer = 0;
export function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }

export function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || !(o.w >= 1 && o.w <= MAX && o.h >= 1 && o.h <= MAX)) return false;
    const d = decode(o.d, o.w * o.h);
    if (!d) return false;
    st.W = o.w; st.H = o.h; st.data = d;
    if (Array.isArray(o.pal) && o.pal.length === 16 && o.pal.every((h) => /^#[0-9a-f]{6}$/i.test(h))) st.pal = o.pal.slice();
    if (typeof o.grid === 'boolean') st.showGrid = o.grid;
    if (typeof o.major === 'boolean') st.showMajor = o.major;
    if (o.sel >= 1 && o.sel <= 16) st.sel = o.sel;
    return true;
  } catch (e) { return false; }
}

export function loadSample() {
  st.W = 16; st.H = 16; st.data = new Uint8Array(st.W * st.H);
  for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) {
    const ch = (SAMPLE[y] || '').charAt(x) || '.';
    st.data[y * st.W + x] = SAMPLE_MAP[ch] || 0;
  }
}
