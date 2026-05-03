'use strict';

(() => {
  const {
    STORAGE_KEY_LIMIT,
    parseLimit,
    applyI18n,
    showStatus: showStatusBase,
  } = globalThis.XOFF;

  const STATUS_CLEAR_MS = 3000;
  const STATUS_ELEMENT_ID = 'x-scroll-limiter-status';

  async function loadCurrent() {
    const result = await chrome.storage.local.get(STORAGE_KEY_LIMIT);
    return result[STORAGE_KEY_LIMIT];
  }

  async function save(value) {
    await chrome.storage.local.set({ [STORAGE_KEY_LIMIT]: value });
  }

  function showStatus(text, isError) {
    showStatusBase(STATUS_ELEMENT_ID, text, isError, STATUS_CLEAR_MS);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    applyI18n(document);
    const input = document.getElementById('x-scroll-limiter-limit-input');
    const form = document.getElementById('x-scroll-limiter-form');

    const current = await loadCurrent();
    if (typeof current === 'number') {
      input.value = String(current);
    } else {
      // 初回セットアップ時のみ自動フォーカス。再訪時はフォーカスを奪わないようにします。
      input.focus();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = parseLimit(input.value);
      if (value === null) {
        showStatus(chrome.i18n.getMessage('optionsValidationError'), true);
        return;
      }
      try {
        await save(value);
        showStatus(chrome.i18n.getMessage('optionsSavedMessage'), false);
      } catch (err) {
        console.warn('[xsl] save failed', err);
        showStatus(chrome.i18n.getMessage('optionsValidationError'), true);
      }
    });
  });
})();
