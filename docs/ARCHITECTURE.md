# 内部設計

本ドキュメントは X OFF の内部設計を説明します。実装に着手する前、または既存実装に大きな変更を加える前に、本ドキュメントを更新してください。

## 1. コンポーネント構成

```
┌─────────────────────────────────────────────────────────┐
│                      Chrome Extension                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  background  │  │   content    │  │  popup /     │   │
│  │  (worker)    │  │   (X page)   │  │  options     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │           │
│         └────────┬────────┴─────────────────┘           │
│                  │                                      │
│         ┌────────▼───────────────────────────┐          │
│         │ storage.local                      │          │
│         │  limitMin / elapsedSec / elapsedDate│          │
│         └────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

## 2. 主要コンポーネントの責務

### 2-1. background.js（service worker）

| イベント / 処理                               | 説明                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `chrome.runtime.onInstalled` (reason=install) | `chrome.runtime.openOptionsPage()` で初回設定ページを開く                                                                         |
| `chrome.runtime.onMessage` (`type: 'ping'`)   | content script から起動確認のために送られてくる ping。SW が寝ていた場合の起き上がりを保証するための同期ハンドシェイクです        |

### 2-2. content.js（X ページに注入）

X のページ読み込み完了後（`run_at: document_idle`）に注入されます。

主要な状態:

- `elapsedSec`: アクティブ秒数のローカル変数
- `elapsedDate`: 累計を蓄積している日付（YYYY-MM-DD、ローカルタイムゾーン）
- `limitMin`: storage.local から読み込んだ上限分数（未設定なら null）
- `tickTimer`: 1 秒ごとのカウントアップタイマー

ロジック:

1. 起動時に storage.local から `limitMin` / `elapsedSec` / `elapsedDate` を読み込みます。`elapsedDate` が今日と異なる（または未設定）なら `elapsedSec` を 0 に戻し、`elapsedDate` を今日に書き換えます
2. `setInterval(1000)` で各 tick の冒頭に日付ロールオーバーを判定し、日付が変わっていれば `elapsedSec` を 0 に戻します（タブを開きっぱなしで深夜 0:00 を跨いだケース対応）
3. アクティブ判定が真のときだけ `elapsedSec++`
4. 5 秒ごとに storage.local へ `elapsedSec` と `elapsedDate` を flush
5. `elapsedSec >= limitMin * 60` の瞬間に `installOverlay()` を呼ぶ
6. `chrome.storage.onChanged`（area === 'local'）を購読し、limit 変更や他コンテキストからのリセットを即時反映

アクティブ判定:

```javascript
const isActive = () =>
  document.visibilityState === "visible" && document.hasFocus();
```

`visibilitychange` / `focus` / `blur` イベントを購読し、状態変化時にカウンタの一時停止／再開を切り替えます。

### 2-3. popup.html / popup.js

ツールバーアイコン押下時の小さな UI です。

表示内容:

- 現在の経過時間（mm:ss）
- 上限値（分）
- 残り時間（mm:ss）または「上限に達しました」表示

操作:

- 上限値の input + 保存ボタン → storage.local に書き込み
- 「リセット」ボタン → storage.local の `elapsedSec` を 0、`elapsedDate` を今日に書き戻し、即時にカウンタを 0 に戻す

### 2-4. options.html / options.js

インストール直後に開かれる設定画面です。

- 数値 input (1〜600) と保存ボタン
- 既存値があれば初期表示
- 保存後にトースト的に成功メッセージ

## 3. データフロー

### 計測〜上限到達

```
[content.js] tickTimer 1Hz
  ├── todayKey() !== elapsedDate → rollover (elapsedSec=0, persist)
  ├── isActive() = true → elapsedSec++
  └── 5sec ごと
      └── storage.local.set({ elapsedSec, elapsedDate })

[content.js] elapsedSec >= limitMin * 60
  └── installOverlay()
      ├── document.body にオーバーレイ要素を append
      └── document.documentElement.style.overflow = 'hidden'
```

### 日次リセット

```
[content.js] tickTimer の各 tick 冒頭
  └── todayKey() (ローカルタイムゾーン YYYY-MM-DD) を計算
      └── elapsedDate と一致しなければ
          ├── elapsedSec = 0
          ├── elapsedDate = today
          ├── overlay 表示中なら除去
          └── storage.local.set({ elapsedSec: 0, elapsedDate: today })

[content.js] 起動時 loadInitial
  └── storage.local の elapsedDate と今日を比較
      └── 不一致なら同様にリセットして書き戻す
```

タブが 1 つも開かれていない時間帯に日付を跨いだ場合は、次に X タブが開かれた瞬間の `loadInitial` でリセットされます。

### 設定変更

```
[popup.js or options.js] 上限値を保存
  └── chrome.storage.local.set({ limitMin })
      └── [content.js] chrome.storage.onChanged を受信
          └── ローカル変数 limitMin を更新
              └── 既に上限を超えていればすぐ overlay を再表示
```

## 4. ストレージスキーマ

### chrome.storage.local

| キー            | 型                  | 説明                                                                                                            |
| --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `limitMin`     | number \| undefined | ユーザー指定の上限分数。未設定の場合は計測のみ行いオーバーレイは出さない                                       |
| `elapsedSec`   | number              | アクティブに X を見た当日の累積秒数。`elapsedDate` が今日と一致しないとき、または起動時にリセットされる |
| `elapsedDate` | string              | `elapsedSec` を蓄積中の日付（ローカルタイムゾーン YYYY-MM-DD）。これが今日と異なれば 0 に戻す               |

`chrome.storage.session` は使用しません（以前はセッション制リセットのために使用していましたが、日次リセット仕様への変更に伴い廃止しました）。

## 5. メッセージング

`chrome.runtime.sendMessage` / `onMessage` で背景とのやり取りを行います。

| メッセージ type | 送信元   | 受信先                | 効果                                                    |
| --------------- | -------- | --------------------- | ------------------------------------------------------- |
| `ping`          | content  | background            | SW を起こすための同期ハンドシェイク                    |
| `getState`      | popup    | content（active tab） | 現在の `elapsedSec` と `limitMin` を返す               |

popup の手動リセットは message ではなく `chrome.storage.local.set({ elapsedSec: 0, elapsedDate: todayKey() })` を直接呼び、storage.onChanged 経由で content / 他 popup に伝搬させます。

## 6. 設計判断の理由

### なぜ滞在時間で計測するか

スクロール量や操作回数だと、慣性スクロールや画面サイズの差で個人差が大きく出ます。「アクティブな滞在時間」が最も体感に近く、ユーザーが目標を立てやすいと判断しました。

### なぜ日次リセットか

文言（`extDescription` の「daily」「1 日の閲覧時間の上限」）と動作の整合を取るためです。以前はタブを閉じた瞬間にリセットされる「セッション制」を採用していましたが、ユーザーから「タブを開き直すたびにカウントが消えるのは制限ではない」というフィードバックを受け、ローカルタイムゾーンの 0:00 起算の日次累計に切り替えました。

「あと数時間待てば使える」という心理的抜け道のリスクは存在しますが、ストア説明文と一致しない動作はそれ以上に信頼を損ねます。手動で即時リセットしたいユーザーには popup の「経過時間をリセット」ボタンを提供しています。

### なぜ `visibilityState` と `hasFocus()` の AND か

`visibilityState === 'visible'` だけだと、別アプリにフォーカスがあるが Chrome ウィンドウは見えている状態でカウントが増え続けます。`hasFocus()` だけだと、Chrome ウィンドウ内で別タブに切り替えただけで停止してしまい、誤判定が起きます。両方を満たすときだけアクティブと判定することで、現実的な「見ている時間」に近づきます。

### なぜ Manifest V3 + service worker か

Chrome は MV2 のサポートを終了しました。ストア新規公開は MV3 必須です。永続バックグラウンドページが使えないため、storage 経由で状態を持ち、必要時にだけ worker が起動する設計にしています。

### なぜリモートコードを禁止するか

MV3 のポリシー上、外部スクリプトのロードは禁止されています。ストア審査でも厳しくチェックされます。本拡張は外部通信なしの設計で、CSP 違反となる実装は最初から避けます。

### なぜ Extension context invalidated を能動的に処理するか

Chrome は拡張機能を更新／リロードした瞬間に古い content script の context を無効化します。content script 自体はページ DOM に残ったまま走り続けますが、`chrome.runtime` や `chrome.storage` を呼ぶと「Extension context invalidated」エラーが発生します。これを放置すると未捕捉エラーで X 側の DOM ログが汚染され、最悪はユーザー視点でも見える形でエラーが出てしまいます。

本拡張は `isContextValid()`（`chrome.runtime?.id` の存在チェック）と各 chrome 呼び出しの `try/catch` の組み合わせで context 失効を検出し、`shutdown()` 経路でタイマーを停止しオーバーレイを除去します。`chrome.i18n.getMessage` は同期的に throw する場合があるため `safeI18n()` ヘルパで包み、storage 系は既存の `.catch` で `bailIfInvalidated()` を呼び分けます。

ユーザーに必要なのは X タブのリロードだけです。

### なぜ storage.local 一本に絞ったか

以前は経過秒数を `chrome.storage.session` に保存していました。`session` はブラウザ起動セッション内に閉じるため content script からのアクセスに `setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })` の昇格が必要で、background が起動する race を避けるために `ping` ハンドシェイクで `setAccessLevel` の完了を待ち合わせるという手順を踏んでいました。

日次累計に切り替えるにあたり、ブラウザ再起動後も累計を保持する必要が生じたため `storage.local` に統合しました。`local` は content script から制約なく直接読み書きできるため `setAccessLevel` 呼び出しと、それに伴う SW 起き上がり待ちの設計上の前提が一つ減りました。`ping` ハンドシェイク自体は SW を確実に起こす目的で残してあります。

## 7. 拡張ポイント（v0.2 以降）

| 機能                  | 想定実装場所                                                                          |
| --------------------- | ------------------------------------------------------------------------------------- |
| 0:00 ピンポイントの自動リセット | 現状は次の tick で検出するため最大 1 秒の遅延あり。厳密に 0:00 で切り替えたい場合は `chrome.alarms` の追加を検討 |
| ホワイトリスト URL    | content.js で `location.pathname` をチェックし、計測対象外をスキップ                  |
| 統計グラフ            | popup の拡張ビュー、または専用 stats ページを追加                                     |
| Firefox 対応          | `browser` 互換 API を使い、manifest を Firefox 用に分岐                               |
