import * as Sharing from "expo-sharing";
import { Alert, Share } from "react-native";
import { Snippet } from "../types";

export async function shareSnippetText(snippet: Snippet) {
  await Share.share({
    title: snippet.title,
    message: `${snippet.title}
${snippet.language} | ${snippet.tags.join(", ")}

${snippet.code}`
  });
}

export async function shareFile(uri: string) {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert("Sharing unavailable", "File sharing is not available on this device.");
    return;
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: "Share snippet file"
  });
}
