# プライバシーポリシー

## English version

[Scroll down for the English version.](#privacy-policy)

---

X OFF（以下「本拡張機能」）は、ユーザーのプライバシーを最大限尊重します。本ポリシーは、本拡張機能がどのような情報をどのように扱うかを説明します。

## 1. 収集する情報

本拡張機能は、以下の情報以外を一切収集しません。

| 情報                                          | 保存先                           | 用途                  |
| --------------------------------------------- | -------------------------------- | --------------------- |
| ユーザーが設定した上限分数                    | `chrome.storage.local`（端末内） | 上限到達判定          |
| 当日の X 上アクティブ経過秒数とその日付キー   | `chrome.storage.local`（端末内） | 日次累計の保持と判定  |
| ユーザーの言語設定（Chrome から取得）         | 保存しない                       | UI 表示の言語切り替え |

これらの情報はすべてユーザーの端末内に保存されます。経過秒数は日付（ローカルタイムゾーン）が変わると自動的に 0 にリセットされます。

## 2. 外部送信

本拡張機能は、いかなる情報も外部サーバーへ送信しません。アクセス解析・クラッシュレポート・テレメトリの送信も行いません。

## 3. 第三者との共有

本拡張機能はユーザーの情報を一切第三者と共有しません。

## 4. 拡張機能の権限

本拡張機能は以下の Chrome 拡張権限を要求します。それぞれの利用目的は次のとおりです。

| 権限                                                       | 利用目的                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `storage`                                                  | 上限分数および経過秒数（当日累計と日付キー）を端末内に保存するため |
| host permission `https://x.com/*`, `https://twitter.com/*` | 該当ページに計測・オーバーレイ表示のスクリプトを注入するため     |

これらの権限は X / Twitter 以外のサイトに対しては一切作用しません。本拡張は `tabs` permission を要求しません。

## 5. お子様のプライバシー

本拡張機能は 13 歳未満の児童から個人情報を意図的に収集しません。

## 6. ポリシーの変更

本ポリシーの内容を変更する場合、本ファイルおよび拡張機能の更新時に告知します。

## 7. 連絡先

本ポリシーに関するお問い合わせは、リポジトリの [Issue](https://github.com/SuiDev/x-off/issues) までお願いします。

---

# Privacy Policy

Last updated: 2026-05-01

X OFF (the "Extension") respects your privacy. This policy describes what information the Extension processes and how.

## 1. Information We Collect

The Extension only handles the following information.

| Information                                                  | Storage                            | Purpose                                          |
| ------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------ |
| User-configured time limit (minutes)                         | `chrome.storage.local` (on-device) | Determining when the limit is reached            |
| Today's active seconds elapsed on X, plus the matching date  | `chrome.storage.local` (on-device) | Tracking the daily cumulative total              |
| User's language setting (read from Chrome)                   | Not stored                         | Localized UI rendering                           |

All of the above is stored locally on the user's device. The elapsed seconds counter resets automatically to zero when the local-time date changes.

## 2. External Transmission

The Extension does not transmit any information to any external server. There is no analytics, no crash reporting, and no telemetry.

## 3. Third-Party Sharing

The Extension does not share any user information with any third party.

## 4. Permissions

The Extension requests the following Chrome permissions for the stated purposes.

| Permission                                                  | Purpose                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `storage`                                                   | To persist the time limit, the daily elapsed seconds, and the date key on-device       |
| Host permissions `https://x.com/*`, `https://twitter.com/*` | To inject the measurement and overlay scripts on those pages                           |

These permissions never operate on sites other than X / Twitter. The Extension does not request the `tabs` permission.

## 5. Children's Privacy

The Extension does not knowingly collect personal information from children under 13.

## 6. Changes to This Policy

If we change this policy, we will note the update in this file and in the extension's release notes.

## 7. Contact

For questions about this policy, please open an [issue](https://github.com/SuiDev/x-off/issues) in this repository.
