// 取り込みシートの中身（固定の文字列）
export const IMPORT_BODY = `
<section>
  <p class="hint">ネットで見つけたドット絵や自分で描いたドット絵の画像から、マス目を自動で見つけて16色のペンキに置きかえます。だいたいの切り抜き・ぼやけた拡大でも大丈夫です。画像はこの端末の中だけで処理され、どこにも送信されません。</p>
  <div class="row">
    <label class="btn primary file-btn">画像・写真を選ぶ<input type="file" id="impFile" accept="image/*"></label>
    <button class="btn" type="button" id="impPaste">コピーした画像を貼り付け</button>
  </div>
  <p class="hint">ネットの画像は、長押し（PCは右クリック）→「画像をコピー」してから「貼り付け」を押すとそのまま取り込めます。PCなら Ctrl+V やドラッグ＆ドロップでもOK。</p>
</section>
<div id="impBody" hidden>
<section>
  <h3>1. 範囲</h3>
  <p class="hint">絵のまわりをドラッグで囲むと精度が上がります（だいたいでOK）。ピンクの線が見つけたマス目です。</p>
  <div class="imp-src"><canvas id="impSrc" aria-label="元の画像。ドラッグで範囲を選ぶ"></canvas></div>
  <div class="row"><button class="btn small" type="button" id="impCropReset">範囲を全体に戻す</button><span class="hint" id="impCropInfo"></span></div>
</section>
<section>
  <h3>2. マス目</h3>
  <div class="seg" role="radiogroup" aria-label="画像の種類">
    <label><input type="radio" name="impMode" value="dot" checked>ドット絵（自動で見つける）</label>
    <label><input type="radio" name="impMode" value="photo">普通の画像</label>
  </div>
  <div id="impDot" class="stack">
    <p class="hint" id="impDetect"></p>
    <div class="row">
      <label for="impCell">1マスの大きさ（px）<input id="impCell" type="number" min="1" max="256" step="0.1" inputmode="decimal"></label>
      <button class="btn small" type="button" id="impAuto">自動に戻す</button>
    </div>
  </div>
  <div id="impPhoto" class="row" hidden>
    <label for="impSize">長辺のマス数
      <select id="impSize"><option>16</option><option>32</option><option>48</option><option selected>64</option><option>96</option><option>128</option><option>200</option></select>
    </label>
    <label class="chk" for="impDither"><input type="checkbox" id="impDither">ディザ（網点で階調を出す）</label>
  </div>
</section>
<section>
  <h3>3. 背景と色</h3>
  <label class="chk" for="impBg"><input type="checkbox" id="impBg" checked>背景を自動で透明にする</label>
  <label class="chk" for="impTrim"><input type="checkbox" id="impTrim" checked>まわりの余白を詰める</label>
  <div class="row">
    <label for="impBright">明るさ <input type="range" id="impBright" min="-50" max="50" value="0"></label>
    <label for="impSat">鮮やかさ <input type="range" id="impSat" min="-50" max="50" value="0"></label>
    <button class="btn small" type="button" id="impColorReset">色を元に戻す</button>
  </div>
</section>
<section>
  <h3>4. 結果</h3>
  <div class="preview"><canvas id="impPrev" aria-label="取り込み結果のプレビュー"></canvas></div>
  <p class="hint" id="impInfo"></p>
  <div class="row">
    <button class="btn primary" type="button" id="impNew">新しい作品として取り込む</button>
    <button class="btn" type="button" id="impReplace">今の作品に置きかえる</button>
  </div>
</section>
</div>`;
