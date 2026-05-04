# X OFF

X で過ごす時間を有限にする Chrome 拡張機能です。

ユーザーがインストール時に指定した分数だけタイムラインを閲覧できます。アクティブにタブを見ている時間のみがカウントされ、上限に達するとフルスクリーンのオーバーレイで利用がブロックされます。経過時間は 1 日の累計で記録され、日付が変わると自動でリセットされる、ソフトリミット型の設計です。

## 主な特徴

- アクティブな閲覧時間のみを計測（バックグラウンドタブや非フォーカス時はカウントしません）
- 上限到達時はスクロールを物理的にロック
- 経過時間は 1 日の累計（ローカルタイムゾーンの 0:00 起算）で記録され、日付が変わると自動でリセット
- 外部送信なし。すべて `chrome.storage.local` 内で完結
- 日本語 / 英語の UI

## インストール

### Chrome Web Store からのインストール

[Chrome Web Store の X (Twitter) OFF ページ](https://chromewebstore.google.com/detail/x-off/aoepocnfnikacllkjopecddljpcjfmah)を開き、「Chrome に追加」ボタンを押してください。

### 開発版のインストール

1. このリポジトリをクローンします
2. ローカル設定ファイルを用意します（初回のみ）:

   ```bash
   cp src/config.example.js src/config.js
   # 必要に応じて src/config.js を編集（BMC_URL / INSTALL_URL の値を入れる）
   # 値を空のままにすると関連 UI は非表示になります
   ```

3. Chrome で `chrome://extensions` を開き、右上の「デベロッパーモード」をオンにします
4. 「パッケージ化されていない拡張機能を読み込む」ボタンを押し、本リポジトリの `src/` ディレクトリを選択します
5. 自動的に開かれる設定ページで上限分数を入力して保存します

`src/config.js` は `.gitignore` 対象で公開リポジトリに含まれません。fork して自分の値で運用する想定です。詳細は [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を参照してください。

## 使い方

1. インストール直後に開かれる設定ページで、X に費やしたい上限分数（1〜600）を入力します
2. X (`x.com` または `twitter.com`) を開いて利用します
3. 上限に達するとオーバーレイが表示され、スクロール操作がブロックされます
4. 経過時間は日付が変わると自動的にゼロに戻ります。手動で今すぐリセットしたい場合はツールバーアイコンのポップアップから「経過時間をリセット」を押してください
5. 上限値はツールバーアイコンのポップアップからいつでも変更できます

## 開発に参加する

開発手順は [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を参照してください。テスト手順は [docs/TESTING.md](docs/TESTING.md)、内部設計は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) にまとめてあります。

AI エージェントが本リポジトリで作業する場合は [AGENTS.md](AGENTS.md) を必ず最初に読んでください。

## ライセンス

[MIT License](LICENSE) で配布しています。
