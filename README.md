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
- 本番レンダリング: Vercel Sandbox推奨

`/api/render`はローカル検証用の同一プロセスレンダラーも備えています。Vercel Sandboxへ移す場合は、このルートの`renderMedia()`処理をSandbox内コマンドに置き換え、入力JSONとR2キーを渡します。UIとRemotionコンポジションは変更不要です。
