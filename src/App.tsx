import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View
} from "react-native";
import { Button, EmptyState, Field, Tag } from "./components/Controls";
import { explainSnippet } from "./services/ai";
import { shareFile, shareSnippetText } from "./services/share";
import {
  addAttachment,
  createSnippet,
  deleteAttachment,
  deleteSnippet,
  getSnippet,
  initializeDatabase,
  listAttachments,
  listSnippets,
  saveAiResponse,
  setFavorite,
  updateSnippet
} from "./storage/database";
import {
  copyAttachmentToAppStorage,
  copyFileToDirectory,
  deleteFile,
  directories,
  exportSnippet,
  initializeFiles,
  installTemplates,
  listFiles,
  moveFileToDirectory,
  parentDirectory,
  saveCodeFile
} from "./storage/files";
import {
  defaultPreferences,
  loadPreferences,
  savePreferences
} from "./storage/preferences";
import { getApiKey, saveApiKey } from "./storage/secrets";
import { paletteFor, spacing } from "./theme";
import {
  AppPreferences,
  Attachment,
  Screen,
  Snippet,
  SnippetInput,
  StoredFile
} from "./types";

type Palette = ReturnType<typeof paletteFor>;

const languageOptions = [
  "TypeScript",
  "JavaScript",
  "React Native",
  "Python",
  "SQL",
  "Bash",
  "JSON",
  "CSS"
];

function normalizeTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatBytes(size?: number) {
  if (!size) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function Header({
  palette,
  title,
  subtitle,
  action
}: {
  palette: Palette;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[styles.appName, { color: palette.primary }]}>SnippetKeeper</Text>
        <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>
      </View>
      {action}
    </View>
  );
}

function BottomTabs({
  active,
  palette,
  onNavigate
}: {
  active: Screen;
  palette: Palette;
  onNavigate: (screen: Screen) => void;
}) {
  const tabs: Array<{
    screen: Screen;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { screen: "home", label: "Home", icon: "albums-outline" },
    { screen: "favorites", label: "Favorites", icon: "star-outline" },
    { screen: "files", label: "Files", icon: "folder-open-outline" },
    { screen: "settings", label: "Settings", icon: "settings-outline" }
  ];

  return (
    <View style={[styles.tabs, { backgroundColor: palette.panel, borderColor: palette.border }]}>
      {tabs.map((tab) => {
        const isActive = active === tab.screen;
        return (
          <Pressable
            accessibilityRole="tab"
            key={tab.screen}
            onPress={() => onNavigate(tab.screen)}
            style={styles.tab}
          >
            <Ionicons
              color={isActive ? palette.primary : palette.muted}
              name={tab.icon}
              size={22}
            />
            <Text style={[styles.tabText, { color: isActive ? palette.primary : palette.muted }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SnippetCard({
  snippet,
  palette,
  onOpen,
  onFavorite
}: {
  snippet: Snippet;
  palette: Palette;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: palette.panel, borderColor: palette.border },
        pressed ? { opacity: 0.88 } : null
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text numberOfLines={1} style={[styles.cardTitle, { color: palette.ink }]}>
            {snippet.title}
          </Text>
          <Text style={[styles.cardMeta, { color: palette.muted }]}>
            {snippet.language} • {new Date(snippet.updatedAt).toLocaleDateString()}
          </Text>
        </View>
        <Pressable onPress={onFavorite} style={styles.iconButton}>
          <Ionicons
            color={snippet.favorite ? palette.warning : palette.muted}
            name={snippet.favorite ? "star" : "star-outline"}
            size={22}
          />
        </Pressable>
      </View>
      <Text numberOfLines={3} style={[styles.previewCode, { color: palette.codeText }]}>
        {snippet.code}
      </Text>
      <View style={styles.tagRow}>
        {snippet.tags.slice(0, 4).map((tag) => (
          <Tag key={tag} label={tag} palette={palette} />
        ))}
      </View>
    </Pressable>
  );
}

function SnippetForm({
  initialSnippet,
  palette,
  preferences,
  onCancel,
  onSubmit
}: {
  initialSnippet?: Snippet | null;
  palette: Palette;
  preferences: AppPreferences;
  onCancel: () => void;
  onSubmit: (input: SnippetInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialSnippet?.title ?? "");
  const [code, setCode] = useState(initialSnippet?.code ?? "");
  const [language, setLanguage] = useState(
    initialSnippet?.language ?? preferences.defaultLanguage
  );
  const [tags, setTags] = useState(initialSnippet?.tags.join(", ") ?? "");
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && code.trim().length > 0;

  async function submit() {
    if (!canSave) {
      Alert.alert("Missing details", "Add a title and code before saving.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        title,
        code,
        language,
        tags: normalizeTags(tags)
      });
    } catch (error) {
      Alert.alert("Could not save snippet", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <Header
        action={
          <Button
            icon="close-outline"
            label="Cancel"
            onPress={onCancel}
            palette={palette}
            variant="secondary"
          />
        }
        palette={palette}
        subtitle="Store reusable code with language and tags for quick retrieval."
        title={initialSnippet ? "Edit Snippet" : "Create Snippet"}
      />

      <View style={styles.stack}>
        <Field label="Title" onChangeText={setTitle} palette={palette} value={title} />
        <View style={styles.field}>
          <Text style={[styles.smallLabel, { color: palette.muted }]}>Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.segmentRow}>
              {languageOptions.map((option) => {
                const selected = option === language;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setLanguage(option)}
                    style={[
                      styles.segment,
                      {
                        backgroundColor: selected ? palette.primary : palette.panel,
                        borderColor: selected ? palette.primary : palette.border
                      }
                    ]}
                  >
                    <Text style={{ color: selected ? "#FFFFFF" : palette.ink, fontWeight: "700" }}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Field
            label="Custom language"
            onChangeText={setLanguage}
            palette={palette}
            value={language}
          />
        </View>
        <Field
          label="Tags"
          onChangeText={setTags}
          palette={palette}
          placeholder="hooks, auth, sqlite"
          value={tags}
        />
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          label="Code"
          multiline
          onChangeText={setCode}
          palette={palette}
          value={code}
        />
        <Button
          disabled={!canSave}
          icon="save-outline"
          label={initialSnippet ? "Update snippet" : "Save snippet"}
          loading={saving}
          onPress={submit}
          palette={palette}
        />
      </View>
    </ScrollView>
  );
}

function SnippetListScreen({
  favoritesOnly,
  palette,
  search,
  snippets,
  onCreate,
  onFavorite,
  onOpen,
  onSearch
}: {
  favoritesOnly: boolean;
  palette: Palette;
  search: string;
  snippets: Snippet[];
  onCreate: () => void;
  onFavorite: (snippet: Snippet) => void;
  onOpen: (snippet: Snippet) => void;
  onSearch: (value: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Header
        action={
          favoritesOnly ? null : (
            <Button icon="add-outline" label="New" onPress={onCreate} palette={palette} />
          )
        }
        palette={palette}
        subtitle={
          favoritesOnly
            ? "Your pinned code patterns, available offline."
            : "Search, save, export, and explain your local code library."
        }
        title={favoritesOnly ? "Favorites" : "Snippet Library"}
      />
      <Field
        autoCapitalize="none"
        label="Search snippets"
        onChangeText={onSearch}
        palette={palette}
        placeholder="Search title, code, language, or tag"
        value={search}
      />
      <View style={styles.stack}>
        {snippets.length === 0 ? (
          <EmptyState
            body={
              favoritesOnly
                ? "Mark snippets as favorites to keep them close."
                : "Create your first snippet and it will be saved in local SQLite storage."
            }
            palette={palette}
            title={favoritesOnly ? "No favorites yet" : "No snippets found"}
          />
        ) : (
          snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              onFavorite={() => onFavorite(snippet)}
              onOpen={() => onOpen(snippet)}
              palette={palette}
              snippet={snippet}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function DetailSection({
  title,
  children,
  palette
}: {
  title: string;
  children: React.ReactNode;
  palette: Palette;
}) {
  return (
    <View style={[styles.section, { backgroundColor: palette.panel, borderColor: palette.border }]}>
      <Text style={[styles.sectionTitle, { color: palette.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

function SnippetDetailsScreen({
  attachments,
  generating,
  palette,
  snippet,
  onAttach,
  onBack,
  onDelete,
  onDeleteAttachment,
  onEdit,
  onExplain,
  onExport,
  onFavorite,
  onSaveCode,
  onShareText
}: {
  attachments: Attachment[];
  generating: boolean;
  palette: Palette;
  snippet: Snippet;
  onAttach: () => void;
  onBack: () => void;
  onDelete: () => void;
  onDeleteAttachment: (attachment: Attachment) => void;
  onEdit: () => void;
  onExplain: () => void;
  onExport: (format: "txt" | "js" | "json") => void;
  onFavorite: () => void;
  onSaveCode: () => void;
  onShareText: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Header
        action={
          <Button icon="chevron-back-outline" label="Back" onPress={onBack} palette={palette} variant="secondary" />
        }
        palette={palette}
        subtitle={`${snippet.language} • Updated ${new Date(snippet.updatedAt).toLocaleString()}`}
        title={snippet.title}
      />

      <View style={styles.actionGrid}>
        <Button
          icon={snippet.favorite ? "star" : "star-outline"}
          label={snippet.favorite ? "Favorited" : "Favorite"}
          onPress={onFavorite}
          palette={palette}
          variant="secondary"
        />
        <Button icon="create-outline" label="Edit" onPress={onEdit} palette={palette} variant="secondary" />
        <Button icon="share-social-outline" label="Share" onPress={onShareText} palette={palette} variant="secondary" />
        <Button icon="trash-outline" label="Delete" onPress={onDelete} palette={palette} variant="danger" />
      </View>

      <DetailSection palette={palette} title="Code">
        <Text selectable style={[styles.codeBlock, { backgroundColor: palette.codeBg, color: palette.codeText }]}>
          {snippet.code}
        </Text>
        <View style={styles.tagRow}>
          {snippet.tags.map((tag) => (
            <Tag key={tag} label={tag} palette={palette} />
          ))}
        </View>
      </DetailSection>

      <DetailSection palette={palette} title="AI Explanation">
        {snippet.explanation ? (
          <View style={styles.stack}>
            <Text style={[styles.aiLabel, { color: palette.primary }]}>Summary</Text>
            <Text style={[styles.bodyText, { color: palette.ink }]}>{snippet.summary}</Text>
            <Text style={[styles.aiLabel, { color: palette.primary }]}>Explanation</Text>
            <Text style={[styles.bodyText, { color: palette.ink }]}>{snippet.explanation}</Text>
            <Text style={[styles.aiLabel, { color: palette.primary }]}>Suggestions</Text>
            <Text style={[styles.bodyText, { color: palette.ink }]}>{snippet.suggestions}</Text>
          </View>
        ) : (
          <Text style={[styles.bodyText, { color: palette.muted }]}>
            Add an API key in Settings, then generate a practical explanation and improvement notes.
          </Text>
        )}
        <Button
          icon="sparkles-outline"
          label={snippet.explanation ? "Regenerate" : "Generate explanation"}
          loading={generating}
          onPress={onExplain}
          palette={palette}
        />
      </DetailSection>

      <DetailSection palette={palette} title="Files and Sharing">
        <View style={styles.actionGrid}>
          <Button icon="document-text-outline" label="Save code" onPress={onSaveCode} palette={palette} variant="secondary" />
          <Button icon="image-outline" label="Attach screenshot" onPress={onAttach} palette={palette} variant="secondary" />
          <Button icon="download-outline" label=".txt" onPress={() => onExport("txt")} palette={palette} variant="secondary" />
          <Button icon="logo-javascript" label=".js" onPress={() => onExport("js")} palette={palette} variant="secondary" />
          <Button icon="code-slash-outline" label=".json" onPress={() => onExport("json")} palette={palette} variant="secondary" />
        </View>
      </DetailSection>

      <DetailSection palette={palette} title="Attachments">
        {attachments.length === 0 ? (
          <Text style={[styles.bodyText, { color: palette.muted }]}>No screenshots attached yet.</Text>
        ) : (
          <View style={styles.stack}>
            {attachments.map((attachment) => (
              <View key={attachment.id} style={styles.attachmentRow}>
                <Image source={{ uri: attachment.fileUri }} style={styles.attachmentImage} />
                <View style={styles.attachmentText}>
                  <Text numberOfLines={1} style={[styles.fileName, { color: palette.ink }]}>
                    {attachment.name}
                  </Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{attachment.type}</Text>
                </View>
                <Pressable onPress={() => onDeleteAttachment(attachment)} style={styles.iconButton}>
                  <Ionicons color={palette.danger} name="trash-outline" size={22} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </DetailSection>
    </ScrollView>
  );
}

function FileManagerScreen({
  currentUri,
  files,
  loading,
  palette,
  onCopy,
  onDelete,
  onInstallTemplates,
  onMove,
  onNavigate,
  onRefresh,
  onShare
}: {
  currentUri: string;
  files: StoredFile[];
  loading: boolean;
  palette: Palette;
  onCopy: (file: StoredFile) => void;
  onDelete: (file: StoredFile) => void;
  onInstallTemplates: () => void;
  onMove: (file: StoredFile) => void;
  onNavigate: (uri: string) => void;
  onRefresh: () => void;
  onShare: (file: StoredFile) => void;
}) {
  const atRoot = currentUri === directories.root;

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Header
        action={<Button icon="refresh-outline" label="Refresh" onPress={onRefresh} palette={palette} variant="secondary" />}
        palette={palette}
        subtitle="Browse local app folders, move resources, copy files, and remove clutter."
        title="File Manager"
      />
      <View style={styles.actionGrid}>
        <Button
          disabled={atRoot}
          icon="arrow-up-outline"
          label="Up"
          onPress={() => onNavigate(parentDirectory(currentUri))}
          palette={palette}
          variant="secondary"
        />
        <Button
          icon="cloud-download-outline"
          label="Install templates"
          onPress={onInstallTemplates}
          palette={palette}
          variant="secondary"
        />
      </View>
      <Text style={[styles.pathText, { color: palette.muted }]}>{currentUri.replace(directories.root, "/")}</Text>
      <View style={styles.stack}>
        {loading ? (
          <EmptyState body="Reading local app storage." palette={palette} title="Loading files" />
        ) : files.length === 0 ? (
          <EmptyState body="Export snippets, save code files, or install templates to fill this folder." palette={palette} title="Folder is empty" />
        ) : (
          files.map((file) => (
            <View
              key={file.uri}
              style={[styles.fileRow, { backgroundColor: palette.panel, borderColor: palette.border }]}
            >
              <Pressable
                onPress={() => (file.isDirectory ? onNavigate(file.uri) : onShare(file))}
                style={styles.fileMain}
              >
                <Ionicons
                  color={file.isDirectory ? palette.primary : palette.muted}
                  name={file.isDirectory ? "folder-outline" : "document-text-outline"}
                  size={24}
                />
                <View style={styles.fileTextWrap}>
                  <Text numberOfLines={1} style={[styles.fileName, { color: palette.ink }]}>
                    {file.name}
                  </Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>
                    {file.isDirectory ? "Folder" : formatBytes(file.size)}
                  </Text>
                </View>
              </Pressable>
              {!file.isDirectory ? (
                <View style={styles.fileActions}>
                  <Pressable onPress={() => onCopy(file)} style={styles.iconButton}>
                    <Ionicons color={palette.primary} name="copy-outline" size={21} />
                  </Pressable>
                  <Pressable onPress={() => onMove(file)} style={styles.iconButton}>
                    <Ionicons color={palette.success} name="arrow-forward-outline" size={21} />
                  </Pressable>
                  <Pressable onPress={() => onDelete(file)} style={styles.iconButton}>
                    <Ionicons color={palette.danger} name="trash-outline" size={21} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SettingsScreen({
  apiKey,
  palette,
  preferences,
  onChangeApiKey,
  onChangePreferences,
  onSave
}: {
  apiKey: string;
  palette: Palette;
  preferences: AppPreferences;
  onChangeApiKey: (value: string) => void;
  onChangePreferences: (value: AppPreferences) => void;
  onSave: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Header
        action={<Button icon="save-outline" label="Save" onPress={onSave} palette={palette} />}
        palette={palette}
        subtitle="Preferences use AsyncStorage. API keys use SecureStore."
        title="Settings"
      />

      <View style={styles.stack}>
        <DetailSection palette={palette} title="Theme">
          <View style={styles.segmentRow}>
            {(["system", "light", "dark"] as const).map((theme) => {
              const selected = preferences.theme === theme;
              return (
                <Pressable
                  key={theme}
                  onPress={() => onChangePreferences({ ...preferences, theme })}
                  style={[
                    styles.segment,
                    {
                      backgroundColor: selected ? palette.primary : palette.panel,
                      borderColor: selected ? palette.primary : palette.border
                    }
                  ]}
                >
                  <Text style={{ color: selected ? "#FFFFFF" : palette.ink, fontWeight: "700" }}>
                    {theme}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </DetailSection>

        <DetailSection palette={palette} title="Snippet Defaults">
          <Field
            label="Default language"
            onChangeText={(defaultLanguage) =>
              onChangePreferences({ ...preferences, defaultLanguage })
            }
            palette={palette}
            value={preferences.defaultLanguage}
          />
        </DetailSection>

        <DetailSection palette={palette} title="AI Provider">
          <View style={styles.stack}>
            <Field
              autoCapitalize="none"
              label="API endpoint"
              onChangeText={(aiEndpoint) => onChangePreferences({ ...preferences, aiEndpoint })}
              palette={palette}
              value={preferences.aiEndpoint}
            />
            <Field
              autoCapitalize="none"
              label="Model"
              onChangeText={(aiModel) => onChangePreferences({ ...preferences, aiModel })}
              palette={palette}
              value={preferences.aiModel}
            />
            <Field
              autoCapitalize="none"
              label="API key"
              onChangeText={onChangeApiKey}
              palette={palette}
              secureTextEntry
              value={apiKey}
            />
          </View>
        </DetailSection>

        <DetailSection palette={palette} title="Storage Map">
          <Text style={[styles.bodyText, { color: palette.ink }]}>
            SQLite stores snippets and attachment records. Expo FileSystem stores screenshots,
            exported snippets, templates, and code files. AsyncStorage stores theme and app
            preferences. SecureStore stores the AI key.
          </Text>
        </DetailSection>
      </View>
    </ScrollView>
  );
}

export default function App() {
  const systemColorScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [search, setSearch] = useState("");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [apiKey, setApiKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [fileUri, setFileUri] = useState(directories.root);
  const [filesLoading, setFilesLoading] = useState(false);

  const palette = useMemo(
    () => paletteFor(preferences, systemColorScheme === "dark"),
    [preferences, systemColorScheme]
  );

  const reloadSnippets = useCallback(async () => {
    const nextSnippets = await listSnippets(search, screen === "favorites");
    setSnippets(nextSnippets);
  }, [screen, search]);

  const reloadSelectedSnippet = useCallback(
    async (id: string) => {
      const nextSnippet = await getSnippet(id);
      if (!nextSnippet) {
        setSelectedSnippet(null);
        setScreen("home");
        return;
      }

      setSelectedSnippet(nextSnippet);
      setAttachments(await listAttachments(id));
    },
    []
  );

  const reloadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      setFiles(await listFiles(fileUri));
    } catch (error) {
      Alert.alert("Could not read folder", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setFilesLoading(false);
    }
  }, [fileUri]);

  useEffect(() => {
    async function boot() {
      try {
        await initializeDatabase();
        await initializeFiles();
        const [loadedPreferences, storedKey] = await Promise.all([
          loadPreferences(),
          getApiKey()
        ]);
        setPreferences(loadedPreferences);
        setApiKey(storedKey ?? "");
        setReady(true);
      } catch (error) {
        Alert.alert("Startup failed", error instanceof Error ? error.message : "Unknown error");
      }
    }

    void boot();
  }, []);

  useEffect(() => {
    if (ready && (screen === "home" || screen === "favorites")) {
      void reloadSnippets();
    }
  }, [ready, reloadSnippets, screen]);

  useEffect(() => {
    if (ready && screen === "files") {
      void reloadFiles();
    }
  }, [ready, reloadFiles, screen]);

  async function openSnippet(snippet: Snippet) {
    await reloadSelectedSnippet(snippet.id);
    setScreen("details");
  }

  async function toggleFavorite(snippet: Snippet) {
    await setFavorite(snippet.id, !snippet.favorite);
    await reloadSnippets();
    if (selectedSnippet?.id === snippet.id) {
      await reloadSelectedSnippet(snippet.id);
    }
  }

  async function saveNewSnippet(input: SnippetInput) {
    const snippet = await createSnippet(input);
    await reloadSnippets();
    await openSnippet(snippet);
  }

  async function saveEditedSnippet(input: SnippetInput) {
    if (!editingSnippet) {
      return;
    }

    const updated = await updateSnippet(editingSnippet.id, input);
    if (updated) {
      setEditingSnippet(null);
      await reloadSnippets();
      await openSnippet(updated);
    }
  }

  async function handleDeleteSnippet() {
    if (!selectedSnippet) {
      return;
    }

    Alert.alert("Delete snippet?", "This removes the snippet and its attachment records.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await deleteSnippet(selectedSnippet.id);
            setSelectedSnippet(null);
            setScreen("home");
            await reloadSnippets();
          })();
        }
      }
    ]);
  }

  async function handleAttachScreenshot() {
    if (!selectedSnippet) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach screenshots.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const copied = await copyAttachmentToAppStorage(result.assets[0].uri, selectedSnippet.id);
    await addAttachment(selectedSnippet.id, copied.uri, copied.name, "screenshot");
    await reloadSelectedSnippet(selectedSnippet.id);
    Alert.alert("Screenshot attached", "The image was copied into local app storage.");
  }

  async function handleDeleteAttachment(attachment: Attachment) {
    await deleteAttachment(attachment.id);
    await deleteFile(attachment.fileUri);
    if (selectedSnippet) {
      await reloadSelectedSnippet(selectedSnippet.id);
    }
  }

  async function handleGenerateExplanation() {
    if (!selectedSnippet) {
      return;
    }

    setGenerating(true);
    try {
      const response = await explainSnippet(selectedSnippet, preferences);
      await saveAiResponse(selectedSnippet.id, response);
      await reloadSelectedSnippet(selectedSnippet.id);
    } catch (error) {
      Alert.alert("AI explanation failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport(format: "txt" | "js" | "json") {
    if (!selectedSnippet) {
      return;
    }

    const uri = await exportSnippet(selectedSnippet, format);
    Alert.alert("Snippet exported", `Saved to ${uri}`, [
      { text: "OK" },
      { text: "Share", onPress: () => void shareFile(uri) }
    ]);
  }

  async function handleSaveCodeFile() {
    if (!selectedSnippet) {
      return;
    }

    const uri = await saveCodeFile(selectedSnippet);
    Alert.alert("Code file saved", `Saved to ${uri}`);
  }

  async function handleSaveSettings() {
    await Promise.all([savePreferences(preferences), saveApiKey(apiKey)]);
    Alert.alert("Settings saved", "Preferences and credentials were updated.");
  }

  async function handleInstallTemplates() {
    await installTemplates();
    await reloadFiles();
    Alert.alert("Templates installed", "Starter resources were saved locally.");
  }

  async function handleDeleteFile(file: StoredFile) {
    await deleteFile(file.uri);
    await reloadFiles();
  }

  async function handleCopyFile(file: StoredFile) {
    await copyFileToDirectory(file.uri, directories.resources);
    await reloadFiles();
    Alert.alert("File copied", "A copy was added to the resources folder.");
  }

  async function handleMoveFile(file: StoredFile) {
    await moveFileToDirectory(file.uri, directories.exports);
    await reloadFiles();
    Alert.alert("File moved", "The file was moved to the exports folder.");
  }

  function navigate(screenName: Screen) {
    setScreen(screenName);
    if (screenName !== "details") {
      setSelectedSnippet(null);
    }
  }

  function renderScreen() {
    if (!ready) {
      return (
        <View style={[styles.loadingScreen, { backgroundColor: palette.background }]}>
          <Text style={[styles.title, { color: palette.ink }]}>Loading SnippetKeeper</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>Preparing local storage.</Text>
        </View>
      );
    }

    if (screen === "create") {
      return (
        <SnippetForm
          initialSnippet={editingSnippet}
          onCancel={() => {
            if (editingSnippet) {
              setEditingSnippet(null);
              setScreen("details");
            } else {
              setScreen("home");
            }
          }}
          onSubmit={editingSnippet ? saveEditedSnippet : saveNewSnippet}
          palette={palette}
          preferences={preferences}
        />
      );
    }

    if (screen === "details" && selectedSnippet) {
      return (
        <SnippetDetailsScreen
          attachments={attachments}
          generating={generating}
          onAttach={handleAttachScreenshot}
          onBack={() => setScreen("home")}
          onDelete={handleDeleteSnippet}
          onDeleteAttachment={handleDeleteAttachment}
          onEdit={() => {
            setEditingSnippet(selectedSnippet);
            setScreen("create");
          }}
          onExplain={handleGenerateExplanation}
          onExport={handleExport}
          onFavorite={() => toggleFavorite(selectedSnippet)}
          onSaveCode={handleSaveCodeFile}
          onShareText={() => shareSnippetText(selectedSnippet)}
          palette={palette}
          snippet={selectedSnippet}
        />
      );
    }

    if (screen === "favorites") {
      return (
        <SnippetListScreen
          favoritesOnly
          onCreate={() => setScreen("create")}
          onFavorite={toggleFavorite}
          onOpen={openSnippet}
          onSearch={setSearch}
          palette={palette}
          search={search}
          snippets={snippets}
        />
      );
    }

    if (screen === "files") {
      return (
        <FileManagerScreen
          currentUri={fileUri}
          files={files}
          loading={filesLoading}
          onCopy={handleCopyFile}
          onDelete={handleDeleteFile}
          onInstallTemplates={handleInstallTemplates}
          onMove={handleMoveFile}
          onNavigate={setFileUri}
          onRefresh={reloadFiles}
          onShare={(file) => shareFile(file.uri)}
          palette={palette}
        />
      );
    }

    if (screen === "settings") {
      return (
        <SettingsScreen
          apiKey={apiKey}
          onChangeApiKey={setApiKey}
          onChangePreferences={setPreferences}
          onSave={handleSaveSettings}
          palette={palette}
          preferences={preferences}
        />
      );
    }

    return (
      <SnippetListScreen
        favoritesOnly={false}
        onCreate={() => {
          setEditingSnippet(null);
          setScreen("create");
        }}
        onFavorite={toggleFavorite}
        onOpen={openSnippet}
        onSearch={setSearch}
        palette={palette}
        search={search}
        snippets={snippets}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <StatusBar style={preferences.theme === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.appShell}>{renderScreen()}</View>
        {ready && screen !== "create" && screen !== "details" ? (
          <BottomTabs active={screen} onNavigate={navigate} palette={palette} />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  aiLabel: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  appName: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  appShell: {
    flex: 1
  },
  attachmentImage: {
    backgroundColor: "#D9E0EA",
    borderRadius: 8,
    height: 64,
    width: 64
  },
  attachmentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  attachmentText: {
    flex: 1
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22
  },
  card: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  cardMeta: {
    fontSize: 12,
    marginTop: spacing.xs
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  cardTitleWrap: {
    flex: 1
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  codeBlock: {
    borderRadius: 8,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 13,
    lineHeight: 19,
    overflow: "hidden",
    padding: spacing.lg
  },
  field: {
    gap: spacing.sm
  },
  fileActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  fileMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md
  },
  fileName: {
    fontSize: 15,
    fontWeight: "800"
  },
  fileRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md
  },
  fileTextWrap: {
    flex: 1
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "space-between"
  },
  headerText: {
    flex: 1,
    gap: spacing.xs
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  keyboardView: {
    flex: 1
  },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl
  },
  pathText: {
    fontSize: 12,
    fontWeight: "700"
  },
  previewCode: {
    backgroundColor: "#101828",
    borderRadius: 8,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 12,
    lineHeight: 18,
    padding: spacing.md
  },
  safeArea: {
    flex: 1
  },
  screenContent: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  section: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900"
  },
  segment: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  smallLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  stack: {
    gap: spacing.md
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 62
  },
  tabText: {
    fontSize: 11,
    fontWeight: "800"
  },
  tabs: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row"
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  title: {
    fontSize: 30,
    fontWeight: "900"
  }
});
