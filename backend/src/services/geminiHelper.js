function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeParts(parts) {
  if (!Array.isArray(parts)) return [];
  return parts
    .map((part) => {
      if (typeof part === "string") return { text: part };
      if (part && typeof part === "object" && typeof part.text === "string") {
        return { text: part.text };
      }
      return null;
    })
    .filter(Boolean);
}

function collectText(responseJson) {
  const candidates = responseJson?.candidates ?? [];
  const chunks = [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      if (typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

export function createGeminiHelper(config = {}) {
  const apiKey = trimString(config.apiKey ?? process.env.GEMINI_API_KEY);
  const model = trimString(config.model ?? process.env.GEMINI_MODEL) || "gemini-2.0-flash";

  function isConfigured() {
    return Boolean(apiKey);
  }

  async function requestGenerateContent({
    prompt,
    systemInstruction,
    temperature = 0.7,
    maxOutputTokens = 512,
    responseMimeType
  } = {}) {
    if (!isConfigured()) {
      return {
        ok: false,
        configured: false,
        text: "",
        raw: null,
        reason: "Gemini is not configured."
      };
    }

    const textPrompt = trimString(prompt);
    if (!textPrompt) {
      throw new Error("prompt is required.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [
        {
          role: "user",
          parts: normalizeParts([textPrompt])
        }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens
      }
    };

    const instruction = trimString(systemInstruction);
    if (instruction) {
      body.systemInstruction = {
        parts: normalizeParts([instruction])
      };
    }

    if (responseMimeType) {
      body.generationConfig.responseMimeType = responseMimeType;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const rawText = await response.text();
    let raw = null;
    try {
      raw = rawText ? JSON.parse(rawText) : null;
    } catch {
      raw = null;
    }

    if (!response.ok) {
      const message = raw?.error?.message ?? rawText ?? `Gemini request failed with status ${response.status}.`;
      throw new Error(message);
    }

    const text = collectText(raw);
    return {
      ok: true,
      configured: true,
      text,
      raw
    };
  }

  async function generateText(options = {}) {
    return requestGenerateContent(options);
  }

  async function generateJson(options = {}) {
    const result = await requestGenerateContent({
      ...options,
      responseMimeType: "application/json"
    });

    if (!result.ok) return result;

    try {
      return {
        ...result,
        json: result.text ? JSON.parse(result.text) : null
      };
    } catch (error) {
      throw new Error(`Gemini returned invalid JSON: ${error?.message ?? "parse failed"}`);
    }
  }

  return {
    isConfigured,
    generateText,
    generateJson,
    requestGenerateContent
  };
}
