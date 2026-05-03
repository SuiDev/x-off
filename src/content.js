'use strict';

(() => {
  const {
    STORAGE_KEY_ELAPSED,
    STORAGE_KEY_ELAPSED_DATE,
    STORAGE_KEY_LIMIT,
    todayKey,
  } = globalThis.XOFF;

  const DEBUG = false;
  const debug = DEBUG ? console.debug.bind(console) : () => {};

  const TICK_MS = 1000;
  const FLUSH_INTERVAL_TICKS = 5;
  const OVERLAY_ID = 'x-scroll-limiter-overlay';
  const PORT_NAME_POPUP = 'xsl-popup';
  const BLOCKED_KEYS = new Set([
    ' ', 'PageDown', 'PageUp', 'End', 'Home',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ]);

  let elapsedSec = 0;
  let elapsedDate = todayKey();
  let limitMin = null;
  let unflushedTicks = 0;
  let isOverlayInstalled = false;
  let savedHtmlOverflow = '';
  let savedBodyOverflow = '';
  let popupConnections = 0;
  let tickTimerId = null;
  let isShutDown = false;

  function getCapSec() {
    return typeof limitMin === 'number' ? limitMin * 60 : Infinity;
  }

  function isAtLimit() {
    return typeof limitMin === 'number' && elapsedSec >= limitMin * 60;
  }

  // 拡張機能のリロード／更新時、古い content script は残ったまま chrome.* が
  // 「Extension context invalidated」を投げるようになります。チェックして
  // 安全に shutdown することで未捕捉エラーで X 側が汚染されないようにします。
  function isContextValid() {
    try {
      return Boolean(chrome && chrome.runtime && chrome.runtime.id);
    } catch (_e) {
      return false;
    }
  }

  function bailIfInvalidated(err) {
    const msg = err && (err.message || String(err));
    if (msg && msg.includes('Extension context invalidated')) {
      shutdown();
      return true;
    }
    if (!isContextValid()) {
      shutdown();
      return true;
    }
    return false;
  }

  function shutdown() {
    if (isShutDown) return;
    isShutDown = true;
    if (tickTimerId !== null) {
      clearInterval(tickTimerId);
      tickTimerId = null;
    }
    // listener は chrome.runtime と一緒に死んでいるため明示的な removeListener は不要です。
    // DOM のオーバーレイは残しておくと不便なので念のため除去します。
    try { removeOverlay(); } catch (_e) { /* noop */ }
    debug('[xsl] shutdown');
  }

  function safeI18n(key, substitutions) {
    if (isShutDown || !isContextValid()) return '';
    try {
      return chrome.i18n.getMessage(key, substitutions) || '';
    } catch (err) {
      bailIfInvalidated(err);
      return '';
    }
  }

  function isActive() {
    if (document.visibilityState !== 'visible') return false;
    if (popupConnections > 0) return true;
    return document.hasFocus();
  }

  async function ensureBackgroundReady() {
    if (!isContextValid()) return;
    try {
      await chrome.runtime.sendMessage({ type: 'ping' });
    } catch (err) {
      if (bailIfInvalidated(err)) return;
      console.warn('[xsl] background ping failed', err);
    }
  }

  async function loadInitial() {
    await ensureBackgroundReady();
    if (isShutDown) return;
    const local = await chrome.storage.local
      .get([STORAGE_KEY_LIMIT, STORAGE_KEY_ELAPSED, STORAGE_KEY_ELAPSED_DATE])
      .catch((err) => {
        if (bailIfInvalidated(err)) return {};
        console.warn('[xsl] local read failed', err);
        return {};
      });
    if (isShutDown) return;
    limitMin = typeof local[STORAGE_KEY_LIMIT] === 'number' ? local[STORAGE_KEY_LIMIT] : null;
    const today = todayKey();
    const storedDate = typeof local[STORAGE_KEY_ELAPSED_DATE] === 'string'
      ? local[STORAGE_KEY_ELAPSED_DATE]
      : null;
    const storedSec = typeof local[STORAGE_KEY_ELAPSED] === 'number' ? local[STORAGE_KEY_ELAPSED] : 0;
    if (storedDate === today) {
      elapsedSec = Math.min(storedSec, getCapSec());
    } else {
      // 日付が変わっている（または初回）。累計を 0 にし、日付を今日に更新します。
      elapsedSec = 0;
      await persistElapsed(today);
    }
    elapsedDate = today;
    debug('[xsl] init', { limitMin, elapsedSec, elapsedDate });
  }

  async function persistElapsed(dateKey) {
    if (isShutDown || !isContextValid()) return;
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY_ELAPSED]: elapsedSec,
        [STORAGE_KEY_ELAPSED_DATE]: dateKey,
      });
    } catch (err) {
      if (bailIfInvalidated(err)) return;
      console.warn('[xsl] persist failed', err);
    }
  }

  async function flushElapsed() {
    if (unflushedTicks === 0) return;
    unflushedTicks = 0;
    await persistElapsed(elapsedDate);
  }

  async function rolloverIfDateChanged() {
    const today = todayKey();
    if (today === elapsedDate) return false;
    elapsedDate = today;
    elapsedSec = 0;
    unflushedTicks = 0;
    if (isOverlayInstalled) removeOverlay();
    await persistElapsed(today);
    debug('[xsl] daily rollover', today);
    return true;
  }

  function checkLimit() {
    if (typeof limitMin !== 'number') {
      if (isOverlayInstalled) removeOverlay();
      return;
    }
    if (isAtLimit()) {
      installOverlay();
    } else if (isOverlayInstalled) {
      removeOverlay();
    }
  }

  function installOverlay() {
    if (isOverlayInstalled) {
      updateOverlayElapsed();
      return;
    }
    isOverlayInstalled = true;

    savedHtmlOverflow = document.documentElement.style.overflow;
    savedBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const inner = document.createElement('div');
    inner.className = 'x-scroll-limiter__inner';

    const title = document.createElement('h1');
    title.className = 'x-scroll-limiter__title';
    title.textContent = safeI18n('overlayTitle');

    const message = document.createElement('p');
    message.className = 'x-scroll-limiter__message';
    message.textContent = safeI18n('overlayMessage');

    const elapsed = document.createElement('p');
    elapsed.className = 'x-scroll-limiter__elapsed';
    elapsed.dataset.role = 'elapsed';

    const hint = document.createElement('p');
    hint.className = 'x-scroll-limiter__hint';
    hint.textContent = safeI18n('overlayHint');

    inner.append(title, message, elapsed, hint);
    overlay.appendChild(inner);
    document.body.appendChild(overlay);

    updateOverlayElapsed();
  }

  function updateOverlayElapsed() {
    const el = document.querySelector(`#${OVERLAY_ID} [data-role="elapsed"]`);
    if (!el) return;
    const minutes = Math.floor(elapsedSec / 60);
    el.textContent = safeI18n('overlayElapsedDisplay', [String(minutes)]);
  }

  function removeOverlay() {
    if (!isOverlayInstalled) return;
    isOverlayInstalled = false;
    document.documentElement.style.overflow = savedHtmlOverflow;
    document.body.style.overflow = savedBodyOverflow;
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }

  function tick() {
    if (isShutDown) return;
    if (!isContextValid()) {
      shutdown();
      return;
    }
    // タブを開きっぱなしで深夜 0:00 を跨いだ場合のロールオーバー検出。
    // 非アクティブ時でもロールオーバー判定だけは進めるため、isActive チェックの前に置きます。
    if (todayKey() !== elapsedDate) {
      rolloverIfDateChanged();
      return;
    }
    if (!isActive()) return;
    const cap = getCapSec();
    if (elapsedSec >= cap) {
      checkLimit();
      return;
    }
    elapsedSec = Math.min(cap, elapsedSec + 1);
    unflushedTicks += 1;
    if (unflushedTicks >= FLUSH_INTERVAL_TICKS) {
      flushElapsed();
    }
    if (isOverlayInstalled) {
      updateOverlayElapsed();
    }
    checkLimit();
  }

  function flushOnInactive() {
    if (!isActive()) {
      flushElapsed();
    }
  }

  function setupActivityListeners() {
    document.addEventListener('visibilitychange', flushOnInactive);
    window.addEventListener('blur', flushOnInactive);
  }

  function setupStorageWatcher() {
    if (!isContextValid()) return;
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (isShutDown) return;
        if (area !== 'local') return;
        if (STORAGE_KEY_LIMIT in changes) {
          const newVal = changes[STORAGE_KEY_LIMIT].newValue;
          limitMin = typeof newVal === 'number' ? newVal : null;
          elapsedSec = Math.min(elapsedSec, getCapSec());
          debug('[xsl] limit updated', limitMin);
          checkLimit();
        }
        if (STORAGE_KEY_ELAPSED_DATE in changes) {
          const newVal = changes[STORAGE_KEY_ELAPSED_DATE].newValue;
          // 他タブ／popup の手動リセットや日付ロールオーバーで日付キーが変わった、
          // または削除された場合に同期します。
          if (typeof newVal === 'string' && newVal !== elapsedDate) {
            elapsedDate = newVal;
          } else if (newVal === undefined) {
            elapsedDate = todayKey();
          }
        }
        if (STORAGE_KEY_ELAPSED in changes) {
          const newVal = changes[STORAGE_KEY_ELAPSED].newValue;
          if (newVal === undefined) {
            elapsedSec = 0;
            unflushedTicks = 0;
            removeOverlay();
          } else if (typeof newVal === 'number') {
            // popup の手動リセット（0 への明示書き戻し）も反映できるよう、新値をそのまま採用します。
            elapsedSec = Math.min(getCapSec(), newVal);
            if (isOverlayInstalled) updateOverlayElapsed();
          }
          checkLimit();
        }
      });
    } catch (err) {
      bailIfInvalidated(err);
    }
  }

  function setupScrollBlocking() {
    const isBlocked = () => isOverlayInstalled;

    window.addEventListener('wheel', (event) => {
      if (isBlocked()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, { passive: false, capture: true });

    window.addEventListener('touchmove', (event) => {
      if (isBlocked()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, { passive: false, capture: true });

    window.addEventListener('keydown', (event) => {
      if (isBlocked() && BLOCKED_KEYS.has(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  function setupMessageHandler() {
    if (!isContextValid()) return;
    try {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (isShutDown) return false;
        if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
          return false;
        }
        if (message.type === 'getState') {
          sendResponse({ elapsedSec, limitMin });
          return false;
        }
        return false;
      });
    } catch (err) {
      bailIfInvalidated(err);
    }
  }

  function setupPopupPort() {
    if (!isContextValid()) return;
    try {
      chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== PORT_NAME_POPUP) return;
        popupConnections += 1;
        debug('[xsl] popup connected', popupConnections);
        port.onDisconnect.addListener(() => {
          popupConnections = Math.max(0, popupConnections - 1);
          debug('[xsl] popup disconnected', popupConnections);
          flushElapsed();
        });
      });
    } catch (err) {
      bailIfInvalidated(err);
    }
  }

  async function main() {
    await loadInitial();
    if (isShutDown) return;
    setupActivityListeners();
    setupStorageWatcher();
    setupScrollBlocking();
    setupMessageHandler();
    setupPopupPort();
    tickTimerId = setInterval(tick, TICK_MS);
    checkLimit();
  }

  main().catch((err) => {
    if (bailIfInvalidated(err)) return;
    console.warn('[xsl] init failed', err);
  });
})();
