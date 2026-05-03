---
name: push-check
description: Audit the repository before pushing it to a public remote. Use when the user asks "push してよい？" / "公開前にチェック" / "リポジトリ全体を push して大丈夫か" / similar pre-push or pre-publish review. Walks through secrets, .gitignore correctness, embarrassing/unfinished code, repo-identity coherence, and project-specific (X OFF) hygiene, then produces a Go / 条件付き Go / No-Go verdict.
---

# push-check — 公開前リポジトリ監査スキル

公開リモートに push してよいかをチームの誰でも同じ基準で判定するためのランブックです。AI エージェント／人間どちらでも、上から順にコマンドを実行し、最後に「修正必須／要確認／軽微／OK」の 4 区分で報告します。

## 動作原則

- **読み取り専用**。ファイルの書き換え、`git add`、commit、push、`.gitignore` の自動編集は一切しない。問題は報告だけ
- **網羅性が価値**。1 つ問題が見つかってもそこで止めない。すべてのセクションを通す
- **`git grep` だけに頼らない**。`git grep` は tracked ファイルしか対象にしないため、初回 push（全部 untracked）の場合は取りこぼす。本ランブックでは tracked / untracked の両方を見る前提でコマンドを書く
- グレップは大量 hit する想定。**ヒット即 NG ではなく、文脈で判断**する
- 自動修正は禁止。最終判断は人間
- 出力は日本語。コマンド・パス・識別子はそのまま英数字

## 実行フロー

### 0. 前提確認とスコープ決定

「これから何が公開されるか」を最初に確定させる。差分 push と初回 push でその後の検査対象が変わる。

```bash
git rev-parse --is-inside-work-tree
git remote -v
git rev-parse --abbrev-ref HEAD
git status --short
git log --oneline -10

# 上流ブランチがある場合: push 対象の差分
git log --oneline @{u}..HEAD 2>/dev/null && git diff --stat @{u}..HEAD 2>/dev/null

# tracked と untracked-但し-not-ignored の量を把握
echo "--- tracked ---"; git ls-files | wc -l
echo "--- about to be added (untracked-not-ignored) ---"; git ls-files --others --exclude-standard | wc -l
```

スコープを次のいずれかに分類:

- **A. 差分 push（既存 public リポジトリへの追加コミット）**: `git log @{u}..HEAD` の範囲が監査対象。tracked ファイル中心。
- **B. 初回 push（リポジトリ全体が初めて公開される）**: 全コミット履歴 + 全 tracked ファイル + これから add される untracked が対象。**履歴に消されたシークレットも公開される点に注意**。
- **C. ハイブリッド（既存リポジトリだが、未コミットの大量変更がある）**: B と同じ厳しさで見る。

### 1. シークレット・秘匿情報

「公開してはいけない値が紛れ込んでいないか」を確認する。

#### 1-1. パターンスキャン（tracked / untracked 両対応）

`git grep` の代わりに `grep -rn` で working tree 全体をスキャンする。`.git`・`.claude`・`dist` は除外。

```bash
SCAN='--exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist --exclude-dir=node_modules'

# クラウド／SaaS トークン
grep -rnIE 'AKIA[0-9A-Z]{16}|aws_secret|AWS_SECRET' $SCAN .
grep -rnIE 'ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}' $SCAN .
grep -rnIE 'sk-[A-Za-z0-9]{20,}' $SCAN .                       # OpenAI / Anthropic 風
grep -rnIE 'xox[baprs]-[0-9A-Za-z-]{10,}' $SCAN .              # Slack
grep -rnIE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' $SCAN .

# 一般的な credential パターン
grep -rniIE '(api[_-]?key|secret|password|passwd|token|bearer|authorization)\s*[:=]\s*["'"'"']?[A-Za-z0-9_/+\-]{12,}' \
  $SCAN --include='*.js' --include='*.json' --include='*.html' --include='*.css' \
  --include='*.md' --include='*.sh' --include='*.toml' --include='*.yaml' --include='*.yml' .

# URL 埋め込み認証情報
grep -rniIE 'mongodb(\+srv)?://[^[:space:]"'"'"']+:[^[:space:]"'"'"']+@' $SCAN .
grep -rniIE 'postgres(ql)?://[^[:space:]"'"'"']+:[^[:space:]"'"'"']+@' $SCAN .
grep -rniIE 'https?://[^[:space:]"'"'"']+:[^[:space:]"'"'"']+@'         $SCAN .
```

ヒット 1 件ずつ:
- ダミー / プレースホルダー / 公開しても安全か？
- テストフィクスチャで意図的に置いてあるダミーか（コメントで明示されているか）？

#### 1-2. シークレットを含みがちなファイル名

```bash
find . -type f -not -path './.git/*' -not -path './.claude/*' -not -path './dist/*' | \
  grep -iE '\.(pem|key|p12|pfx|crt|jks|keystore)$|(^|/)id_(rsa|dsa|ed25519|ecdsa)(\.pub)?$|(^|/)\.env(\.|$)|credentials|secrets?\.(json|ya?ml|toml)|service[_-]account.*\.json$'
```

X OFF では `*.pem` と `src/config.js` が `.gitignore` 対象。tracked / push 予定に含まれていないか確認:

```bash
git ls-files | grep -E '\.pem$|^src/config\.js$'
git ls-files --others --exclude-standard | grep -E '\.pem$|^src/config\.js$'
```

→ **どちらかに出たら NG**（gitignore より先に commit されたか、ignore 漏れ）。

#### 1-3. 履歴に過去入って消されたシークレット

スコープ B（初回 push）または履歴を初公開する状況で必須。

```bash
git log -p --all -S 'BEGIN PRIVATE KEY' | head -40
git log --all -p | grep -niE '(api[_-]?key|secret|password|token)\s*[:=]\s*["'"'"']?[A-Za-z0-9_/+\-]{20,}' | head -40
```

履歴に入っている場合、**ファイル削除では公開リスクは消えない**。`git filter-repo` で履歴ごと書き換える必要があり、人間に判断を委ねる。

#### 1-4. PII / 個人情報

```bash
SCAN='--exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist'
INC='--include=*.js --include=*.json --include=*.html --include=*.css --include=*.md --include=*.sh --include=*.toml --include=*.yaml --include=*.yml'

# メールアドレス
grep -rnE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' $SCAN $INC .

# 個人マシンの絶対パス
grep -rnE '/Users/|/home/[a-z][a-z0-9_-]+/' $SCAN $INC .

# 日本の携帯番号
grep -rnE '\b(0[789]0)-?[0-9]{4}-?[0-9]{4}\b' $SCAN $INC .
```

評価基準:
- メール: `LICENSE` / `package.json` の author / GitHub noreply (`...@users.noreply.github.com`) は想定内
- 個人パス: コードに紛れていれば NG。docs のサンプルコマンドなら可

### 2. .gitignore の正しさ

「ignore したいものが本当に ignore されているか / されてないものが ignore されてしまっていないか」を確認する。

#### 2-1. 既に tracked になっている「本来 ignore すべき」ファイル

```bash
git ls-files | grep -iE '(^|/)(node_modules|dist|build|out|coverage|\.next|\.nuxt|\.cache|\.tmp|\.DS_Store|Thumbs\.db|\.vscode|\.idea)(/|$)'
git ls-files | grep -E '\.(log|swp|swo|bak|orig|rej|zip|tar|gz|tgz|7z|rar)$'
```

→ ヒットしたら過去 commit で混入。`git rm --cached` で外す対応が必要（**自動実行禁止**、提案のみ）。

#### 2-2. .gitignore のカバレッジ

```bash
cat .gitignore
git status --ignored --short    # 何が ignore されているか確認

# 「これから add される予定のファイル」と「ignore で省かれるファイル」の境界を確認
git ls-files --others --exclude-standard | head -50
git check-ignore -v $(find . -type f -not -path './.git/*') 2>/dev/null | head -30
```

X OFF プロジェクトで ignore されているべき項目:

- `dist/` / `*.zip` (パッケージ出力)
- `*.pem` (Chrome 拡張の鍵)
- `src/config.js` (BMC URL 等のローカル設定)
- `.env*`
- `.DS_Store`, `.vscode/`, `.idea/`

`.claude/` も gitignore 対象。本スキル自体が `.claude/skills/` 配下にあるため、共有したい場合は冒頭の **「このスキルをチームで共有する」** に従って例外を入れる判断が必要（人間に確認）。

#### 2-3. テンプレートファイルの妥当性

`*.example.*` 等のテンプレートに実値が漏れていないか:

```bash
test -f src/config.example.js && cat src/config.example.js
```

→ プレースホルダー（空文字列、`YOUR_BMC_URL` 等）になっているか。実 URL が書いてあれば NG。

### 3. 残骸・未完成・恥ずかしい実装

「公開して恥ずかしくないか」を確認する。

#### 3-1. 開発中の痕跡

```bash
SCAN='--exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist'

grep -rnE 'TODO|FIXME|XXX|HACK|WIP|TEMP|DEBUG' $SCAN \
  --include='*.js' --include='*.html' --include='*.css' --include='*.md' --include='*.sh' src/ docs/ scripts/ 2>/dev/null

# console.log / debugger / alert は禁止 (AGENTS §6)
grep -rnE '\bdebugger\b|console\.log\(|alert\(' $SCAN src/ 2>/dev/null

# console.{debug,warn,info,error} は [xsl] プレフィックス必須
grep -rnE 'console\.(debug|warn|info|error)\(' $SCAN src/ 2>/dev/null | grep -v '\[xsl\]'
```

判定: `console.log` と `debugger` の残存は **即 NG**（AGENTS §6 違反）。`TODO` 単体は許容範囲だが、コミット前に整理しておきたい内容なら警告。

#### 3-2. プレースホルダー文字列

```bash
grep -rniE '\b(lorem ipsum|asdf|qwerty|hogehoge|foobar|dummy|placeholder|sample|test123|password123)\b' \
  $SCAN --include='*.js' --include='*.html' --include='*.css' --include='*.md' --include='*.json' src/ docs/ scripts/ 2>/dev/null
```

#### 3-3. 大きくコメントアウトされた死んだコード

```bash
# 連続した // コメント行が 5 行以上続く箇所（ヒューリスティクス）
find src -name '*.js' -not -path '*/.*' | while read f; do
  awk '/^[[:space:]]*\/\//{c++; if(c==5){print FILENAME":"NR; c=0}; next} {c=0}' "$f"
done
```

→ ヒットしたら目視確認。設計コメントなら可、古い実装の残骸なら削除を推奨。テンプレートファイル（`*.example.js`）は誤検出のことが多いので除外して判断。

#### 3-4. 空 catch / 雑なエラー処理

```bash
grep -rnE 'catch\s*\([^)]*\)\s*\{\s*\}' --exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist src/ 2>/dev/null
grep -rnE 'catch\s*\([^)]*\)\s*\{\s*//' --exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist src/ 2>/dev/null
```

#### 3-5. プロフェッショナルでない言葉

```bash
SCAN='--exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist'
grep -rniE '\b(fuck|shit|damn|crap|wtf|kuso|baka|chikusho)\b' $SCAN src/ docs/ scripts/ 2>/dev/null
grep -rniE 'やばい|クソ|まじで|なんで動く' $SCAN src/ docs/ scripts/ 2>/dev/null
```

#### 3-6. CSP / Manifest V3 違反パターン

AGENTS §6 で禁止: `eval`, `new Function`, `innerHTML` への外部入力代入, リモート script 読み込み。

```bash
SCAN='--exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist'
grep -rnE '\beval\(|new Function\(' $SCAN src/ 2>/dev/null
grep -rn '\.innerHTML\s*=' $SCAN src/ 2>/dev/null
grep -rnE '<script[^>]+src\s*=\s*["'"'"']https?://' $SCAN src/ 2>/dev/null
```

→ Chrome Web Store 提出時にレビュー拒否される。**NG**。

### 4. リポジトリ整合性

「外から見て恥ずかしい点・矛盾点」を確認する。

#### 4-1. 巨大ファイル / バイナリの混入

```bash
# tracked + untracked の中で 1MB 超のファイル
find . -type f -not -path './.git/*' -not -path './.claude/*' -not -path './dist/*' -size +1M -exec ls -lh {} \; | sort -k5 -h
```

→ `store-assets/` のスクリーンショット PNG（1280×800）は許容。それ以外（PDF / 動画 / ZIP / tar）は要確認。

#### 4-2. アイコン / 画像のプレースホルダー

```bash
git ls-files src/icons/ store-assets/ 2>/dev/null
file $(git ls-files 'src/icons/*.png' 'store-assets/*.png' 2>/dev/null) 2>/dev/null

# untracked なら:
find src/icons store-assets -name '*.png' 2>/dev/null | xargs file 2>/dev/null
```

- アイコンが単色プレースホルダーのままになっていないかは目視確認
- Chrome Web Store 公開を伴う push なら未差し替えは要警告

#### 4-3. ドキュメントのリンク切れ

```bash
# README / CLAUDE / AGENTS / docs/*.md が指すローカルパスが実在するか
for f in README.md AGENTS.md CLAUDE.md docs/*.md; do
  [ -f "$f" ] || continue
  grep -oE '\]\([^)]+\)' "$f" 2>/dev/null | sed 's/^](//;s/)$//' | while read p; do
    case "$p" in http*|"#"*|""|mailto*) continue ;; esac
    target="${p%%#*}"
    [ -z "$target" ] && continue
    [ -e "$target" ] || echo "MISSING ($f): $target"
  done
done
```

bash で実行する（fish ではブラケット展開で失敗する）: `bash -c '<上のスクリプト>'` でラップしてもよい。

#### 4-4. LICENSE / 著作権年・権利者

```bash
head -5 LICENSE
git diff -- LICENSE   # 未コミットの変更がないか
```

- 年が古い、権利者名が空欄／別人になっていないか
- 変更が未コミットなら push 前にコミット要
- AGENTS §4 で `LICENSE` は AI 編集禁止。**問題があれば指摘するだけで触らない**

#### 4-5. コミットメッセージの質と作者情報

```bash
git log --pretty=format:'%h %an <%ae> %s' | head -30
```

- 作者メールが個人プライベートアドレスでないか（GitHub noreply 推奨）
- メッセージに秘匿情報・社内用語・愚痴が混ざっていないか
- AGENTS §9 の Conventional Commits に沿っているか

#### 4-6. リポジトリ識別子の一貫性

旧プロジェクト名・プレースホルダー URL・`<owner>/<repo>` 風の置き換え忘れを検出する。

```bash
# 実リポジトリ URL を取得
ORIGIN=$(git remote get-url origin 2>/dev/null)
echo "origin: $ORIGIN"

# プレースホルダー URL の検出
SCAN='--exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist'
grep -rnE 'example\.com|github\.com/example|github\.com/<[^>]+>|/<owner>/|/<repo>/' \
  $SCAN --include='*.md' --include='*.json' --include='*.js' --include='*.yml' --include='*.toml' .

# 旧プロジェクト名の検出（プロジェクトに合わせて NAMES を編集）
NAMES='x-scroll-limiter|x-scroll-limited|old-project-name'
grep -rnE "$NAMES" $SCAN \
  --include='*.md' --include='*.json' --include='*.js' --include='*.yml' --include='*.toml' --include='*.sh' .
```

→ CSS クラス名や DOM id プレフィックスとしての旧名は意図的なケースがある（X OFF では `x-scroll-limiter-` プレフィックスが AGENTS §6 で規定済み）。**コード内の DOM/CSS 識別子は許容**、ドキュメント／ビルド設定／URL の旧名は要修正。

### 5. プロジェクト固有 (X OFF / Chrome 拡張)

#### 5-1. PRIVACY.md と実装の整合性

PRIVACY.md は「外部送信なし、`chrome.storage.local` のみ」を宣言。**実装がこの宣言に反していないか**を確認:

```bash
SCAN='--exclude-dir=.git --exclude-dir=.claude --exclude-dir=dist'

# 外部通信
grep -rnE '\bfetch\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket\(' $SCAN src/

# トラッキング SDK
grep -rniE 'google-analytics|googletagmanager|sentry|datadog|mixpanel|amplitude|segment\.com' $SCAN src/

# storage.sync 利用（PRIVACY.md は local のみ宣言）
grep -rnE 'chrome\.storage\.sync' $SCAN src/
```

→ 宣言と実装が乖離していたら**法的リスクなので NG**。AGENTS §8「プライバシーポリシーの実質的な変更は人間のみ」に該当する判断が必要。

#### 5-2. manifest.json の妥当性

```bash
test -f src/manifest.json && cat src/manifest.json
```

確認項目:

- `name` / `description` が「test」「sample」等の仮名になっていない（`__MSG_*__` 参照は OK）
- `version` が `0.0.0` 等の暫定値でない（公開なら 1.0.0 以上）
- `permissions` が `storage` のみ（AGENTS の宣言と一致）
- `host_permissions` が `https://x.com/*`, `https://twitter.com/*` 以外を含んでいないか
- `manifest_version` が `3`

#### 5-3. _locales の整合性

```bash
ls src/_locales/
# en と ja のキー集合を比較（jq があれば）
diff <(jq -r 'keys[]' src/_locales/en/messages.json | sort) \
     <(jq -r 'keys[]' src/_locales/ja/messages.json | sort)

# jq がない場合の代替
diff <(python3 -c "import json; print('\n'.join(sorted(json.load(open('src/_locales/en/messages.json')).keys())))") \
     <(python3 -c "import json; print('\n'.join(sorted(json.load(open('src/_locales/ja/messages.json')).keys())))")
```

→ キーの欠損は表示崩れ。AGENTS lint (`mise run lint`) でも検出される。

#### 5-4. dist/ や zip がコミットされていないか

```bash
git ls-files | grep -E '^dist/|\.zip$'
git ls-files --others --exclude-standard | grep -E '^dist/|\.zip$'
```

→ あれば NG（`.gitignore` 対象）。

### 6. 最終出力フォーマット

すべてのセクションを実行したあと、以下の構造で報告する。

```markdown
## push 可否判定: ✅ Go / ⚠️ 条件付き Go / ❌ No-Go

### 致命的問題（Blocker — 修正なしで push 不可）
- [ ] <何が／どこで／なぜ問題か／どう直すか>

### 要確認（人間の判断が必要 / push 前修正推奨）
- [ ] ...

### 軽微（push 後でも可）
- [ ] ...

### チェック済みで問題なし
- 観点 1: シークレット・秘匿情報
- 観点 2: .gitignore の正しさ
- 観点 3: 残骸・未完成
- 観点 4: リポジトリ整合性
- 観点 5: プロジェクト固有

### 補足
- リモート: <URL>
- ブランチ: <branch>
- 対象スコープ: A 差分 push / B 初回 push / C ハイブリッド
- 対象差分: <range or 全コミット>
- 履歴コミット数: <N>
```

#### 判定基準

| 判定               | 条件                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| ❌ **No-Go**       | シークレット流出 / PRIVACY.md 違反 / Manifest V3 CSP 違反 / 過去履歴に秘匿情報混入 / 個人 PII 漏洩 のいずれか              |
| ⚠️ **条件付き Go** | ドキュメントリンク切れ / プレースホルダー URL 残存 / 旧プロジェクト名残骸 / アイコン仮素材 / `console.log` 残存 / `TODO` 整理推奨 のいずれか |
| ✅ **Go**          | 上記すべてクリア                                                                                                           |

各項目には**何が／どこで／なぜ問題か／どう直すか**の 4 点を必ず書く。1 点でも欠けていると次のレビュアが判断できない。

### 7. やってはいけないこと

- 自動で `git rm --cached` や `git filter-repo` を実行しない（影響範囲が大きい）
- 自動で `.gitignore` を書き換えない（提案だけ）
- `git push` は絶対に実行しない（AGENTS §8 で人間担当）
- `LICENSE` を編集しない（AGENTS §4）
- `store-assets/` の画像を差し替えない（AGENTS §4）
- 「とりあえず動かす」目的で `--no-verify` 等の hook 回避を提案しない

問題が見つかったら、**何を、どこで、なぜ問題か、どう直すか**の 4 点を報告するに留める。
