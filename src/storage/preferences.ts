import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppPreferences } from "../types";

const PREFERENCES_KEY = "snippetkeeper.preferences";

export const defaultPreferences: AppPreferences = {
  theme: "system",
  defaultLanguage: "TypeScript",
  aiEndpoint: "https://api.openai.com/v1/chat/completions",
  aiModel: "gpt-4o-mini"
};

export async function loadPreferences(): Promise<AppPreferences> {
  const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
  if (!raw) {
    return defaultPreferences;
  }

  try {
    return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(preferences: AppPreferences) {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}
