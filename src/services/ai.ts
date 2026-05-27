import { AiResponse, AppPreferences, Snippet } from "../types";
import { getApiKey } from "../storage/secrets";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function parseAiContent(content: string): AiResponse {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? content;

  try {
    const parsed = JSON.parse(raw);
    return {
      explanation: String(parsed.explanation ?? ""),
      summary: String(parsed.summary ?? ""),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.join("\n")
        : String(parsed.suggestions ?? "")
    };
  } catch {
    return {
      explanation: content.trim(),
      summary: "Generated explanation",
      suggestions: "Review the explanation for possible improvements and edge cases."
    };
  }
}

export async function explainSnippet(
  snippet: Snippet,
  preferences: AppPreferences
): Promise<AiResponse> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("Add an AI API key in Settings before generating explanations.");
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You explain code for developers. Return only JSON with explanation, summary, and suggestions fields. Keep it practical and specific."
    },
    {
      role: "user",
      content: `Title: ${snippet.title}
Language: ${snippet.language}
Tags: ${snippet.tags.join(", ")}

Code:
${snippet.code}`
    }
  ];

  const response = await fetch(preferences.aiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: preferences.aiModel,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `AI request failed with status ${response.status}`);
  }

  const data = (await response.json()) as ChatResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("The AI provider did not return an explanation.");
  }

  return parseAiContent(content);
}
