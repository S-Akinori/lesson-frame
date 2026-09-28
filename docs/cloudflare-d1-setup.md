# Cloudflare D1 セットアップガイド

Lesson Frameでは、プロジェクト、共有素材のメタデータ、テンプレートをCloudflare D1へ保存します。画像、チャンク音声、BGMなどのファイル本体はCloudflare R2へ保存し、D1にはR2のオブジェクトキーや設定情報だけを保存します。

このアプリはVercel上のNext.jsサーバーからCloudflare D1 REST APIを呼び出します。そのため、Cloudflare Workerの作成やD1 Bindingの設定は不要です。

## 全体構成

```text
ブラウザ
  └─ Vercel / Next.js API Route
       ├─ Cloudflare D1 REST API: プロジェクト・素材情報・テンプレート
       └─ Cloudflare R2: 画像・音声・BGMのファイル本体
```

D1には次の3テーブルを作成します。

| テーブル | 保存内容 |
| --- | --- |
| `lesson_projects` | プロジェクト名、台本、チャンク、ナレーター、画面設定など |
| `lesson_assets` | 複数プロジェクトで再利用する画像・BGMの名前、種類、R2キーなど |
| `lesson_templates` | デフォルトナレーター、読み上げ方、BGM、初期チャンク |

## 事前に用意するもの

- Cloudflareアカウント
- Vercelへデプロイ済み、またはデプロイ予定のLesson Frameプロジェクト
- ローカルで確認する場合はNode.jsとnpm
- 素材も別端末から利用する場合はCloudflare R2の設定

## 1. D1データベースを作成する

### Cloudflare Dashboardから作成する方法

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)へログインします。
2. 使用するCloudflareアカウントを選択します。
3. 左メニューの「Storage & Databases」から「D1 SQL Database」を開きます。
4. 「Create database」を押します。
5. Database nameへ `lesson-frame` と入力します。
6. Locationは通常「Automatic」のままで問題ありません。主な利用者が日本国内の場合は、選択肢が表示されればアジアに近いLocation hintを選べます。
7. 「Create」を押します。

作成後に表示されるDatabase IDを控えてください。Database IDはデータベースのOverviewまたはSettingsでも確認できるUUID形式の値です。

```text
例: 01234567-89ab-cdef-0123-456789abcdef
```

データベース名ではなく、必ずDatabase IDを環境変数へ設定します。

### Wrangler CLIから作成する方法（任意）

Dashboardを使う場合、この手順は不要です。

```powershell
npx wrangler@latest login
npx wrangler@latest d1 create lesson-frame
```

コマンドの出力にある `database_id` を控えます。このアプリはREST APIで接続するため、出力されたD1 Bindingを `wrangler.jsonc` へ追加する必要はありません。

## 2. Cloudflare Account IDを確認する

Cloudflare Dashboardで対象アカウントを開き、次のいずれかからAccount IDを確認します。

- アカウントのホーム画面にあるAccount ID
- Workers & PagesのOverviewにあるAccount ID
- ブラウザURL中のアカウント識別子

Account IDは通常32文字の英数字です。Zone IDやDatabase IDとは異なります。

R2用の `R2_ACCOUNT_ID` がすでに設定されている場合、同じCloudflareアカウントであればこのアプリはそれをD1にも利用できます。ただし、設定を分かりやすくするため `CLOUDFLARE_ACCOUNT_ID` を明示することを推奨します。

## 3. D1用API Tokenを作成する

1. Cloudflare Dashboard右上のユーザーアイコンから「My Profile」を開きます。
2. 「API Tokens」を開きます。
3. 「Create Token」を押します。
4. 「Create Custom Token」を選択します。
5. Token nameへ `lesson-frame-d1` など用途が分かる名前を入力します。
6. Permissionsへ次を設定します。

```text
Account / D1 / Edit
```

UI上でReadとWriteが個別に表示される場合は、対象D1へ読み書きできるようD1 ReadとD1 Writeを許可します。プロジェクトの保存、テーブル作成、テンプレート登録を行うため、読み取り専用権限では動作しません。

7. Account Resourcesは「Include」→対象のCloudflareアカウントだけを指定します。
8. Client IP Address FilteringとTTLは、運用要件がなければ未設定で構いません。Vercelの送信元IPは固定とは限らないため、安易なIP制限は避けてください。
9. 「Continue to summary」→「Create Token」を押します。
10. 表示されたトークンを安全な場所へコピーします。

API Tokenのシークレットは作成直後に一度だけ表示されます。Git、ソースコード、`NEXT_PUBLIC_`で始まる環境変数、チャット、スクリーンショットへ含めないでください。

必要なら、作成画面に表示される検証コマンド、または次のCloudflare APIで有効性を確認できます。

```bash
curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  --header "Authorization: Bearer YOUR_API_TOKEN"
```

レスポンスの `success` が `true`、`result.status` が `active` ならトークン自体は有効です。

## 4. テーブルを作成する

アプリは初回アクセス時に `CREATE TABLE IF NOT EXISTS` を実行するため、通常は手動作成不要です。ただし、デプロイ前に接続と権限を確認できるため、次のいずれかで事前にスキーマを適用することを推奨します。

スキーマファイルは [`cloudflare/d1/schema.sql`](../cloudflare/d1/schema.sql) です。

### DashboardのConsoleで作成する

1. Cloudflare Dashboardで作成した `lesson-frame` データベースを開きます。
2. 「Console」を開きます。
3. `cloudflare/d1/schema.sql` の内容を貼り付けます。
4. 「Execute」または「Run」を押します。
5. エラーなく完了したことを確認します。

### Wranglerで作成する

リポジトリのルートで次を実行します。

```powershell
npx wrangler@latest d1 execute lesson-frame --remote --file=cloudflare/d1/schema.sql
```

`--remote` はCloudflare上の本番D1へ適用する指定です。これを省略すると、WranglerのローカルD1へ適用される場合があります。

テーブルを確認する場合は次を実行します。

```powershell
npx wrangler@latest d1 execute lesson-frame --remote --command="SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name;"
```

`lesson_projects`、`lesson_assets`、`lesson_templates` が表示されれば完了です。

## 5. ローカル開発用の環境変数を設定する

プロジェクトルートへ `.env.local` を作成し、次の値を設定します。

```dotenv
CLOUDFLARE_ACCOUNT_ID=CloudflareのAccount ID
CLOUDFLARE_D1_DATABASE_ID=D1のDatabase ID
CLOUDFLARE_D1_API_TOKEN=作成したAPI Token
```

R2も利用する場合は、同じファイルにR2用の環境変数を設定します。値の一覧は [`.env.template`](../.env.template) を参照してください。

環境変数を変更した後は開発サーバーを再起動します。

```powershell
npm run dev
```

`.env.local` はGitへコミットしないでください。

## 6. Vercelへ環境変数を登録する

1. [Vercel Dashboard](https://vercel.com/dashboard)で対象プロジェクトを開きます。
2. 「Settings」→「Environment Variables」を開きます。
3. 次の3件を追加します。

| Name | Value | 秘密情報 |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | いいえ |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 Database ID | いいえ |
| `CLOUDFLARE_D1_API_TOKEN` | D1 API Token | はい |

4. Production、Preview、Developmentのうち、利用する環境を選択します。通常は3環境すべてに設定します。
5. 保存後、最新デプロイをRedeployします。

Vercelの環境変数変更は既存デプロイへ自動反映されません。必ず再デプロイしてください。

環境変数名へ `NEXT_PUBLIC_` を付けないでください。D1 API Tokenはサーバー側だけで使用し、ブラウザへ公開してはいけません。

## 7. 接続を確認する

再デプロイ後、次の順で確認します。

1. Lesson Frameのプロジェクト一覧を開きます。
2. 新規プロジェクトを1件作成します。
3. プロジェクト名または台本を編集します。
4. ヘッダーの保存状態が「保存済み」になるまで約1秒待ちます。
5. ページを再読み込みし、作成したプロジェクトが一覧へ残っていることを確認します。
6. Cloudflare D1 Consoleで次を実行します。

```sql
SELECT id, title, created_at, updated_at
FROM lesson_projects
ORDER BY updated_at DESC;
```

行が表示されればVercelからD1への保存は成功しています。

共有素材をR2へアップロードした後は、次でも確認できます。

```sql
SELECT id, name, kind, storage_key, updated_at
FROM lesson_assets
ORDER BY updated_at DESC;
```

テンプレートを保存した後は、次でも確認できます。

```sql
SELECT id, name, created_at, updated_at
FROM lesson_templates
ORDER BY updated_at DESC;
```

## D1とR2の役割

| データ | 保存先 | 理由 |
| --- | --- | --- |
| プロジェクト設定・台本・チャンク | D1 | JSONや検索用情報として保存できる |
| 共有素材の名前・種類・R2キー | D1 | プロジェクトをまたいで一覧表示するため |
| テンプレート | D1 | 新規プロジェクト作成時に呼び出すため |
| 画像・音声・BGM本体 | R2 | 大きなバイナリを安価に保存するため |
| 書き出したMP4 | 保存しない | ブラウザへ直接返してダウンロードする仕様のため |

R2へアップロードできず `data:` または `blob:` URLとしてブラウザ内だけに存在する素材は、他の端末やプロジェクトから再利用できません。共有素材とテンプレートBGMを利用するにはD1とR2の両方が必要です。

## よくあるエラー

### 画面に「Cloudflare D1へ接続できない」と表示される

- 3つの環境変数名にタイプミスがないか
- Vercelへ値を保存した後に再デプロイしたか
- Previewだけ、またはProductionだけに環境変数を設定していないか
- `CLOUDFLARE_ACCOUNT_ID`がD1を所有するアカウントのIDか
- Database IDへデータベース名を入れていないか
- API Tokenが失効していないか

接続できない場合、アプリはブラウザのローカルストレージへフォールバックします。この状態では別ブラウザや別端末へデータは共有されません。

### Cloudflare APIが401を返す

API Tokenが不正、失効、または環境変数へ正しく保存されていません。トークン検証APIで `active` か確認し、必要なら新しいトークンを作成してください。

### Cloudflare APIが403を返す

トークンのD1権限またはAccount Resourcesが不足しています。対象アカウントに対するD1 Edit権限を確認してください。

### `no such table` と表示される

API Tokenに書き込み権限がなく自動作成に失敗しているか、スキーマが未適用です。D1 ConsoleまたはWranglerで `cloudflare/d1/schema.sql` を実行してください。

### 保存後にデータが消える

画面上部の保存状態を確認してください。「ローカル保存」の場合はD1ではなくブラウザに保存されています。Vercel Function Logsで `/api/projects` のエラーを確認してください。

### 素材が別プロジェクトで表示されない

D1だけでなくR2設定も必要です。素材のファイル本体がR2へ保存できた場合だけ、共有素材ライブラリへ登録されます。R2の環境変数とCORS設定も確認してください。

## セキュリティと運用上の注意

- API TokenはD1を所有する1アカウントだけに限定してください。
- Global API Keyは使用せず、用途を限定したAPI Tokenを使用してください。
- API Tokenは定期的にローテーションしてください。
- トークンを変更したらVercelの環境変数を更新し、再デプロイしてください。
- 本番データを操作するSQLは、実行前に対象データベースとWHERE条件を確認してください。
- 現在のD1データはデプロイを利用する全員に共有されます。複数ユーザーへ公開する場合は、認証とユーザー単位のデータ分離を追加してください。

## 参考リンク

- [Cloudflare D1 overview](https://developers.cloudflare.com/d1/)
- [Cloudflare D1 getting started](https://developers.cloudflare.com/d1/get-started/)
- [Cloudflare D1 REST query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)
- [Cloudflare API Tokenの作成](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Vercel環境変数](https://vercel.com/docs/environment-variables)
