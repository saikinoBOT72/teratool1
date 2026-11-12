// 元画像の表示。ドラッグで範囲を選べる。見つけたマス目を線で重ねて表示する
const MAX_H = 300;

export function createSourceView(canvas, onCrop) {
  const ctx = canvas.getContext('2d');
  let img = null, crop = null, grid = null, scale = 1, drag = null;

  function layout() {
    if (!img) return;
    const box = canvas.parentElement.clientWidth - 18;
    scale = Math.min(box / img.width, MAX_H / img.height, 8);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = Math.round(img.width * scale) + 'px';
    canvas.style.height = Math.round(img.height * scale) + 'px';
    canvas.width = Math.round(img.width * scale * dpr);
    canvas.height = Math.round(img.height * scale * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    if (!img) return;
    const w = img.width * scale, h = img.height * scale;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(img, 0, 0, w, h);
    const c = drag ? drag.rect : crop;
    if (!c) return;
    const x = c.x * scale, y = c.y * scale, cw = c.w * scale, chh = c.h * scale;
    // 範囲の外を暗く
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, y); ctx.fillRect(0, y + chh, w, h - y - chh);
    ctx.fillRect(0, y, x, chh); ctx.fillRect(x + cw, y, w - x - cw, chh);
    if (grid && !drag) drawGrid(x, y, cw, chh);
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeRect(x - 1, y - 1, cw + 2, chh + 2);
    ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 0.5, y - 0.5, cw + 1, chh + 1);
  }

  function drawGrid(x, y, cw, chh) {
    if (grid.px * scale < 3 || grid.py * scale < 3) return; // 細かすぎると見えないので描かない
    ctx.beginPath();
    for (let p = grid.ox; p <= crop.w; p += grid.px) { const X = Math.round(x + p * scale) + 0.5; ctx.moveTo(X, y); ctx.lineTo(X, y + chh); }
    for (let p = grid.oy; p <= crop.h; p += grid.py) { const Y = Math.round(y + p * scale) + 0.5; ctx.moveTo(x, Y); ctx.lineTo(x + cw, Y); }
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,0,170,0.85)'; ctx.stroke();
  }

  function toSrc(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(img.width, (e.clientX - r.left) / scale)),
      y: Math.max(0, Math.min(img.height, (e.clientY - r.top) / scale)),
    };
  }
  function rectOf(a, b) {
    const x = Math.floor(Math.min(a.x, b.x)), y = Math.floor(Math.min(a.y, b.y));
    return { x, y, w: Math.max(1, Math.ceil(Math.max(a.x, b.x)) - x), h: Math.max(1, Math.ceil(Math.max(a.y, b.y)) - y) };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!img) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const p = toSrc(e);
    drag = { start: p, rect: rectOf(p, p) };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.rect = rectOf(drag.start, toSrc(e)); draw();
  });
  const end = () => {
    if (!drag) return;
    const r = drag.rect; drag = null;
    // 小さすぎる範囲（タップ）は無視
    if (r.w * scale >= 12 && r.h * scale >= 12) { crop = r; onCrop(r); }
    draw();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  new ResizeObserver(() => { layout(); draw(); }).observe(canvas.parentElement);

  return {
    setImage(c) { img = c; layout(); draw(); },
    setCrop(c) { crop = c; draw(); },
    setGrid(g) { grid = g; draw(); },
    redraw() { layout(); draw(); },
  };
}
