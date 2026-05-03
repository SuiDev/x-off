'use strict';

// X OFF の各コンテキスト（service worker / content script / popup / options）から
// 共通参照される定数とヘルパーを集約します。グローバル名前空間 globalThis.XOFF に
// 集約し、外部モジュールバンドラに依存せず MV3 のすべての実行コンテキストで使えます。
//
// 読み込み順:
//   - background.js: 最上位で importScripts('shared.js')
//   - content scripts: manifest.json の js 配列で ["shared.js", "content.js"] の順
//   - popup.html / options.html: <script src="../shared.js"> を本体スクリプトより前

(() => {
  if (globalThis.XOFF) return;

  const STORAGE_KEY_LIMIT = 'limitMin';
  const STORAGE_KEY_ELAPSED = 'elapsedSec';
  // ローカル日付 (YYYY-MM-DD) を一緒に保存し、日付が変わると elapsedSec を 0 に戻して
  // 「1 日累計」リセットを実現します。session storage ではなく local storage に保存します。
  const STORAGE_KEY_ELAPSED_DATE = 'elapsedDate';
  const LIMIT_MIN = 1;
  const LIMIT_MAX = 600;
  const X_HOST_RE = /^https:\/\/(x\.com|twitter\.com)/;
  const X_URL_PATTERNS = ['https://x.com/*', 'https://twitter.com/*'];
  const ATTR_I18N = 'data-i18n';

  // 環境固有の値は `src/config.js`（gitignore 済み）から globalThis.XOFF_CONFIG 経由で受け取ります。
  // テンプレートは `src/config.example.js` を参照してください。
  const cfg = (globalThis.XOFF_CONFIG && typeof globalThis.XOFF_CONFIG === 'object')
    ? globalThis.XOFF_CONFIG
    : {};
  const INSTALL_URL = typeof cfg.INSTALL_URL === 'string' ? cfg.INSTALL_URL : '';
  const TIP_URL = typeof cfg.TIP_URL === 'string' ? cfg.TIP_URL : '';
  const TIP_NOTE = typeof cfg.TIP_NOTE === 'string' ? cfg.TIP_NOTE : '';

  // ローカルタイムゾーン基準の YYYY-MM-DD キー。toISOString は UTC に丸めるため使えません。
  function todayKey(now) {
    const d = now instanceof Date ? now : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseLimit(raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return null;
    if (n < LIMIT_MIN || n > LIMIT_MAX) return null;
    return n;
  }

  function formatMmSs(totalSec) {
    const safe = Math.max(0, Math.floor(totalSec));
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }

  // popup / options 向け。content script 用の context-invalidation 耐性版は
  // content.js 側に safeI18n として別実装があります（shutdown 連動の都合で分離）。
  function applyI18n(root) {
    root.querySelectorAll(`[${ATTR_I18N}]`).forEach((el) => {
      const key = el.getAttribute(ATTR_I18N);
      const msg = chrome.i18n.getMessage(key);
      if (!msg) return;
      if (el.tagName === 'TITLE') {
        document.title = msg;
      } else {
        el.textContent = msg;
      }
    });
    document.documentElement.lang = chrome.i18n.getUILanguage() || 'en';
  }

  // popup / options 共通のステータス表示。要素 id を引数で指定して呼び分けます。
  function showStatus(elementId, text, isError, clearMs) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('x-scroll-limiter__status--error', Boolean(isError));
    setTimeout(() => {
      el.textContent = '';
      el.classList.remove('x-scroll-limiter__status--error');
    }, typeof clearMs === 'number' ? clearMs : 2500);
  }

  // X の post intent URL を組み立てます。経過/上限が与えられればテンプレ文、
  // 与えられなければ汎用紹介文を埋め込みます。
  function buildShareIntentUrl(state) {
    const hasLimit = state && typeof state.limitMin === 'number';
    let text;
    if (hasLimit) {
      const cappedSec = Math.min(state.elapsedSec || 0, state.limitMin * 60);
      const minutes = Math.floor(cappedSec / 60);
      text = chrome.i18n.getMessage('shareTextWithLimit', [
        String(minutes),
        String(state.limitMin),
        INSTALL_URL,
      ]);
    } else {
      text = chrome.i18n.getMessage('shareTextNoLimit', [INSTALL_URL]);
    }
    const url = new URL('https://x.com/intent/post');
    url.searchParams.set('text', text);
    return url.toString();
  }

  globalThis.XOFF = {
    STORAGE_KEY_LIMIT,
    STORAGE_KEY_ELAPSED,
    STORAGE_KEY_ELAPSED_DATE,
    LIMIT_MIN,
    LIMIT_MAX,
    X_HOST_RE,
    X_URL_PATTERNS,
    ATTR_I18N,
    INSTALL_URL,
    TIP_URL,
    TIP_NOTE,
    todayKey,
    parseLimit,
    formatMmSs,
    applyI18n,
    showStatus,
    buildShareIntentUrl,
  };
})();
