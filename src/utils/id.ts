export function createId(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function slugify(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "untitled";
}

export function extensionForLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  const map: Record<string, string> = {
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    react: "tsx",
    "react native": "tsx",
    python: "py",
    java: "java",
    kotlin: "kt",
    swift: "swift",
    go: "go",
    rust: "rs",
    csharp: "cs",
    "c#": "cs",
    cpp: "cpp",
    "c++": "cpp",
    html: "html",
    css: "css",
    sql: "sql",
    json: "json",
    bash: "sh",
    shell: "sh"
  };

  return map[normalized] ?? "txt";
}
