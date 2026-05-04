# AGENTS.md

本ファイルは、Claude Code / Cursor / Codex などの AI エージェントが本リポジトリで作業する際に従うべきルールを定めたものです。人間の貢献者にも有用ですが、優先読者は AI エージェントです。

作業を始める前に、必ず最後まで一読してください。

## 1. プロジェクト概要

X OFF は、X で過ごす時間を有限にするための Manifest V3 Chrome 拡張機能です。Chrome Web Store での公開を前提としており、開発／テスト／公開の各フェーズが文書化されています。

主要な仕様は次の通りです。

- アクティブ滞在時間（分）でカウントし、ユーザーが指定した上限に達するとフルスクリーンオーバーレイで利用を止めます
- 経過時間は 1 日の累計（ローカルタイムゾーンの 0:00 起算）で記録され、日付が変わると自動でリセットされます
- データは外部送信せず、すべて `chrome.storage.local` 内で完結します

## 2. 必読ドキュメント

新規に作業を始めるエージェントは、以下の順で読んでから着手してください。

1. `README.md` — プロジェクト全体像
2. `docs/ARCHITECTURE.md` — 内部設計とデータフロー
3. `docs/DEVELOPMENT.md` — 開発手順
4. `docs/TESTING.md` — 動作確認手順
5. `docs/PUBLISHING.md` — 公開作業の手順（公開作業をする時のみ）

## 3. ディレクトリの責務

| パス                    | 役割                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `src/`                  | Chrome 拡張機能の本体コード。zip 化して提出する範囲はここだけです                               |
| `src/manifest.json`     | Manifest V3 定義                                                                                |
| `src/config.js`         | 環境固有の設定（BMC URL 等）。`.gitignore` 対象。`config.example.js` を雛形にコピーして使います |
| `src/config.example.js` | `config.js` のテンプレート。リポジトリにコミットされます                                        |
| `src/background.js`     | service worker。タブ監視とセッションリセットを担当                                              |
| `src/content.js`        | X ページに注入されるコンテンツスクリプト。滞在時間計測の主役                                    |
| `src/popup/`            | ツールバーアイコン押下時の UI                                                                   |
| `src/options/`          | インストール直後とメニューから開かれる設定ページ                                                |
| `src/_locales/`         | 多言語メッセージ。`en` がデフォルト、`ja` を併載                                                |
| `src/icons/`            | 拡張機能アイコン (16/32/48/128)                                                                 |
| `docs/`                 | 開発／テスト／公開／プライバシー／設計のドキュメント群                                          |
| `scripts/`              | ビルド／パッケージ用シェルスクリプト                                                            |
| `store-assets/`         | Chrome Web Store 提出用素材。配布物には含めません                                               |
| `dist/`                 | パッケージスクリプトの出力。コミットしません                                                    |

## 4. 触ってよい / 触ってはいけないファイル

エージェントが自由に編集してよいファイル:

- `src/` 配下のすべて
- `docs/` 配下のすべて
- `scripts/`, `mise.toml`, `Dockerfile`, `docker-compose.yaml`
- `README.md`, `CHANGELOG.md`, `AGENTS.md`

エージェントが触ってはいけないファイル:

- `LICENSE` （著作権者・年の扱いは人間が判断します）
- `.git/` 配下
- `store-assets/screenshots/`, `store-assets/promo-tile-{jp,en}.png` など画像バイナリ（撮影・差し替えは人間が行います）
- `*.pem` 形式の鍵（生成・配置とも人間のみ）

## 5. ビルド・Lint・パッケージ

タスクランナーは [mise](https://mise.jdx.dev/) を使います。`mise.toml` でツール（Node 24）とタスクを宣言しています。npm は使いません。ローカルへの Node や mise の直接インストールは行わず、必ず Docker 経由で実行してください。

```bash
# 初回のみ
docker compose build

# Lint （Chrome MV3 向け自前チェック: manifest, ファイル参照, i18n キー整合）
docker compose run --rm dev mise run lint

# アイコン再生成（src/icons/*.png）
docker compose run --rm dev mise run icons

# 配布用 zip の生成 (dist/x-off-vX.Y.Z.zip)
docker compose run --rm dev mise run package

# クリーン
docker compose run --rm dev mise run clean

# リリース前ルーチンを 1 コマンドで実行
docker compose run --rm dev mise run release
```

タスク一覧は `mise tasks` で確認できます。タスク定義は `mise.toml` を参照してください。

Docker のビルドが失敗した場合、Dockerfile の base image とパッケージマネージャ (`apt-get`) のキャッシュ、`mise install` のネットワーク到達性を確認してください。

## 6. コーディング規約

- バニラ JavaScript で書く。フレームワークやバンドラは使わない。
- ES Modules はコンテンツスクリプト以外でも使用しない。Chrome 拡張のスクリプト読み込みでは IIFE スタイルを基本とする。
- `eval()`, `new Function()`, リモートコードのロード（外部 `<script src>` 等）は禁止。Manifest V3 の CSP 違反になる。
- DOM 操作は `document.createElement` ベース。`innerHTML` で外部入力を扱わない（XSS 防止）。
- CSS クラス名と DOM `id` は `x-scroll-limiter-` プレフィックスで衝突を防ぐ。具体例:
  - DOM id: `x-scroll-limiter-overlay`, `x-scroll-limiter-overlay-message`
  - CSS class: `x-scroll-limiter__title`, `x-scroll-limiter__elapsed` (BEM 風)
  - chrome.storage キー: `limitMin`, `elapsedSec` （プレフィックスは不要、storage は拡張ごとに分離されるため）
- chrome.i18n は次の形で参照: `chrome.i18n.getMessage('extName')`。キー名は camelCase。プレースホルダーは `{name}` 構文。
- ログは `console.debug` / `console.warn` を使い、本番は最小限。`console.log` は使わない。
- ログ出力は `[xsl]` プレフィックスを付ける。例: `console.debug('[xsl] elapsed=%d', elapsedSec)` （grep しやすくするため）。
- 日本語コメントで意図 (Why) を書く。What はコードで表現する。
- chrome API の呼び出しは Promise ベース（`callback` 引数を使わない）。Manifest V3 の最新仕様に準拠。

## 7. テスト

自動テストはありません（v0.1 スコープ外）。代わりに `docs/TESTING.md` のチェックリストを毎リリース前に必ず通します。チェックリストの項目を増減させる場合は、PR と同じコミットでチェックリストを更新してください。

## 8. 権限境界

| 操作                                            | AI エージェントの可否              |
| ----------------------------------------------- | ---------------------------------- |
| `src/manifest.json` の `version` インクリメント | 可                                 |
| `mise.toml` のタスク追加・編集                  | 可                                 |
| `CHANGELOG.md` の追記                           | 可                                 |
| `mise run package` での zip 生成                | 可                                 |
| Chrome Web Store への提出                       | 不可（人間のみ）                   |
| `LICENSE` の編集                                | 不可                               |
| GitHub への push                                | 不可（人間が確認後に push）        |
| `store-assets/` 配下の画像差し替え              | 不可（人間のみ）                   |
| プライバシーポリシーの実質的な変更              | 不可（法的影響あり、人間の判断要） |

## 9. コミットメッセージ規約

Conventional Commits を採用します。

```
<type>(<scope>): <subject>

[optional body]
```

主な type:

- `feat`: 機能追加
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `chore`: ビルド／補助ツール／依存更新
- `refactor`: 動作変更を伴わないリファクタ
- `test`: テスト関連
- `release`: バージョンアップ専用

例: `feat(content): block scroll once daily limit is reached`

## 9.1 ブランチ命名規則

- `feat/<short-description>` — 機能追加
- `fix/<short-description>` — バグ修正
- `docs/<short-description>` — ドキュメントのみ
- `chore/<short-description>` — 補助ツール／依存更新
- `release/v<major>.<minor>.<patch>` — リリース準備ブランチ
- 説明部は kebab-case 英語のみ（例: `feat/scroll-overlay`）。日本語禁止
- 1 ブランチ 1 目的を厳守。複数の type が混ざる変更は分割

## 10. 進行状況の記録

長時間にわたる実装やセッションをまたぐ作業の状態は、`CHANGELOG.md` の `[Unreleased]` セクションに記録します。エージェントは作業の途中であってもここに「Added / Changed / Fixed / In Progress」の見出しで進捗を追記してよいです（リリース時に整理されます）。

セッション再開時の最初のアクションは次の順で実施してください。

1. `CHANGELOG.md` の `[Unreleased]` を読む
2. `git status` で未コミットの変更を確認
3. `git log --oneline -20` で直近のコミットを確認
4. 着手する前に「これから何をやるか」を一文で宣言してから作業に入る

`PROGRESS.md` のような専用ファイルは作成しないでください（CHANGELOG に集約）。

## 11. リリース前ルーチン

リリース（`src/manifest.json` の `version` を上げる時）の前に、以下を必ず実施します。

```bash
# clean → lint → package を 1 コマンドで実行
docker compose run --rm dev mise run release

# zip 内容の検証 — manifest.json がルートにあることを確認
unzip -l dist/x-off-v*.zip | head -20

# (任意) ロード確認
# chrome://extensions で dist/*.zip を解凍したフォルダを「読み込み」
```

このルーチンを通さずに `version` を上げてはいけません。`mise run release` は内部で `clean → lint → package` を順に実行します（`mise.toml` の `depends` 定義参照）。

## 12. 実装フェーズのタスク順序

`src/` 配下のコード実装を進める際は、以下の順で着手してください。各ステップは 1 コミット単位を目安にします。

1. `src/manifest.json` — manifest だけまず通す（content_scripts なし、permissions のみ）
2. `src/_locales/{en,ja}/messages.json` — i18n キーを定義
3. `src/icons/` — プレースホルダー単色 PNG を 4 サイズ（後で差し替え可能な仮素材）
4. `src/options/` — 上限分数の入力 UI （storage.local 書き込みまで）
5. `src/background.js` — onInstalled で options を開く / tab close 監視
6. `src/content.js` — 計測ロジックと storage 読み書き（オーバーレイなし）
7. `src/overlay.css` + content.js のオーバーレイ注入 — 上限到達時の表示
8. `src/popup/` — 経過時間表示と上限再設定 UI
9. manifest に content_scripts 等を統合し、結合テスト

依存関係:

- 1〜3 は他の実装の前提。これらが揃わないと `mise run lint` がエラーになる
- 4 と 5 は独立だが、5 の onInstalled テストには 4 の options ページが必要
- 6 と 7 は別コミットに分けることで「計測のみ動作している」状態をテストできる

## 13. 困ったとき

不明点がある場合、勝手に判断せず、ユーザー（人間）に質問してください。特に以下のケースは即座にエスカレーションしてください。

- 仕様が明確でなく複数の解釈が成り立つとき
- Manifest V3 の制約に抵触しそうな実装になりそうなとき
- Chrome Web Store のポリシーに関わる変更（permissions の追加、データ収集の有無の変更）
- 外部ドメインへの通信を増やすとき（原則禁止です）
