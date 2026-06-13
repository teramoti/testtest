# BLUE_GHOST
## 概要

このプロジェクトは Vite + React + TypeScript + Phaser 4 を使用したフロントエンドアプリです。
※ゲーム概要はいつか書きます（他のプロジェクトで使用する場合の参考情報にでもなればのファイル）

一旦参考情報用に作成した連携部分で、
使いまわし出来そうな部分を作成

画面比率 1280 x 720 
ゲーム開始時に、iframeから人数を受け取る機能を実装
ゲームのリザルトでiframeの子から順位を送信する機能の実装まで


---

## 技術スタック

* Vite
* React
* TypeScript
* Phaser 4（ゲームエンジン）

---

## 環境構築

### クローンしたこちらの環境フォルダで実行

```bash
npm install
```

## 開発サーバー起動

以下のコマンドを実行するか、NPMスクリプトから「dev」を実行してください。
ローカル環境のアドレスについては、起動時に記載されます。
```bash
npm run dev
```

---

## ビルド

本番環境....もとい、統合プロジェクトで使用するための成果物の作成用コマンド
（ビルド結果は静的ファイルとなるので、index.htmlで完結可能）
```bash
npm run build
```

ビルド成果物は `dist/` フォルダに出力されます。

---

## プレビュー（本番ビルド確認）

本番ビルドの動作検証用、本番ビルドと同じものがローカルで動くイメージ
```bash
npm run preview
```

---

## Phaserについて

このプロジェクトでは Phaser 4 を使用してゲームロジックを構築します。

---

## ディレクトリ構成（例）

```
.
├─ dist/                # ビルド済みのファイル
│  ├─ 色々なフォルダ/    # ビルド時の構成ファイル（左のフォルダ名は適当）
│  └─ index.html        # ビルド済みのhtmlファイル（ダブルクリックで起動するとCORSエラーで見れないので注意）
├─ src/
│  ├─ app/                # React側（UI・状態管理）※統合プロジェクトとの連携部分
│  │  ├─ components/
│  │  ├─ screens/
│  │  │  ├─ StartScreen.tsx　　←ゲームスタート画面（REACT）
│  │  │  ├─ GameScreen.tsx　　 ←ゲーム画面（ゲーム部分の呼び出しとリザルト検知部分）
│  │  │  └─ ResultScreen.tsx　 ←ゲームリザルト画面（REACt）
│  │  └─ App.tsx　　　         ←シーン切り替えなどの基幹部分
│  │
│  ├─ game/               # Phaser側（ゲーム部分）
│  │  ├─ config.ts        # ゲーム設定
│  │  ├─ GameManager.ts   # Reactとのリザルトなどの部分の接続部分
│  │  ├─ assets/          # 画像など
│  │  ├─ scenes/          # シーン管理
│  │  └─ types/           # ゲーム内のみで使用する（型・定数など）
│  │
│  ├─ shared/             # 共通（型・定数など）
│  │  ├─ types/
│  │  └─ constants/
│  │
│  └─ main.tsx　　　　　　 # ブラウザ部分（REACT）
├─ index.html             # 全ての入口（ここは編集しない）
├─ package.json
└─ vite.config.ts
```

dist配下のフォルダは統合プロジェクト用（index.html指定でLive Server経由であれば起動できるはず）

---

## スクリプト一覧
※VScodeのエクスプローラーから「Npm スクリプト」を有効化しておいてください

| コマンド            | 内容       |
| --------------- | -------- |
| npm run dev     | 開発サーバー起動 |
| npm run build   | 本番ビルド    |
| npm run preview | ビルド結果の確認 |

---

## 注意事項

* 型チェックは `tsc -b` によって実行されます
* Node.js のバージョンは 18 以上を推奨（作成時は24を使用しています）
* PhaserはCanvas/WebGLを使用するため、ブラウザ環境が必要です

## Windowsでのインストール時の注意事項
（macの場合は、node.jsのインストール後のパスを通す作業は不要だと思います）

■Node.jsのインストール
下記のURLから、Node.jsをインストールする（最新版でOK）
https://nodejs.org/ja/download


■node.jsのインストール後のパスを通す作業
1：windowsのスタートメニューで「環境変数」で検索
2：「システム環境変数の編集」をクリック
3：出てきたウィンドウで「環境変数(N)...」を押す

4：「ユーザー名」のユーザー環境変数(U)の枠内の「新規(N)...」を押す
5：変数名と変数値が出てくるので、以下を入力
　変数名(N)：nodejs
　変数値(V)：C:\Program Files\nodejs\
6：「OK」ボタンを連打で登録する


■VScodeで [npm -v]を実行したときに以下のエラーが出る場合の対処法
ターミナル(PowerShell)側の権限問題のようで、npmコマンドが使用できない

//////********************************///////////////
npm : このシステムではスクリプトの実行が無効になっているため、
ファイル C:\Program Files\nodejs\npm.ps1 を読み込むこ とができません。
詳細については、「about_Execution_Policies」(https://go.microsoft.com/fwlink/?LinkID=135170) を参照 してください。 
発生場所 行:1 文字:1 + npm -v + ~~~ + CategoryInfo : セキュリティ エラー: (: ) []、PSSecurityException + FullyQualifiedErrorId : UnauthorizedAccess
/////*********************************///////////////


→→解決方法　（ターミナル側で以下のコマンドを実行）
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
