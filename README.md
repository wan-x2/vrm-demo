# VRM VTuber Demo

ブラウザだけで動作するVTuberデモアプリケーションです。

## 機能

- Webカメラから MediaPipe Holistic で顔468点＋ポーズ33点＋両手21点を検出
- Kalidokit を使用して VRMボーン／表情ブレンドシェイプへリターゲット
- Three.js + @pixiv/three-vrm で VRMアバターをリアルタイム描画
- アバターは常にカメラ正面を向く設定

## 技術スタック

| ライブラリ | バージョン | 用途 |
|------------|------------|------|
| three | ^0.169.0 | 3D描画 |
| @pixiv/three-vrm | ^3.1.2 | VRM読込・描画 |
| @mediapipe/holistic | ^0.5.1675471629 | 骨格検出 |
| @mediapipe/drawing_utils | ^0.3.1675466124 | ランドマーク描画 |
| kalidokit | ^1.1.5 | リターゲット |
| vite | ^5.4.11 | 開発サーバー |
| typescript | ^5.6.3 | TypeScript |

## セットアップ

1. リポジトリをクローン
```bash
git clone https://github.com/wan-x2/vrm-demo.git
cd vrm-demo
```

2. 依存関係をインストール
```bash
npm install
```

3. 開発サーバーを起動
```bash
npm run dev
```

4. ブラウザで http://localhost:5173 を開く

5. 「カメラを開始」ボタンをクリックしてWebカメラを許可

## 使い方

1. デフォルトのアバター（`public/avatar.vrm`）が自動的に読み込まれます
2. 「カメラを開始」をクリックしてモーションキャプチャを開始
3. カメラの前で動くとアバターが追従します
4. 別のVRMファイルを使用する場合は「VRMファイル」から選択

## ビルド

本番用ビルド:
```bash
npm run build
```

## プロジェクト構成

```
vrm-demo/
├─ public/
│  ├─ index.html
│  └─ avatar.vrm    # サンプルVRM（要追加）
├─ src/
│  ├─ main.ts       # メイン実装
│  └─ style.css     # スタイル
├─ tsconfig.json    # TypeScript設定
├─ vite.config.ts   # Vite設定
├─ package.json
└─ README.md
```

## 注意事項

- `public/avatar.vrm`にデフォルトのVRMファイルを配置してください
- WebカメラとGPUが必要です
- HTTPSまたはlocalhostでのみ動作します（WebカメラAPIの制限）

## VRMファイルの入手

無料のVRMファイルは以下から入手できます：
- [VRoid Hub](https://hub.vroid.com/)
- [ニコニ立体](https://3d.nicovideo.jp/)

ライセンスを確認の上、ご利用ください。