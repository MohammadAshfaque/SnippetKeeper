export type Snippet = {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
  favorite: boolean;
  explanation?: string | null;
  summary?: string | null;
  suggestions?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SnippetInput = {
  title: string;
  code: string;
  language: string;
  tags: string[];
};

export type Attachment = {
  id: string;
  snippetId: string;
  fileUri: string;
  name: string;
  type: string;
  createdAt: string;
};

export type AiResponse = {
  explanation: string;
  summary: string;
  suggestions: string;
};

export type AppPreferences = {
  theme: "system" | "light" | "dark";
  defaultLanguage: string;
  aiEndpoint: string;
  aiModel: string;
};

export type StoredFile = {
  name: string;
  uri: string;
  isDirectory: boolean;
  size?: number;
  modificationTime?: number;
};

export type Screen =
  | "home"
  | "create"
  | "details"
  | "favorites"
  | "files"
  | "settings";
