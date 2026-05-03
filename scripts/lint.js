#!/usr/bin/env node
'use strict';

// Chrome MV3 拡張機能向けの軽量 lint スクリプトです。
// web-ext lint は Firefox 互換要件（gecko.id, background.scripts 等）まで強制してしまうため、
// Chrome 公開のみを目的とする本プロジェクトでは自前のチェックを採用します。
//
// 検査項目:
//   1. manifest.json が有効な JSON で manifest_version === 3
//   2. manifest が参照するファイル（icons / content_scripts / background / popup / options）が実在する
//   3. manifest 内の `__MSG_*__` プレースホルダーが default_locale の messages.json に存在する
//   4. すべての _locales/* で同じメッセージキー集合を持つ
//   5. 各 messages.json の各エントリが `message` を持つ
//   6. src/*.js に禁止パターン（console.log / eval / new Function）が含まれていない

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const errors = [];
const warns = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warns.push(msg); }

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(`failed to parse JSON: ${file} (${e.message})`);
    return null;
  }
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function checkManifest() {
  const manifestPath = path.join(SRC, 'manifest.json');
  if (!exists(manifestPath)) {
    err('manifest.json not found');
    return null;
  }
  const m = readJson(manifestPath);
  if (!m) return null;

  if (m.manifest_version !== 3) err(`manifest_version must be 3 (got ${m.manifest_version})`);
  if (!m.name) err('manifest.name is required');
  if (!m.version) err('manifest.version is required');
  if (!m.default_locale) err('manifest.default_locale is required when using __MSG_*__');

  const fileFields = [];
  if (m.background && m.background.service_worker) fileFields.push(m.background.service_worker);
  if (m.action && m.action.default_popup) fileFields.push(m.action.default_popup);
  if (m.options_ui && m.options_ui.page) fileFields.push(m.options_ui.page);
  if (m.options_page) fileFields.push(m.options_page);
  if (Array.isArray(m.content_scripts)) {
    m.content_scripts.forEach((cs, i) => {
      (cs.js || []).forEach((p) => fileFields.push(p));
      (cs.css || []).forEach((p) => fileFields.push(p));
      if (!Array.isArray(cs.matches) || cs.matches.length === 0) {
        err(`content_scripts[${i}].matches is empty`);
      }
    });
  }
  if (m.icons) Object.values(m.icons).forEach((p) => fileFields.push(p));
  if (m.action && m.action.default_icon) Object.values(m.action.default_icon).forEach((p) => fileFields.push(p));

  fileFields.forEach((p) => {
    const abs = path.join(SRC, p);
    if (!exists(abs)) err(`manifest references missing file: ${p}`);
  });

  return m;
}

function collectMessagePlaceholders(manifestText) {
  const re = /__MSG_([A-Za-z0-9_]+)__/g;
  const set = new Set();
  let match;
  while ((match = re.exec(manifestText)) !== null) {
    set.add(match[1]);
  }
  return set;
}

function checkLocales(manifest) {
  if (!manifest || !manifest.default_locale) return;
  const localesDir = path.join(SRC, '_locales');
  if (!exists(localesDir)) {
    err('_locales/ directory missing');
    return;
  }

  const locales = fs.readdirSync(localesDir).filter((d) => exists(path.join(localesDir, d, 'messages.json')));
  if (locales.length === 0) {
    err('no locales with messages.json found under _locales/');
    return;
  }
  if (!locales.includes(manifest.default_locale)) {
    err(`default_locale "${manifest.default_locale}" has no _locales/${manifest.default_locale}/messages.json`);
  }

  const localeMessages = {};
  locales.forEach((loc) => {
    const file = path.join(localesDir, loc, 'messages.json');
    const data = readJson(file);
    if (!data) return;
    Object.entries(data).forEach(([key, value]) => {
      if (!value || typeof value.message !== 'string') {
        err(`_locales/${loc}/messages.json: "${key}" missing "message" field`);
      }
    });
    localeMessages[loc] = new Set(Object.keys(data || {}));
  });

  const refLocale = manifest.default_locale;
  const refKeys = localeMessages[refLocale];
  if (refKeys) {
    Object.entries(localeMessages).forEach(([loc, keys]) => {
      if (loc === refLocale) return;
      const missing = [...refKeys].filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !refKeys.has(k));
      missing.forEach((k) => err(`_locales/${loc}/messages.json: missing key "${k}" (present in ${refLocale})`));
      extra.forEach((k) => warn(`_locales/${loc}/messages.json: extra key "${k}" (not in ${refLocale})`));
    });
  }

  const manifestText = fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8');
  const placeholders = collectMessagePlaceholders(manifestText);
  placeholders.forEach((key) => {
    if (refKeys && !refKeys.has(key)) {
      err(`manifest uses __MSG_${key}__ but key "${key}" is missing in _locales/${refLocale}/messages.json`);
    }
  });
}

function checkPermissions(manifest) {
  if (!manifest) return;
  if (Array.isArray(manifest.permissions)) {
    const tabsPresent = manifest.permissions.includes('tabs');
    if (tabsPresent) {
      warn('permissions includes "tabs". host_permissions for X/Twitter are sufficient — consider removing.');
    }
  }
}

function listJsFiles(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listJsFiles(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
}

function checkI18nUsage(manifest) {
  if (!manifest || !manifest.default_locale) return;
  const refLocale = manifest.default_locale;
  const refFile = path.join(SRC, '_locales', refLocale, 'messages.json');
  if (!exists(refFile)) return;
  const refData = readJson(refFile);
  if (!refData) return;
  const refKeys = new Set(Object.keys(refData));

  // src 配下の JS / HTML / manifest から実際に参照されているキーを抽出します。
  const used = new Set();
  const scanFiles = [];
  listJsFiles(SRC, scanFiles);
  function listFilesByExt(dir, ext, acc) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) listFilesByExt(full, ext, acc);
      else if (entry.isFile() && entry.name.endsWith(ext)) acc.push(full);
    }
    return acc;
  }
  listFilesByExt(SRC, '.html', scanFiles);
  scanFiles.push(path.join(SRC, 'manifest.json'));

  const patterns = [
    // chrome.i18n.getMessage("key") / chrome.i18n?.getMessage?.("key") の両形を許容
    /getMessage(?:\?\.)?\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g,
    /safeI18n\(\s*['"]([A-Za-z0-9_]+)['"]/g,
    /data-i18n=['"]([A-Za-z0-9_]+)['"]/g,
    /__MSG_([A-Za-z0-9_]+)__/g,
  ];
  for (const file of scanFiles) {
    if (!exists(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text)) !== null) used.add(m[1]);
    }
  }

  for (const key of used) {
    if (!refKeys.has(key)) {
      err(`i18n key "${key}" is referenced but missing in _locales/${refLocale}/messages.json`);
    }
  }
  for (const key of refKeys) {
    if (!used.has(key)) {
      warn(`i18n key "${key}" is defined in _locales/${refLocale}/ but not referenced anywhere`);
    }
  }
}

function checkForbiddenPatterns() {
  // src 配下の JS ファイルを走査し、本番に残してはいけないパターンを検出します。
  // 詳細は AGENTS.md §6 参照。
  const forbiddenRules = [
    { name: 'console.log', re: /\bconsole\s*\.\s*log\s*\(/g, level: 'error' },
    { name: 'eval(', re: /\beval\s*\(/g, level: 'error' },
    { name: 'new Function(', re: /\bnew\s+Function\s*\(/g, level: 'error' },
  ];

  const files = listJsFiles(SRC, []);
  files.forEach((file) => {
    const text = fs.readFileSync(file, 'utf8');
    forbiddenRules.forEach((rule) => {
      const matches = text.match(rule.re);
      if (matches && matches.length > 0) {
        const rel = path.relative(SRC, file);
        const msg = `${rel}: forbidden pattern "${rule.name}" (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`;
        if (rule.level === 'error') err(msg); else warn(msg);
      }
    });
  });
}

function main() {
  const manifest = checkManifest();
  checkLocales(manifest);
  checkPermissions(manifest);
  checkI18nUsage(manifest);
  checkForbiddenPatterns();

  if (warns.length > 0) {
    console.warn('\n[lint] warnings:');
    warns.forEach((w) => console.warn('  -', w));
  }
  if (errors.length > 0) {
    console.error('\n[lint] errors:');
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log(`\n[lint] OK (warnings: ${warns.length}, errors: 0)`);
}

main();
