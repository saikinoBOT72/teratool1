// 拡大されていない（1ピクセル = 1マスの）画像かどうか
//   拡大された絵では「1ピクセル幅の飛び出し」（隣どうしで続けて色が大きく変わり、しかも向きが違う）が起きない。
//   それがよく出てくるなら拡大されていないとみなす
export function looksUnscaled(src, crop) {
  const { w: SW, d } = src, rows = Math.min(crop.h, 128);
  let sig = 0, spikes = 0;
  for (let r = 0; r < rows; r++) {
    const y = crop.y + Math.floor((r + 0.5) * crop.h / rows);
    let prev = null;
    for (let x = 1; x < crop.w; x++) {
      const a = (y * SW + crop.x + x - 1) * 4, b = a + 4;
      const v = [d[b] - d[a], d[b + 1] - d[a + 1], d[b + 2] - d[a + 2], d[b + 3] - d[a + 3]];
      const mag = Math.hypot(v[0], v[1], v[2], v[3]);
      if (mag < 80) { prev = null; continue; }
      sig++;
      if (prev) {
        const dot = v[0] * prev.v[0] + v[1] * prev.v[1] + v[2] * prev.v[2] + v[3] * prev.v[3];
        if (dot < 0.5 * mag * prev.mag) spikes++;
      }
      prev = { v, mag };
    }
  }
  return sig >= 20 && spikes / sig > 0.2;
}
