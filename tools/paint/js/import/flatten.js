// のっぺり: 似た色でとなり合うマスを1つの領域にまとめ、領域の平均色でぬる（ペンキに置きかえる前に行う）
//   取り込んだ画像は JPEG のノイズやぼかしで近い色がモザイク状にまざるので、領域ごとに1色にしてパキッと分ける
//   1. 色の差の小さい境目から順に、両側の領域の平均色が近ければつなぐ（グラデーションは段に分かれる）
//   2. 小さすぎる領域（ふちのにじみ・ノイズ）は、一番近い色のとなりの領域に入れる（色が離れていれば残す）
// lab: Float32Array(n*3) を書きかえる。on: Uint8Array(n)（1 = 色あり）。s: 強さ 0..10
export function flatten(w, h, lab, on, s) {
  if (!(s > 0)) return;
  const n = w * h, T2 = (s * 3) ** 2;              // まとめる色の差（Lab）。強さ10で 30
  const LIM2 = (5 + s * 4.5) ** 2;                  // 小さい領域を入れてよい色の差。強さ10で 50
  const minSize = Math.ceil(s / 3);                 // これ以下のマス数の領域を小さいとみなす
  const parent = new Int32Array(n), size = new Int32Array(n), sum = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    parent[i] = i; size[i] = 1;
    sum[i * 3] = lab[i * 3]; sum[i * 3 + 1] = lab[i * 3 + 1]; sum[i * 3 + 2] = lab[i * 3 + 2];
  }
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const meanDist2 = (a, b) => {
    let d = 0;
    for (let k = 0; k < 3; k++) { const t = sum[a * 3 + k] / size[a] - sum[b * 3 + k] / size[b]; d += t * t; }
    return d;
  };
  const union = (a, b) => {
    if (size[a] < size[b]) [a, b] = [b, a];
    parent[b] = a; size[a] += size[b];
    for (let k = 0; k < 3; k++) sum[a * 3 + k] += sum[b * 3 + k];
  };

  // となり合う色ありマスの組（右・下）を、色の差の小さい順に
  const ea = [], eb = [], ed = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!on[i]) continue;
    for (const j of [x < w - 1 ? i + 1 : -1, y < h - 1 ? i + w : -1]) {
      if (j < 0 || !on[j]) continue;
      const d0 = lab[i * 3] - lab[j * 3], d1 = lab[i * 3 + 1] - lab[j * 3 + 1], d2 = lab[i * 3 + 2] - lab[j * 3 + 2];
      ea.push(i); eb.push(j); ed.push(d0 * d0 + d1 * d1 + d2 * d2);
    }
  }
  const order = Array.from(ed.keys()).sort((p, q) => ed[p] - ed[q]);
  for (const e of order) {
    if (ed[e] > T2 * 4) break; // マス同士の差がこれだけあれば平均どうしもまず近くない
    const a = find(ea[e]), b = find(eb[e]);
    if (a !== b && meanDist2(a, b) < T2) union(a, b);
  }

  // 小さい領域を、平均色が一番近いとなりの領域へ（くり返して数マスのかたまりも片づける）
  for (let pass = 0; pass < 4; pass++) {
    const best = new Map(); // 小さい領域 → [となりの領域, 色の差]
    const consider = (a, b) => {
      if (size[a] > minSize) return;
      const d = meanDist2(a, b), cur = best.get(a);
      if (d < LIM2 && (!cur || d < cur[1])) best.set(a, [b, d]);
    };
    for (let e = 0; e < ea.length; e++) {
      const a = find(ea[e]), b = find(eb[e]);
      if (a !== b) { consider(a, b); consider(b, a); }
    }
    if (!best.size) break;
    for (const [a, [b]] of best) {
      const ra = find(a), rb = find(b);
      if (ra !== rb && size[ra] <= minSize) union(ra, rb);
    }
  }

  for (let i = 0; i < n; i++) {
    if (!on[i]) continue;
    const r = find(i);
    for (let k = 0; k < 3; k++) lab[i * 3 + k] = sum[r * 3 + k] / size[r];
  }
}
