# Changelog

本プロジェクトの変更履歴は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) の形式に準じます。バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) を採用します。

## [Unreleased]

（次回リリース向けの変更をここに追記してください）

## [1.0.0] - 2026-05-02

Chrome Web Store への初回提出バージョンです。

### 機能

- X (旧 Twitter) のアクティブ閲覧時間（分）の計測。`visibilityState === 'visible' && hasFocus()` の AND 判定で、バックグラウンドタブや非フォーカス時はカウントしない
- 1 日の累計（ローカルタイムゾーンの 0:00 起算）で経過時間を記録し、日付が変わると自動でリセットするソフトリミット型
- 上限到達時のフルスクリーンオーバーレイ表示とスクロール（wheel / touchmove / keydown）の物理ロック
- ツールバーポップアップ: 経過 / 上限 / 残り時間の表示、上限再設定、手動リセット、X 利用シェア、開発者応援リンク
- 日本語 / 英語の UI（`chrome.i18n` ベース）、ストア掲載文・プライバシーポリシーも両言語で整備

### 構成

- Manifest V3。permissions は `storage` のみ、host_permissions は `https://x.com/*` / `https://twitter.com/*` のみ
- 外部送信ゼロ。すべてのデータは `chrome.storage.local` 内で完結
- 環境固有の値（応援先 URL、CWS アイテム URL）は `src/config.js` に分離し `.gitignore` で公開リポジトリから除外。テンプレートとして `src/config.example.js` を同梱

### 開発ハーネス

- mise（タスクランナー）+ Docker（Node 24）でビルド・Lint・パッケージを完全に隔離
- `scripts/lint.js`: 自前の MV3 専用 lint（manifest 整合、i18n キー一貫性、`console.log` / `eval` / `new Function` 検出）
- `scripts/generate-icons.js`: Pure Node の PNG エンコーダ（外部依存なし）
- `scripts/package.sh`: Chrome Web Store 提出用 zip 生成

### Chrome Web Store 提出物

- ストア掲載文（`store-assets/store-description.md`、日英）
- スクリーンショット 10 枚（1280×800 PNG、日英各 5 枚）
- 小タイル画像（440×280 PNG）
- プライバシーポリシー（`docs/PRIVACY.md`、日英）

### ガバナンス

- MIT License
- `AGENTS.md` / `CLAUDE.md` / `README.md` / `docs/{ARCHITECTURE,DEVELOPMENT,TESTING,PUBLISHING,PRIVACY}.md`

[Unreleased]: https://github.com/SuiDev/x-off/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/SuiDev/x-off/releases/tag/v1.0.0
