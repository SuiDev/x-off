# CLAUDE.md

本ファイルは Claude Code（および互換 AI エージェント）が本プロジェクトで作業する際の最初の入り口です。詳細な作業ルールは [AGENTS.md](AGENTS.md) に集約しているため、まずそちらを読んでください。

## このプロジェクトを 30 秒で

- X の閲覧時間に上限を設ける Manifest V3 Chrome 拡張機能
- Chrome Web Store での公開を前提に、ドキュメント・Docker ハーネス・公開素材まで含めて整備済み
- 詳細は [README.md](README.md) と [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 必読ドキュメント順

1. [AGENTS.md](AGENTS.md) — 触っていいファイル、規約、ブランチ・コミット・リリース手順
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — コンポーネント構成とデータフロー
3. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — Docker 経由のビルド／Lint／パッケージ
4. [docs/TESTING.md](docs/TESTING.md) — リリース前手動チェックリスト
5. [docs/PUBLISHING.md](docs/PUBLISHING.md) — Chrome Web Store 公開作業時のみ

## このプロジェクトでの絶対ルール

- ローカルへの Node / mise の直接インストールは禁止。すべて Docker 経由で実行する
- タスクランナーは [mise](https://mise.jdx.dev/)。npm は使わない
- ビルド: `docker compose run --rm dev mise run lint` / `... mise run package` / `... mise run release`
- 実装コードは `src/` 配下のみ。ドキュメントは `docs/` のみ。`store-assets/` の画像は人間が差し替える
- 破壊的操作の境界は AGENTS.md §8 に従う（特に Chrome Web Store 提出は人間のみ）

## 進行中の作業状態

進行状況は `CHANGELOG.md` の `[Unreleased]` セクションに記録します。途中で作業が中断した場合、再開時は最初に CHANGELOG の Unreleased を確認してください。
