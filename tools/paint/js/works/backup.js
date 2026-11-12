// 全作品のバックアップ（JSONファイル）と復元
import { download, toast } from '../util.js';
import { listWorks, loadWork, createWork, saveCurrent, parseWork, encode, PAINT_VERSION } from './store.js';

const APP = 'teratool1-paint';
const pad = (n) => String(n).padStart(2, '0');

export function exportBackup() {
  saveCurrent();
  const works = [];
  for (const e of listWorks()) {
    const w = loadWork(e.id);
    if (w) works.push({ name: e.name, p: PAINT_VERSION, w: w.w, h: w.h, d: encode(w.d), navRow: w.navRow });
  }
  const json = JSON.stringify({ app: APP, version: 3, exportedAt: new Date().toISOString(), works });
  const t = new Date();
  const name = `paint-backup-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}.json`;
  download(new Blob([json], { type: 'application/json' }), name);
  toast(works.length + '件の作品をファイルに保存しました');
}

// 読み込んだ作品は既存の作品を上書きせず、新しい作品として追加する。追加した件数を返す
// 古い版（ペンキ16色の頃）のバックアップも、新しいペンキの番号に置きかえて読み込む
export async function importBackup(file) {
  if (file.size > 20 * 1024 * 1024) { toast('ファイルが大きすぎます'); return 0; }
  let o;
  try { o = JSON.parse(await file.text()); } catch (e) { toast('JSONファイルとして読めませんでした'); return 0; }
  if (!o || o.app !== APP || !Array.isArray(o.works)) { toast('このツールのバックアップファイルではありません'); return 0; }

  const names = new Set(listWorks().map((e) => e.name));
  let added = 0, failed = 0;
  for (const raw of o.works) {
    const w = parseWork(raw);
    if (!w) { failed++; continue; }
    let name = (typeof raw.name === 'string' ? raw.name.trim().slice(0, 40) : '') || '読み込んだ作品';
    if (names.has(name)) name += '（復元）';
    names.add(name);
    if (createWork(name, w)) added++; else failed++;
  }

  toast(`${added}件の作品を読み込みました` + (failed ? `（${failed}件は読み込めませんでした）` : ''));
  return added;
}
