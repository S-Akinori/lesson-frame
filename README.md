# Lesson Frame

高校生向け解説動画を、台本・画像・Gemini TTSから生成するNext.js + Remotionアプリです。

## 実装済み

- 1行1チャンクの台本分割、追加、削除、並べ替え
- 表示文と読み上げ文の分離
- KaTeXによるインライン・ブロック数式
- 画像の有無に応じた自動レイアウト
- プロジェクト共通の背景画像アップロード
- 画像なしではテキスト中央、画像ありではテキスト上・画像下の自動配置
- 静止テキスト表示（登場アニメーションなし）
- Remotion Playerと最終MP4で共通のコンポジション
- Gemini TTSによるチャンク単位の音声生成
- Cloudflare R2への素材・音声・MP4保存
- ローカル環境でのMP4レンダリング
- ブラウザへの編集内容の自動保存
- Remotion用JSONのダウンロード・アップロード

## Remotion用JSON

画面右上の「JSON保存」から、現在のプロジェクトをRemotionの入力props形式で保存できます。「JSON読込」では、保存したファイルまたは従来の生プロジェクトJSONを読み込めます。読み込み時は項目・型・値の範囲を検証し、不正なファイルは現在の編集内容へ反映しません。

書き出されるJSONは、ルートの`project`プロパティにプロジェクト全体を格納した、Remotion CLIの`--props`でそのまま利用できる形式です。

## セットアップ

```bash
npm install
cp .env.template .env.local
npm run dev
```

Windowsでは`.env.template`を`.env.local`へコピーして値を設定してください。

### サイトパスワード

```dotenv
SITE_PASSWORD=十分に長い推測されにくいパスワード
```

`SITE_PASSWORD`は必須です。未設定時は安全側に倒し、ログイン画面から先へ進めません。ログイン後はHttpOnlyの認証Cookieが30日間有効です。パスワードを変更して再デプロイすると、発行済みの認証Cookieも無効になります。

Vercelではプロジェクトの「Settings」→「Environment Variables」に`SITE_PASSWORD`を追加し、Production・Preview・Developmentの必要な環境を選択してから再デプロイしてください。値はリポジトリへコミットしないでください。

### Gemini TTS

```dotenv
GEMINI_API_KEY=...
GEMINI_TTS_MODEL=gemini-3.8-flash-lite-tts
```

APIキー未設定でも、推定尺を使った編集・数式・プレビューは動作します。

### Cloudflare R2

```dotenv
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=lesson-frame
R2_PUBLIC_BASE_URL=
```

`R2_PUBLIC_BASE_URL`は任意です。未設定時は期限付き読み取りURLを発行します。R2未設定の開発環境では画像・音声をブラウザ内に保持し、完成MP4を`public/renders`へ保存します。本番環境のMP4出力にはR2設定が必要です。

ブラウザから署名付きURLへ直接アップロードするため、R2バケットのCORSにはローカルURLと本番URLを登録してください。

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-project.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

独自ドメインを利用する場合は、そのオリジンも`AllowedOrigins`へ追加します。環境変数やCORSを変更した後は、Vercelを再デプロイしてください。

## コマンド

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run render:demo
```

## デプロイ方針

- Next.js UI/API: Vercel
- 画像・WAV・MP4: Cloudflare R2
- MP4レンダリング: 利用中のブラウザ（WebCodecs）

MP4はRemotionのブラウザレンダラーを使い、利用中のPCで生成します。完成動画はVercel FunctionsやR2を経由せず、そのままブラウザから保存できます。WebCodecs対応の最新版Chromeを推奨します。
