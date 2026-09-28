type D1Row = Record<string, unknown>;

type D1QueryResult<T extends D1Row> = {
  results?: T[];
  success: boolean;
};

type D1Response<T extends D1Row> = {
  success: boolean;
  result?: D1QueryResult<T>[];
  errors?: Array<{message?: string}>;
};

const config = () => ({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID,
  databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
  apiToken: process.env.CLOUDFLARE_D1_API_TOKEN,
});

export const isD1Configured = () => Object.values(config()).every(Boolean);

const executeD1 = async <T extends D1Row>(sql: string, params: unknown[] = []) => {
  const {accountId, databaseId, apiToken} = config();
  if (!accountId || !databaseId || !apiToken) {
    throw new Error("Cloudflare D1が未設定です。");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({sql, params}),
      cache: "no-store",
    },
  );
  const result = await response.json() as D1Response<T>;
  const query = result.result?.[0];
  if (!response.ok || !result.success || !query?.success) {
    throw new Error(result.errors?.[0]?.message ?? "Cloudflare D1への問い合わせに失敗しました。");
  }
  return query.results ?? [];
};

declare global {
  var __lessonFrameD1Ready: Promise<void> | undefined;
  var __lessonFrameD1SchemaVersion: number | undefined;
}

const D1_SCHEMA_VERSION = 2;

const ensureProjectsTable = async () => {
  if (!globalThis.__lessonFrameD1Ready || globalThis.__lessonFrameD1SchemaVersion !== D1_SCHEMA_VERSION) {
    globalThis.__lessonFrameD1Ready = (async () => {
      await Promise.all([
        executeD1(`
          CREATE TABLE IF NOT EXISTS lesson_projects (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            project_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
        executeD1(`
          CREATE TABLE IF NOT EXISTS lesson_assets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            storage_key TEXT NOT NULL UNIQUE,
            content_hash TEXT,
            source_url TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
        executeD1(`
          CREATE TABLE IF NOT EXISTS lesson_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            template_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
      ]);
      try {
        await executeD1("ALTER TABLE lesson_assets ADD COLUMN content_hash TEXT");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.toLowerCase().includes("duplicate column")) throw error;
      }
      await executeD1(`
        CREATE UNIQUE INDEX IF NOT EXISTS lesson_assets_content_hash
        ON lesson_assets(content_hash)
        WHERE content_hash IS NOT NULL
      `);
      globalThis.__lessonFrameD1SchemaVersion = D1_SCHEMA_VERSION;
    })().catch((error) => {
      globalThis.__lessonFrameD1Ready = undefined;
      globalThis.__lessonFrameD1SchemaVersion = undefined;
      throw error;
    });
  }
  await globalThis.__lessonFrameD1Ready;
};

export const queryProjects = async <T extends D1Row>(sql: string, params: unknown[] = []) => {
  await ensureProjectsTable();
  return executeD1<T>(sql, params);
};
