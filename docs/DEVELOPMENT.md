# 開発手順

本ドキュメントは X OFF の開発に必要な手順をまとめたものです。

## 前提環境

| 項目          | 要件                                                |
| ------------- | --------------------------------------------------- |
| OS            | macOS / Linux / Windows (WSL2 推奨)                 |
| Docker        | Docker Desktop（または Docker Engine + Compose v2） |
| Google Chrome | 最新安定版（最低でも 130 以上）                     |

ホスト OS に Node.js を直接インストールする必要はありません。すべてのビルドおよび Lint は Docker コンテナ内で実行します。

## 初回セットアップ

```bash
git clone <REPOSITORY_URL>
cd x-off

# ローカル設定ファイルを作成（gitignore 対象、各開発者が自分用に持つ）
cp src/config.example.js src/config.js
# 必要なら src/config.js を編集して BMC_URL / INSTALL_URL を設定

# Docker イメージビルド（初回のみ）
docker compose build
```

`src/config.js` は環境固有の URL（Buy Me a Coffee の支援先、Chrome Web Store の自分のアイテム URL）を保持します。`.gitignore` で公開リポジトリから除外されています。値を空文字のままにすると、対応する UI（応援リンクなど）は自動的に非表示になります。

Docker イメージは `debian:trixie-slim` をベースに [mise](https://mise.jdx.dev/) を installed-on-build で同梱し、`mise.toml` で宣言された Node 24 がコンテナ内で利用できる構成です。`zip`, `jq`, `bash`, `curl`, `git` も `apt-get` で同梱しています。詳細は `Dockerfile` を参照してください。

## 開発ループ

1. ソースコードを編集します（主に `src/` 配下）
2. Chrome で `chrome://extensions` を開きます
3. 「デベロッパーモード」をオンにし、「パッケージ化されていない拡張機能を読み込む」で `src/` を選択します（初回のみ）
4. 以降は変更後に当該拡張のカード右下の「更新」ボタン（円形矢印）を押すと反映されます
5. content script 側の変更は X のタブをリロードして反映させます
6. service worker の変更は `chrome://extensions` の「Service Worker (inspect)」リンクを再起動するか、拡張をリロードします

## Lint

```bash
docker compose run --rm dev mise run lint
```

`scripts/lint.js` が `src/` 配下を Chrome MV3 向けに検査します。具体的には以下を確認します。

- `manifest.json` が有効な JSON で `manifest_version === 3` であること
- `manifest` から参照されるファイル（icons / content_scripts / background.service_worker / popup / options）が実在すること
- `manifest` 内の `__MSG_xxx__` プレースホルダーが `default_locale` の `messages.json` に存在すること
- すべての `_locales/*` ロケールが同じメッセージキー集合を持ち、各エントリに `message` フィールドがあること
- `permissions` に過剰なものがないこと（例: `tabs` がある場合は警告）

CI 連携時には本コマンドを必須化します。

## パッケージング

Chrome Web Store 提出用の zip を生成します。

```bash
docker compose run --rm dev mise run package
```

`dist/x-off-vX.Y.Z.zip` が生成されます。zip のルートに `manifest.json` が来ることを確認してください（ストア提出時の必須要件です）。

## バージョンアップ手順

リリース時は以下のファイルを同じバージョン番号で同期します。

| ファイル            | 更新箇所                             |
| ------------------- | ------------------------------------ |
| `src/manifest.json` | `"version"` フィールド               |
| `CHANGELOG.md`      | 新セクションを追加し、変更内容を記載 |

その後 `git tag vX.Y.Z` を打ってからパッケージしてください。タグの命名規則は `vMAJOR.MINOR.PATCH` です。

## デバッグ Tips

### service worker のログを見る

`chrome://extensions` の本拡張のカードに表示される「Service Worker」リンク（または `Inspect views: service worker`）をクリックすると、専用の DevTools が開きます。`background.js` のログはここで確認します。

### content script のログを見る

X のタブを開いた状態で DevTools (Cmd+Opt+I) を開き、Console タブで確認します。ログは `[xsl]` プレフィックスを付ける運用にしてください（grep しやすくするため）。

### storage の中身を見る

DevTools の `Application` タブ → `Storage` → `Extension Storage` で、当該拡張の local ストレージを直接観察できます（`limitMin` / `elapsedSec` / `elapsedDate`）。テスト時に経過秒数を強制的に書き換えたい場合もここから可能です。日付ロールオーバーの確認では `elapsedDate` を昨日の日付に書き換えるとそのまま深夜 0:00 跨ぎを再現できます。

### 上限到達状態を素早く再現する

上限を 1 分に設定し、X を開いて 60 秒待つだけです。アクティブ判定の関係でタブをフォアグラウンドかつフォーカスした状態を維持してください。

## トラブルシュート

| 症状                                   | 対処                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 拡張をリロードしても変更が反映されない | Chrome をフルリスタート、または拡張を一旦削除して再読み込み                                                       |
| `mise install` が失敗する              | Docker イメージを再ビルド (`docker compose build --no-cache`)。ネットワーク制限の場合は mise.run の到達可否を確認 |
| zip 内に `__MACOSX/` が混入する        | macOS 標準の zip を使うとこれが入る。本リポジトリのスクリプトは `zip -X` を使用しているため発生しないはず         |
| Service Worker が頻繁に停止する        | Manifest V3 の仕様。`chrome.alarms` で定期復帰させる必要があるかは設計判断                                        |
