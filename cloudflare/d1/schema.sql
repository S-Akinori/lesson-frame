CREATE TABLE IF NOT EXISTS lesson_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  project_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lesson_projects_updated_at
ON lesson_projects(updated_at DESC);

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
);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_assets_content_hash
ON lesson_assets(content_hash)
WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS lesson_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
