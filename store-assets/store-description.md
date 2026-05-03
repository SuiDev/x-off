# Chrome Web Store ストア掲載情報

本ファイルは Chrome Web Store Developer Dashboard の「ストア掲載情報」タブに貼り付けるためのテンプレートです。日本語と英語を両方収載しています。

---

## 日本語

### 短い説明（132 文字以内）

X で過ごす時間を有限に。アクティブ閲覧時間が 1 日の上限に達するとスクロールをブロックします。日付が変われば自動的にリセット。

### 詳細説明

X OFF は、X に使う時間を自分で決めるための拡張機能です。

【主な機能】

- ユーザーが指定した上限分数（1〜600 分）まで 1 日 X を閲覧できます
- アクティブにタブを見ている時間のみがカウントされます。バックグラウンドタブやウィンドウを最小化している間はカウントされません
- 上限に達するとフルスクリーンのオーバーレイが表示され、スクロール操作がブロックされます
- 経過時間は 1 日の累計（ローカルタイムゾーンの 0:00 起算）で記録され、日付が変わると自動的にリセットされます
- データは外部に送信されません。すべてお使いのブラウザ内で完結します

【使い方】

1. 拡張機能をインストールします
2. 自動で開く設定ページで、1 日に X に費やしたい上限分数を入力して保存します
3. X を開いて利用します
4. 上限に達したら別のことに時間を使ってください。日付が変われば自動的に再開できます
5. ツールバーアイコンから上限値の変更や手動リセットができます

【プライバシー】

本拡張機能は一切の情報を外部に送信しません。設定値と経過時間はあなたのブラウザの中だけに保存され、第三者と共有されることはありません。詳細はプライバシーポリシーをご覧ください。

【こんな方へ】

- X に使う時間を自分で決めたい方
- 集中したい時間にだけ X を使いたい方
- アプリやサービスをブロックする系のツールが厳しすぎて続かなかった方（本拡張は日付が変われば自動的に再開できるソフトリミット型です）

【免責事項】

「X」および「Twitter」は X Corp. の商標です。本拡張機能は X Corp. と関連も提携もない、独立した第三者ツールです。

---

## English

### Short description (under 132 chars)

Cap your daily time on X. When active viewing time hits the limit, scrolling is blocked. The timer resets when the date changes.

### Detailed description

X OFF helps you choose how much time you spend on X.

Features:

- Set a daily time cap from 1 to 600 minutes
- Only active viewing time is counted. Background tabs and minimized windows don't add to your total
- When you hit the limit, a full-screen overlay blocks scrolling on X
- Elapsed time accumulates as a daily total (starting at midnight local time) and resets automatically when the date changes
- No data leaves your browser. Everything is stored locally

How to use:

1. Install the extension
2. The setup page opens automatically — enter how many minutes you want to allow yourself per day
3. Open X and use it as usual
4. When you hit the limit, take a break — the timer resets automatically when the date changes
5. From the toolbar icon you can change the limit or manually reset the timer

Privacy:

This extension does not transmit any information externally. Your time limit and elapsed time stay inside your browser and are never shared with third parties. See the privacy policy for details.

Who this is for:

- Anyone who wants to set their own pace on X
- Anyone who wants X available only on their own terms
- Anyone who tried strict app blockers and couldn't stick with them — this extension uses a soft daily limit that automatically resets when the date changes

Disclaimer:

"X" and "Twitter" are trademarks of X Corp. This extension is an independent third-party tool and is not affiliated with, endorsed by, or sponsored by X Corp.

---

## カテゴリ

生産性 / Productivity

## 言語

- 日本語
- English

## 単一目的の説明（Single Purpose）

X での閲覧時間を制限し、ユーザーが集中して時間を管理できるようにする / Limit time spent on X so the user can manage their attention deliberately.

## 権限の利用根拠（Permission Justifications）

- `storage`: ユーザーが設定した上限分数、当日の経過秒数、累計を蓄積中の日付キーをブラウザ内に保存するため / To persist the user-set time limit, today's elapsed seconds, and the date key the cumulative total belongs to, all stored locally.
- Host permissions (`https://x.com/*`, `https://twitter.com/*`): 該当ページに計測およびオーバーレイ用スクリプトを注入するため / To inject the measurement and overlay scripts into those pages.

## データの収集

なし / None.

## リモートコードの使用

なし / No remote code is used.
