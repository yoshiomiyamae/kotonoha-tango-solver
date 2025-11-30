# Kotonoha Tango Solver

日本語5文字単語パズル（Wordle風ゲーム）の解答支援ツール

## 概要

このアプリケーションは、5文字のカタカナ単語を推測するパズルゲームの解答を支援するツールです。ユーザーが提供する制約条件（確定文字、含まれる文字、含まれない文字）に基づいて、最も可能性の高い単語を提案します。

## 主な機能

- **辞書ベースの単語推測**: 外部辞書データから候補単語をフィルタリング
- **制約条件の管理**:
  - 確定: 特定の位置に確定している文字
  - 含む: 単語に含まれているが位置が未確定の文字
  - 含まない: 単語に含まれていない文字
- **インタラクティブUI**: ラジオボタンで各文字の状態を選択
- **ターン管理**: 推測の履歴を追跡
- **リセット機能**: ワンクリックで初期状態に戻す

## 技術スタック

- **フレームワーク**: [Astro](https://astro.build/) 5.x
- **UIライブラリ**: React 19.x
- **状態管理**: [Nanostores](https://github.com/nanostores/nanostores)
- **言語**: TypeScript (strict mode)
- **パッケージマネージャ**: Bun
- **デプロイ**: GitHub Pages

## アルゴリズム

1. ユーザーが指定した制約条件で辞書をフィルタリング
2. フィルタ後の単語から文字の出現頻度を計算
3. 出現頻度の高い文字から5文字の組み合わせを生成
4. 各組み合わせで正規表現パターンを作成し、辞書を検索
5. マッチした最初の単語を返す

### 特殊ルール

- 1文字目には小文字（ァィゥェォッャュョヮ）、伸ばし棒（ー）、ンは使用不可
- 同じ文字が複数回出現する単語も許容

## セットアップ

### 前提条件

- [Bun](https://bun.sh/) がインストールされていること

### インストール

```bash
# 依存関係のインストール
bun install
```

### 開発サーバーの起動

```bash
bun run dev
```

開発サーバーは `http://localhost:4321` で起動します。

### ビルド

```bash
bun run build
```

ビルド成果物は `./dist/` ディレクトリに出力されます。

### プレビュー

```bash
bun run preview
```

ビルド後の静的サイトをローカルでプレビューできます。

## デプロイ

このプロジェクトは GitHub Pages にデプロイされています。`main` ブランチへのプッシュで自動的にビルド・デプロイが実行されます。

デプロイURL: https://yoshiomiyamae.github.io/kotonoha-tango-solver/

## プロジェクト構成

```
kotonoha-tango-solver/
├── src/
│   ├── pages/
│   │   └── index.astro          # エントリーポイント
│   ├── components/
│   │   └── Dictionary.tsx       # メインUIコンポーネント
│   ├── layouts/
│   │   └── Layout.astro         # ベースレイアウト
│   └── stores/
│       └── Dictionary.ts        # 状態管理とソルバーロジック
├── public/                      # 静的アセット
├── astro.config.mjs            # Astro設定
├── tsconfig.json               # TypeScript設定
└── package.json                # 依存関係
```

## データソース

辞書データは以下のリポジトリから取得しています:

https://raw.githubusercontent.com/plumchloride/tango/refs/heads/main/kotonoha-tango/public/data/Q_fil_ippan.csv

## ライセンス

このプロジェクトのライセンスについては、リポジトリのLICENSEファイルを参照してください。

## 貢献

プルリクエストや Issue の投稿を歓迎します。

## 作者

Yoshio Miyamae ([@yoshiomiyamae](https://github.com/yoshiomiyamae))
