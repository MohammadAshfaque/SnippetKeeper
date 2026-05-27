import * as SecureStore from "expo-secure-store";

const API_KEY = "snippetkeeper.aiApiKey";

export async function getApiKey() {
  return SecureStore.getItemAsync(API_KEY);
}

export async function saveApiKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    await SecureStore.deleteItemAsync(API_KEY);
    return;
  }

  await SecureStore.setItemAsync(API_KEY, trimmed);
}
