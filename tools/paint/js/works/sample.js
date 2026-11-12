// 初回起動時に表示するサンプル（ハート）
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
const MAP = { '.': 0, r: 14, p: 15, k: 27, w: 28 }; // 濃い赤・濃いピンク・黒・白

export function sampleWork() {
  const w = 16, h = 16, d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = MAP[SAMPLE[y][x]] || 0;
  return { w, h, d };
}
