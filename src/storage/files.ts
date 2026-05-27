import * as FileSystem from "expo-file-system/legacy";
import { StoredFile, Snippet } from "../types";
import { createId, extensionForLanguage, slugify } from "../utils/id";

const root = `${FileSystem.documentDirectory ?? ""}SnippetKeeper/`;

export const directories = {
  root,
  attachments: `${root}attachments/`,
  exports: `${root}exports/`,
  code: `${root}code/`,
  resources: `${root}resources/`,
  templates: `${root}templates/`
};

const templateFiles = [
  {
    name: "react-native-hook.tsx",
    body: `import { useEffect, useState } from "react";

export function useAsyncValue<T>(loader: () => Promise<T>, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loader()
      .then((nextValue) => {
        if (mounted) {
          setValue(nextValue);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loader]);

  return { value, loading };
}
`
  },
  {
    name: "sqlite-migration.sql",
    body: `PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS example (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`
  },
  {
    name: "fetch-json.ts",
    body: `export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(\`Request failed with status \${response.status}\`);
  }

  return response.json() as Promise<T>;
}
`
  }
];

async function ensureDirectory(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

export async function initializeFiles() {
  await Promise.all(Object.values(directories).map(ensureDirectory));
}

export async function installTemplates() {
  await initializeFiles();

  await Promise.all(
    templateFiles.map(async (file) => {
      const uri = `${directories.templates}${file.name}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        await FileSystem.writeAsStringAsync(uri, file.body, {
          encoding: FileSystem.EncodingType.UTF8
        });
      }
    })
  );
}

export async function listFiles(uri = directories.root): Promise<StoredFile[]> {
  await initializeFiles();
  const names = await FileSystem.readDirectoryAsync(uri);

  const files = await Promise.all(
    names.map(async (name) => {
      const childUri = `${uri}${name}`;
      const info = await FileSystem.getInfoAsync(childUri);

      return {
        name,
        uri: info.isDirectory ? `${childUri}/` : childUri,
        isDirectory: Boolean(info.isDirectory),
        size: info.exists && !info.isDirectory ? info.size : undefined,
        modificationTime: info.exists ? info.modificationTime : undefined
      };
    })
  );

  return files.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

export async function copyAttachmentToAppStorage(sourceUri: string, snippetId: string) {
  await initializeFiles();
  const extension = sourceUri.split(".").pop()?.split("?")[0] || "jpg";
  const name = `${snippetId}-${createId("shot")}.${extension}`;
  const destination = `${directories.attachments}${name}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return { uri: destination, name };
}

export async function saveCodeFile(snippet: Snippet) {
  await initializeFiles();
  const extension = extensionForLanguage(snippet.language);
  const name = `${slugify(snippet.title)}.${extension}`;
  const uri = `${directories.code}${name}`;
  await FileSystem.writeAsStringAsync(uri, snippet.code, {
    encoding: FileSystem.EncodingType.UTF8
  });
  return uri;
}

export async function exportSnippet(snippet: Snippet, format: "txt" | "js" | "json") {
  await initializeFiles();
  const base = slugify(snippet.title);
  const uri = `${directories.exports}${base}.${format}`;

  const body =
    format === "json"
      ? JSON.stringify(snippet, null, 2)
      : format === "js"
        ? `// ${snippet.title}\n// Language: ${snippet.language}\n// Tags: ${snippet.tags.join(", ")}\n\n${snippet.code}\n`
        : `${snippet.title}\nLanguage: ${snippet.language}\nTags: ${snippet.tags.join(", ")}\n\n${snippet.code}\n`;

  await FileSystem.writeAsStringAsync(uri, body, {
    encoding: FileSystem.EncodingType.UTF8
  });

  return uri;
}

export async function deleteFile(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

export async function copyFileToDirectory(fileUri: string, directoryUri: string) {
  await ensureDirectory(directoryUri);
  const name = fileUri.replace(/\/$/, "").split("/").pop() || createId("file");
  const destination = `${directoryUri}${name}`;
  await FileSystem.copyAsync({ from: fileUri, to: destination });
  return destination;
}

export async function moveFileToDirectory(fileUri: string, directoryUri: string) {
  await ensureDirectory(directoryUri);
  const name = fileUri.replace(/\/$/, "").split("/").pop() || createId("file");
  const destination = `${directoryUri}${name}`;
  await FileSystem.moveAsync({ from: fileUri, to: destination });
  return destination;
}

export function parentDirectory(uri: string) {
  const normalized = uri.endsWith("/") ? uri.slice(0, -1) : uri;
  const parent = normalized.slice(0, normalized.lastIndexOf("/") + 1);
  return parent.startsWith(directories.root) ? parent : directories.root;
}
