'use strict';

// X OFF のローカル設定テンプレートです。
// 公開リポジトリには含めない値（BMC ユーザー名、Chrome Web Store の自分のアイテム ID など）を
// このファイルにまとめます。
//
// 使い方:
//   1. このファイルを `src/config.js` にコピーします:
//        cp src/config.example.js src/config.js
//   2. `src/config.js` の各値を自分のものに差し替えます。
//   3. `src/config.js` は `.gitignore` で除外されており、リポジトリには含まれません。
//   4. 配布用 zip (`mise run package`) には `src/config.js` が含まれます。
//
// 値が空文字列の場合は対応する UI（Buy Me a Coffee リンク等）が自動的に非表示になります。

(() => {
  globalThis.XOFF_CONFIG = {
    // 開発者支援先 URL。OFUSE / Ko-fi / Buy Me a Coffee / PayPal.Me / GitHub Sponsors など何でも可。
    // 空文字なら popup の「応援する」セクションは非表示になります。
    TIP_URL: '',

    // 上記リンクの直前に表示する短い案内文（プラットフォーム名や最低額の目安）。
    // 例: 'OFUSE（100 円〜）' / 'Ko-fi (from $3)' / 'GitHub Sponsors'
    TIP_NOTE: '',

    // Chrome Web Store のインストールページ URL。シェア文中の $LINK$ プレースホルダに展開されます。
    // 公開前は空文字でも構いません。
    INSTALL_URL: '',
  };
})();
