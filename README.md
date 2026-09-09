# Funkin HTML Asset Editor

公式の [FunkinCrew/funkin.assets](https://github.com/FunkinCrew/funkin.assets) をローカルへコピーせず、GitHub API と jsDelivr CDN の外部URLから直接参照する編集用HTMLです。

## 起動

`index.html` を `file://` で直接開くと、ブラウザのCORS制限でGitHub APIを取得できない場合があります。プロジェクトフォルダで次のようにHTTPサーバーを起動してください。

```bash
python3 -m http.server 8080
```

その後、`http://localhost:8080/` を開きます 。

## できること

- 公式アセットリポジトリのファイル一覧をGitHub APIから取得

- 画像、音声、JSONを公式CDN URLから直接プレビュー

- タイトル、テーマ色、背景色、参照ブランチ、アセットベースURLをHTML画面で編集

- 編集した設定をJSONとして確認し、ブラウザのlocalStorageへ保存

- 添付された `Funkin.js` を `game.html` からLime embed方式で起動

## 外部URL

既定値は次の2つです。

- API: `https://api.github.com/repos/FunkinCrew/funkin.assets/git/trees/main?recursive=1`

- CDN: `https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/`

ブランチやタグを使う場合は、画面上のURLを変更してください 。アセットのライセンスは公式アセットリポジトリの [LICENSE.md](https://github.com/FunkinCrew/funkin.assets/blob/main/LICENSE.md) に従ってください。

> `Funkin.js` は添付されたHaxe/Limeの実行バンドルです。公式ゲームの完全なソースビルドをブラウザへ移植するものではなく、外部アセットの編集・確認UIと起動用HTMLシェルを分離しています。
