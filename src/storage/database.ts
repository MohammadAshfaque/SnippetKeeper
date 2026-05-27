import * as SQLite from "expo-sqlite";
import { Attachment, AiResponse, Snippet, SnippetInput } from "../types";
import { createId } from "../utils/id";

type SnippetRow = {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string;
  favorite: number;
  explanation: string | null;
  summary: string | null;
  suggestions: string | null;
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  snippet_id: string;
  file_uri: string;
  name: string;
  type: string;
  created_at: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("snippetkeeper.db");
  }

  return dbPromise;
}

function parseTags(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapSnippet(row: SnippetRow): Snippet {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    language: row.language,
    tags: parseTags(row.tags),
    favorite: row.favorite === 1,
    explanation: row.explanation,
    summary: row.summary,
    suggestions: row.suggestions,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    snippetId: row.snippet_id,
    fileUri: row.file_uri,
    name: row.name,
    type: row.type,
    createdAt: row.created_at
  };
}

export async function initializeDatabase() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      language TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      favorite INTEGER NOT NULL DEFAULT 0,
      explanation TEXT,
      summary TEXT,
      suggestions TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY NOT NULL,
      snippet_id TEXT NOT NULL,
      file_uri TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language);
    CREATE INDEX IF NOT EXISTS idx_snippets_favorite ON snippets(favorite);
    CREATE INDEX IF NOT EXISTS idx_attachments_snippet ON attachments(snippet_id);
  `);
}

export async function listSnippets(searchTerm = "", favoritesOnly = false) {
  const db = await getDatabase();
  const query = `%${searchTerm.trim().toLowerCase()}%`;
  const favoriteClause = favoritesOnly ? "AND favorite = 1" : "";

  const rows = await db.getAllAsync<SnippetRow>(
    `
      SELECT * FROM snippets
      WHERE (
        LOWER(title) LIKE ?
        OR LOWER(code) LIKE ?
        OR LOWER(language) LIKE ?
        OR LOWER(tags) LIKE ?
      )
      ${favoriteClause}
      ORDER BY favorite DESC, updated_at DESC;
    `,
    query,
    query,
    query,
    query
  );

  return rows.map(mapSnippet);
}

export async function getSnippet(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SnippetRow>(
    "SELECT * FROM snippets WHERE id = ?;",
    id
  );

  return row ? mapSnippet(row) : null;
}

export async function createSnippet(input: SnippetInput) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const snippet: Snippet = {
    id: createId("snippet"),
    title: input.title.trim(),
    code: input.code,
    language: input.language.trim(),
    tags: input.tags,
    favorite: false,
    createdAt: now,
    updatedAt: now
  };

  await db.runAsync(
    `
      INSERT INTO snippets
        (id, title, code, language, tags, favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `,
    snippet.id,
    snippet.title,
    snippet.code,
    snippet.language,
    JSON.stringify(snippet.tags),
    0,
    snippet.createdAt,
    snippet.updatedAt
  );

  return snippet;
}

export async function updateSnippet(id: string, input: SnippetInput) {
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE snippets
      SET title = ?, code = ?, language = ?, tags = ?, updated_at = ?
      WHERE id = ?;
    `,
    input.title.trim(),
    input.code,
    input.language.trim(),
    JSON.stringify(input.tags),
    updatedAt,
    id
  );

  return getSnippet(id);
}

export async function deleteSnippet(id: string) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM snippets WHERE id = ?;", id);
}

export async function setFavorite(id: string, favorite: boolean) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE snippets SET favorite = ?, updated_at = ? WHERE id = ?;",
    favorite ? 1 : 0,
    new Date().toISOString(),
    id
  );
}

export async function saveAiResponse(id: string, response: AiResponse) {
  const db = await getDatabase();
  await db.runAsync(
    `
      UPDATE snippets
      SET explanation = ?, summary = ?, suggestions = ?, updated_at = ?
      WHERE id = ?;
    `,
    response.explanation,
    response.summary,
    response.suggestions,
    new Date().toISOString(),
    id
  );
}

export async function addAttachment(
  snippetId: string,
  fileUri: string,
  name: string,
  type: string
) {
  const db = await getDatabase();
  const attachment: Attachment = {
    id: createId("attachment"),
    snippetId,
    fileUri,
    name,
    type,
    createdAt: new Date().toISOString()
  };

  await db.runAsync(
    `
      INSERT INTO attachments
        (id, snippet_id, file_uri, name, type, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `,
    attachment.id,
    attachment.snippetId,
    attachment.fileUri,
    attachment.name,
    attachment.type,
    attachment.createdAt
  );

  return attachment;
}

export async function listAttachments(snippetId: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AttachmentRow>(
    "SELECT * FROM attachments WHERE snippet_id = ? ORDER BY created_at DESC;",
    snippetId
  );

  return rows.map(mapAttachment);
}

export async function deleteAttachment(id: string) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM attachments WHERE id = ?;", id);
}
