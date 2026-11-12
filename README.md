# teratool1

Terraria を遊ぶときに使う、自分用の小さな Web ツール集。
トップページ（`index.html`）で使うツールを選びます。

## ツール
| ツール | 場所 | 内容 |
| --- | --- | --- |
| ペンキドット絵 | `tools/paint/` | 16色のペンキでドット絵の設計図を描く。画像の取り込み（16色に減色）、PNG書き出しに対応 |

## 使い方
ビルド不要の静的サイトです。

- **ローカル**: リポジトリのフォルダでサーバーを立ててブラウザで開く
  ```
  python3 -m http.server 8000
  # → http://localhost:8000/
  ```
- **GitHub Pages**: Settings → Pages → Source を「Deploy from a branch」、ブランチ `main` / フォルダ `/ (root)` にする

## 構成
```
index.html            トップページ（ツール選択）
assets/base.css       全ページ共通の色・リセット
assets/home.css       トップページ用
tools/<ツール名>/     ツールごとのフォルダ（index.html / *.css / *.js）
```
ツールを追加するときは `tools/` にフォルダを作り、`index.html` のツール一覧にカードを足します。

## プライバシー
- すべてブラウザ内で動作し、外部への通信は行いません（各ページの Content-Security-Policy で外部接続を禁止）。
- 外部フォント・CDN・アクセス解析は使いません。
- 取り込んだ画像はアップロードされず、端末内だけで処理されます。
- 作業内容はブラウザの localStorage（キーは `teratool1.` で始まる）にのみ保存されます。

## 注意事項 / Disclaimer
- 本プロジェクトは非公式のファンメイドツールであり、Re-Logic とは一切関係ありません。
- Terraria は Re-Logic の商標です。
- このリポジトリにはゲームのファイル、画像、音声、その他のアセットは含まれていません。
  ペンキの色は見た目を手で合わせた近似値です。

This is an unofficial fan-made tool and is not affiliated with or endorsed by Re-Logic.
Terraria is a trademark of Re-Logic. No game files or assets are included in this repository.

## ライセンス
[MIT License](LICENSE)

## 開発者向け
公開リポジトリのため、コミット前に [公開ポリシー](docs/PUBLISHING_POLICY.md) を確認すること。
