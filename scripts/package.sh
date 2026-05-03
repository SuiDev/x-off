#!/usr/bin/env bash
set -euo pipefail

# src/ ディレクトリを Chrome Web Store 提出用 zip にパッケージするスクリプトです。
# Docker コンテナ経由での実行を前提としており、jq と zip が必要です。

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/src"
DIST_DIR="${ROOT_DIR}/dist"
MANIFEST="${SRC_DIR}/manifest.json"

if [[ ! -f "${MANIFEST}" ]]; then
  echo "[package] manifest.json が見つかりません: ${MANIFEST}" >&2
  exit 1
fi

if [[ ! -f "${SRC_DIR}/config.js" ]]; then
  echo "[package] src/config.js が見つかりません。fork 直後なら以下を実行してください:" >&2
  echo "[package]   cp src/config.example.js src/config.js" >&2
  echo "[package]   # その後 src/config.js を編集して BMC_URL / INSTALL_URL を設定" >&2
  exit 1
fi

VERSION="$(jq -r '.version' "${MANIFEST}")"
if [[ -z "${VERSION}" || "${VERSION}" == "null" ]]; then
  echo "[package] manifest.json に version がありません" >&2
  exit 1
fi

mkdir -p "${DIST_DIR}"
ZIP_PATH="${DIST_DIR}/x-off-v${VERSION}.zip"
rm -f "${ZIP_PATH}"

cd "${SRC_DIR}"
zip -r -X "${ZIP_PATH}" . \
  --exclude '*.DS_Store' \
  --exclude '*/.gitkeep' \
  --exclude 'config.example.js'

echo "[package] generated: ${ZIP_PATH}"
