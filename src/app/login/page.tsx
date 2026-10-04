import type {Metadata} from "next";
import {isSitePasswordConfigured} from "@/lib/site-auth";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "ログイン — Lesson Frame",
  description: "Lesson Frameのプライベートログイン画面",
};

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function LoginPage({searchParams}: LoginPageProps) {
  const params = await searchParams;
  const error = firstValue(params.error);
  const setup = firstValue(params.setup);
  const next = firstValue(params.next) ?? "/";
  const configured = isSitePasswordConfigured();

  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-labelledby="login-title">
        <div className={styles.brand}><span>LF</span><strong>Lesson Frame</strong></div>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Private studio</p>
          <h1 id="login-title">制作環境に<br />アクセスする</h1>
          <p>このスタジオは個人用です。設定したパスワードを入力すると、プロジェクトと素材へアクセスできます。</p>
        </div>
        <p className={styles.note}>Session protection · 30 days</p>
      </section>

      <section className={styles.formPanel} aria-label="ログインフォーム">
        <div className={styles.formHeader}>
          <span className={styles.index}>01</span>
          <div><p>Authentication</p><h2>パスワードを入力</h2></div>
        </div>

        <form className={styles.form} action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="site-password">サイトパスワード</label>
          <input
            id="site-password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            disabled={!configured}
            aria-describedby="password-help"
          />
          <p id="password-help" className={styles.help}>Vercelの環境変数 <code>SITE_PASSWORD</code> に設定した値を入力してください。</p>

          {error === "invalid" ? <p className={styles.error} role="alert">パスワードが一致しません。もう一度確認してください。</p> : null}
          {(!configured || setup === "required") ? <p className={styles.error} role="alert">SITE_PASSWORDが未設定です。環境変数を追加して再デプロイしてください。</p> : null}

          <button type="submit" disabled={!configured}>
            <span>スタジオを開く</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className={styles.security}>パスワードはブラウザへ保存せず、安全な認証Cookieのみを発行します。</p>
      </section>
    </main>
  );
}
