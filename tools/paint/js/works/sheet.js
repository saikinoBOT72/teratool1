// 作品一覧のシート（開く・新規・名前変更・複製・削除・バックアップ）
import { st } from '../state.js';
import { $, el, toast } from '../util.js';
import { makeSheet, openSheet, closeSheet } from '../sheet.js';
import { markDirty } from '../render.js';
import { fit } from '../view.js';
import { updateSizeUI } from '../palette.js';
import { clearHistory } from '../history.js';
import { refreshNavi } from '../navi/navi.js';
import {
  listWorks, loadWork, applyWork, createWork, deleteWork, renameWork, nextName, saveCurrent, saveSettings,
} from './store.js';
import { exportBackup, importBackup } from './backup.js';

const BODY = `
<section>
  <div class="row"><button class="btn primary" type="button" id="worksNew">新しい作品（32×32）</button></div>
  <ul class="works" id="worksList"></ul>
</section>
<section>
  <h3>バックアップ</h3>
  <p class="hint">作品はこの端末のブラウザにだけ保存されています。ブラウザのデータを消すと作品も消えるので、ときどきファイルに保存しておくと安心です。</p>
  <div class="row">
    <button class="btn" type="button" id="backupSave">ファイルに保存（JSON）</button>
    <label class="btn file-btn">ファイルから読み込む<input type="file" id="backupLoad" accept=".json,application/json"></label>
  </div>
</section>`;

let sheet = null;

// 作品を開く（取り込みからも使う）
export function openWork(id) {
  saveCurrent();
  if (!applyWork(id)) { toast('作品を開けませんでした'); return false; }
  clearHistory();
  st.autoFit = true;
  updateSizeUI(); fit(); markDirty(); refreshNavi(); saveSettings();
  return true;
}

function thumb(w) {
  const c = el('canvas'); c.width = w.w; c.height = w.h;
  const x = c.getContext('2d'), id = x.createImageData(w.w, w.h);
  for (let i = 0; i < w.d.length; i++) {
    const v = w.d[i];
    if (!v) continue;
    const rgb = st.rgbs[v - 1], o = i * 4;
    id.data[o] = rgb[0]; id.data[o + 1] = rgb[1]; id.data[o + 2] = rgb[2]; id.data[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return c;
}

function fmtDate(t) {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function button(label, fn, cls = 'btn small') {
  const b = el('button', cls, label); b.type = 'button';
  b.addEventListener('click', fn);
  return b;
}

function renderList() {
  const ul = $('worksList');
  ul.textContent = '';
  for (const e of listWorks()) {
    const w = loadWork(e.id);
    if (!w) continue;
    const cur = e.id === st.workId;
    const li = el('li', cur ? 'work current' : 'work');
    li.appendChild(thumb(w));
    const meta = el('div', 'work-meta');
    meta.appendChild(el('strong', null, e.name));
    meta.appendChild(el('span', null, `${w.w}×${w.h}マス・${fmtDate(e.updated)}` + (cur ? '・編集中' : '')));
    li.appendChild(meta);
    const act = el('div', 'work-actions');
    if (!cur) act.appendChild(button('開く', () => { if (openWork(e.id)) closeSheet(); }, 'btn small primary'));
    act.appendChild(button('名前', () => {
      const name = prompt('作品の名前', e.name);
      if (name && name.trim()) { renameWork(e.id, name.trim().slice(0, 40)); updateSizeUI(); renderList(); }
    }));
    act.appendChild(button('複製', () => {
      if (cur) saveCurrent();
      const src = loadWork(e.id);
      if (src && createWork(e.name.slice(0, 34) + ' のコピー', src)) renderList();
      else toast('複製できませんでした（容量不足の可能性）');
    }));
    act.appendChild(button('削除', () => {
      if (!confirm(`「${e.name}」を削除しますか？（元に戻せません）`)) return;
      deleteWork(e.id);
      if (cur) {
        st.workId = null; // 削除した作品を保存し直さないように
        const next = listWorks()[0];
        if (next) openWork(next.id); else newWork();
      }
      renderList();
    }, 'btn small danger'));
    li.appendChild(act);
    ul.appendChild(li);
  }
}

function newWork() {
  saveCurrent();
  const id = createWork(nextName(), { w: 32, h: 32, d: new Uint8Array(32 * 32), navRow: 31 });
  if (!id) { toast('作品を作れませんでした（容量不足の可能性）'); return; }
  openWork(id);
}

export function openWorks() {
  saveCurrent();
  renderList();
  openSheet(sheet);
}

export function initWorks() {
  sheet = makeSheet('worksSheet', '作品', BODY);
  $('worksNew').addEventListener('click', () => { newWork(); closeSheet(); toast('新しい作品を作りました'); });
  $('backupSave').addEventListener('click', exportBackup);
  $('backupLoad').addEventListener('change', async () => {
    const f = $('backupLoad').files && $('backupLoad').files[0];
    $('backupLoad').value = '';
    if (f && await importBackup(f)) renderList();
  });
  $('btnWorks').addEventListener('click', openWorks);
}
