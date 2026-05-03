'use strict';

importScripts('config.js', 'shared.js');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

// content script 起動時の SW 起き上がりを保証するための ping。
// content 側はこの応答を待ってから storage 読み書きに入ります。
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    return false;
  }
  if (message.type === 'ping') {
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
