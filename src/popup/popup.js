'use strict';

(() => {
  const {
    STORAGE_KEY_LIMIT,
    STORAGE_KEY_ELAPSED,
    STORAGE_KEY_ELAPSED_DATE,
    X_HOST_RE,
    TIP_URL,
    TIP_NOTE,
    todayKey,
    parseLimit,
    formatMmSs,
    applyI18n,
    showStatus: showStatusBase,
    buildShareIntentUrl,
  } = globalThis.XOFF;

  const REFRESH_MS = 1000;
  const STATUS_CLEAR_MS = 2500;
  const STATUS_ELEMENT_ID = 'x-scroll-limiter-status';
  const PORT_NAME_POPUP = 'xsl-popup';

  let refreshTimer = null;
  let activeTabPort = null;

  async function getStorageState() {
    const data = await chrome.storage.local.get([
      STORAGE_KEY_LIMIT,
      STORAGE_KEY_ELAPSED,
      STORAGE_KEY_ELAPSED_DATE,
    ]);
    const today = todayKey();
    const sameDay = data[STORAGE_KEY_ELAPSED_DATE] === today;
    return {
      limitMin: typeof data[STORAGE_KEY_LIMIT] === 'number' ? data[STORAGE_KEY_LIMIT] : null,
      // 日付が変わって content script による rollover がまだ走っていない瞬間に
      // popup が前日の累計を表示しないよう、popup 側でも 0 に丸めます。
      elapsedSec: sameDay && typeof data[STORAGE_KEY_ELAPSED] === 'number' ? data[STORAGE_KEY_ELAPSED] : 0,
    };
  }

  // 開いているアクティブタブが X / Twitter なら、content script に最新値を直接問い合わせます。
  // storage への flush は 5 秒間隔のため、live 表示にはこの問い合わせが必要です。
  async function getLiveState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url) return null;
      if (!X_HOST_RE.test(tab.url)) return null;
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'getState' });
      if (response && typeof response.elapsedSec === 'number') {
        return response;
      }
      return null;
    } catch (_err) {
      return null;
    }
  }

  function render({ elapsedSec, limitMin, isLive }) {
    const elapsedEl = document.getElementById('x-scroll-limiter-elapsed');
    const limitEl = document.getElementById('x-scroll-limiter-limit');
    const remainingEl = document.getElementById('x-scroll-limiter-remaining');
    const noLimitEl = document.getElementById('x-scroll-limiter-no-limit');
    const limitInput = document.getElementById('x-scroll-limiter-limit-input');
    const statsEl = document.getElementById('x-scroll-limiter-stats');

    if (typeof limitMin === 'number') {
      const cap = limitMin * 60;
      const cappedElapsed = Math.min(elapsedSec, cap);
      const remainingSec = Math.max(0, cap - cappedElapsed);
      const exceeded = remainingSec === 0;

      elapsedEl.textContent = formatMmSs(cappedElapsed);
      limitEl.textContent = formatMmSs(cap);
      remainingEl.textContent = formatMmSs(remainingSec);
      statsEl.classList.toggle('x-scroll-limiter__stat--exceeded', exceeded);

      noLimitEl.hidden = true;
      if (limitInput && document.activeElement !== limitInput && !limitInput.value) {
        limitInput.value = String(limitMin);
      }
    } else {
      elapsedEl.textContent = formatMmSs(elapsedSec);
      limitEl.textContent = '--';
      remainingEl.textContent = '--';
      statsEl.classList.remove('x-scroll-limiter__stat--exceeded');
      noLimitEl.hidden = false;
    }

    statsEl.dataset.live = isLive ? 'true' : 'false';
  }

  async function refresh() {
    const live = await getLiveState();
    if (live) {
      render({ elapsedSec: live.elapsedSec, limitMin: live.limitMin, isLive: true });
      return;
    }
    const fallback = await getStorageState();
    render({ ...fallback, isLive: false });
  }

  function showStatus(text, isError) {
    showStatusBase(STATUS_ELEMENT_ID, text, isError, STATUS_CLEAR_MS);
  }

  function setupForm() {
    const form = document.getElementById('x-scroll-limiter-limit-form');
    const input = document.getElementById('x-scroll-limiter-limit-input');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = parseLimit(input.value);
      if (value === null) {
        showStatus(chrome.i18n.getMessage('optionsValidationError'), true);
        return;
      }
      try {
        await chrome.storage.local.set({ [STORAGE_KEY_LIMIT]: value });
        showStatus(chrome.i18n.getMessage('popupSavedMessage'), false);
        await refresh();
      } catch (err) {
        console.warn('[xsl] save failed', err);
        showStatus(chrome.i18n.getMessage('optionsValidationError'), true);
      }
    });
  }

  function setupResetButton() {
    document.getElementById('x-scroll-limiter-reset-button').addEventListener('click', async () => {
      try {
        // 日次累計を 0 に戻し、日付キーを今日に揃えます。
        // 日付キーを残しておかないと content script 起動時に「日付一致 → 0 として読む」整合が崩れます。
        await chrome.storage.local.set({
          [STORAGE_KEY_ELAPSED]: 0,
          [STORAGE_KEY_ELAPSED_DATE]: todayKey(),
        });
        showStatus(chrome.i18n.getMessage('popupResetSuccess'), false);
        await refresh();
      } catch (err) {
        console.warn('[xsl] reset failed', err);
      }
    });
  }

  function setupSupportButton() {
    const wrap = document.getElementById('x-scroll-limiter-support');
    const btn = document.getElementById('x-scroll-limiter-support-button');
    const noteEl = document.querySelector('.x-scroll-limiter__support-note');
    // TIP_URL が未設定（OSS fork 直後など）はサポートブロック全体を非表示にします。
    if (!TIP_URL) {
      wrap.hidden = true;
      return;
    }
    // config.js の TIP_NOTE が指定されていれば i18n のデフォルトを上書き。
    // 未指定なら applyI18n が既に入れたメッセージがそのまま表示されます。
    if (noteEl && TIP_NOTE) {
      noteEl.textContent = TIP_NOTE;
    }
    btn.addEventListener('click', async () => {
      await chrome.tabs.create({ url: TIP_URL });
      window.close();
    });
  }

  function setupShareButton() {
    document.getElementById('x-scroll-limiter-share-button').addEventListener('click', async () => {
      const live = await getLiveState();
      const fallback = await getStorageState();
      const state = live || fallback;
      const intentUrl = buildShareIntentUrl(state);

      // アクティブタブが X / Twitter なら同タブを intent ページに遷移させ、新規タブを開きません。
      // それ以外（非 X タブから popup を開いた稀ケース）では新規タブで開きます。
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && tab.url && X_HOST_RE.test(tab.url)) {
        await chrome.tabs.update(tab.id, { url: intentUrl });
      } else {
        await chrome.tabs.create({ url: intentUrl });
      }
      window.close();
    });
  }

  function setupAutoRefresh() {
    refreshTimer = setInterval(refresh, REFRESH_MS);
    window.addEventListener('beforeunload', () => {
      if (refreshTimer) clearInterval(refreshTimer);
      if (activeTabPort) {
        try { activeTabPort.disconnect(); } catch (_e) { /* noop */ }
      }
    });
  }

  // popup を開いている間、アクティブな X タブの content script に長期ポートを張ります。
  // content 側はポート接続中だけ hasFocus 要件を緩和して計測を継続するため、
  // popup 側に表示される経過/残りがリアルタイムで動き続けます。
  async function connectToActiveXTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url || !X_HOST_RE.test(tab.url)) return;
      activeTabPort = chrome.tabs.connect(tab.id, { name: PORT_NAME_POPUP });
      activeTabPort.onDisconnect.addListener(() => {
        // 拡張機能リロード直後でまだ X タブを再読込していない等で content script が未注入の場合、
        // connect は即時 disconnect され chrome.runtime.lastError が立ちます。
        // ここで読み出しておかないと "Unchecked runtime.lastError" が console に出ます。
        // popup はこのケースでも storage fallback で動くため、エラーは静かに消化します。
        void chrome.runtime.lastError;
        activeTabPort = null;
      });
    } catch (err) {
      console.warn('[xsl] popup port connect failed', err);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    applyI18n(document);
    setupForm();
    setupResetButton();
    setupShareButton();
    setupSupportButton();
    setupAutoRefresh();
    connectToActiveXTab();
    await refresh();
  });
})();
