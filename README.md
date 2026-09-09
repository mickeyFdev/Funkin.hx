# Funkin HTML Asset Editor

公式の [FunkinCrew/funkin.assets](https://github.com/FunkinCrew/funkin.assets) をローカルへコピーせず、GitHub API と jsDelivr CDNの外部URLから直接参照する編集用HTMLです。静的ファイルだけで動作するため、**GitHub Pagesにそのまま公開できます**。

## GitHub Pagesで公開

1. このフォルダの内容をGitHubリポジトリのルートへアップロードします。

1. `main` ブランチへpushします。

1. GitHubの **Settings → Pages → Build and deployment** で、Sourceを **GitHub Actions** に設定します。

1. 同梱の `.github/workflows/pages.yml` が自動デプロイします。

1. Actionsのデプロイ完了後、Pagesに表示されたURLを開きます。

## ゲームが始まらない場合について

`Funkin.js` はアセットを相対パスの `assets/...` として読み込むため、以前の構成ではGitHub Pages上で全アセットが404になっていました。現在は `sw.js` がそのリクエストを公式CDNの以下の場所へ中継します。

- `assets/data/...` → `preload/data/...` または `shared/data/...`

- `assets/music/...` → `preload/music/...` または `shared/music/...`

- `assets/sounds/...` → `preload/sounds/...` または `shared/sounds/...`

- `assets/images/...` → `preload/images/...` または `shared/images/...`

初回アクセス時はService Workerの登録後に自動で1回リロードします。**GitHub PagesのHTTPS上で開いてください**。`file://` や一部のプレビューURLではService Workerが動作しません。ブラウザに古い404が残る場合は、ハードリロード（Ctrl+Shift+R）してください。

読み込み速度対策として、公式アセットはまず `preload/` を参照し、見つからない場合だけ `shared/` を参照します。取得に成功したファイルはブラウザキャッシュへ保存されるため、2回目以降の起動は速くなります。編集画面を開いた時点でService Worker登録も開始します。

ワークフローはビルドサーバーを必要とせず、静的ファイルをそのままPagesへ配置します。GitHub PagesではHTTPSで配信されるため、GitHub API、CDN、Service Workerが利用できます。

## ローカルで確認する場合

`file://` で直接開くとService Workerが使えません。プロジェクトフォルダで次を実行してください。

```bash
python3 -m http.server 8080
```

その後、`http://localhost:8080/` を開きます 。

## できること

- 公式アセットリポジトリのファイル一覧をGitHub APIから取得

- 画像、音声、JSONを公式CDN URLから直接プレビュー

- 公式のweekフォルダに限定せず、リポジトリの全ファイルを一覧・検索

- 任意のMODリポジトリをGitHub API tree URLとassetsベースURLで追加

- `.ttf`、`.otf`、`.woff`、`.woff2` フォントを読み込み、プレビュー・画面フォントへ適用

- タイトル、テーマ色、背景色、参照ブランチ、アセットベースURLをHTML画面で編集

- 編集した設定をJSONとして確認し、ブラウザのlocalStorageへ保存

- 添付された `Funkin.js` を `game.html` からLime embed方式で起動

## MODとフォント

編集画面の `MODのGitHub API tree URL` と `MOD assetsベースURL` に、任意の公開MODリポジトリを設定できます。tree一覧はweek名で絞らず、リポジトリ内の全ファイルを読み込みます。MODのベースURLは、`assets/data/...` に対応する実ファイルを直接返すURLを指定してください。たとえばMODリポジトリの `assets/` ディレクトリを公開するCDN URLです。

保存したMODベースURLはゲーム起動時にService Workerへ渡され、公式アセットより先に読み込まれます。同じ相対パスのファイルをMOD側に置けば差し替え、存在しないファイルは公式アセットへフォールバックします。

フォントは `.ttf`、`.otf`、`.woff`、`.woff2` のURLを入力して保存できます。公式またはMODの外部URLを指定すると、編集画面の文字表示に適用されます。アセット一覧からフォントファイルを選んだ場合も、右側でサンプル文字をプレビューできます。

## 外部URL

既定値は次の2つです。

- API: `https://api.github.com/repos/FunkinCrew/funkin.assets/git/trees/main?recursive=1`

- CDN: `https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/`

ブランチやタグを使う場合は、編集画面上のURLを変更してください 。アセットのライセンスは公式アセットリポジトリの [LICENSE.md](https://github.com/FunkinCrew/funkin.assets/blob/main/LICENSE.md) に従ってください。

> `Funkin.js` は添付されたHaxe/Limeの実行バンドルです。公式ゲームの完全なソースビルドをブラウザへ移植するものではなく、外部アセットの編集・確認UIと起動用HTMLシェルを分離しています。
