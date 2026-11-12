// 下のバーから開く一覧（道具・ペンキ）の開閉。同時に開くのは1つだけ
import { $ } from './util.js';

const POPS = { tool: ['btnTool', 'toolPop'], color: ['btnColor', 'colorPop'] };
let open = null;

export function popOpen() { return !!open; }

export function closePops() {
  if (!open) return;
  const [b, p] = POPS[open];
  $(p).hidden = true; $(b).setAttribute('aria-expanded', 'false');
  open = null;
}

export function openPop(name) {
  closePops();
  const [b, p] = POPS[name];
  $(p).hidden = false; $(b).setAttribute('aria-expanded', 'true');
  open = name;
}

function toggle(name) { if (open === name) closePops(); else openPop(name); }

export function initPops() {
  $('btnTool').addEventListener('click', () => toggle('tool'));
  $('btnColor').addEventListener('click', () => toggle('color'));
  // 一覧とバーの外を押したら閉じる（キャンバスは input.js 側で「閉じるだけ」にする）
  document.addEventListener('pointerdown', (e) => {
    if (open && !e.target.closest('.dock') && e.target.id !== 'cv') closePops();
  });
}
