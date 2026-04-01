import { createGeminiHelper } from "./geminiHelper.js";

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function currentPageFromEvent(event = {}) {
  return trimString(event?.meta?.pageUrl ?? event?.url ?? event?.domain ?? "");
}

function hostFromUrl(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function healthBand(health) {
  const normalized = Math.max(0, Math.min(100, Number(health ?? 0)));
  if (normalized <= 20) return "critical";
  if (normalized <= 40) return "low";
  if (normalized <= 70) return "medium";
  return "high";
}

function voiceInstructionForHealth(health) {
  const band = healthBand(health);
  if (band === "critical") {
    return "Sound desperate and affectionate. Speak in first person. Beg the user to go scroll TikTok right now so you do not die. Make it urgent but still playful.";
  }
  if (band === "low") {
    return "Sound worried and needy. Speak in first person. Ask the user to scroll TikTok soon to keep you alive.";
  }
  if (band === "medium") {
    return "Sound playful and slightly clingy. Speak in first person. Mention that scrolling helps keep you fed.";
  }
  return "Sound cheerful and conversational. Speak in first person. Keep it warm and playful.";
}

function contextualSiteText(currentUrl = "", event = {}) {
  const site = trimString(currentUrl || currentPageFromEvent(event));
  const host = hostFromUrl(site);
  return host || site || "the current page";
}

function buildFallbackSummary({ pet, event, currentUrl } = {}) {
  const health = Math.max(0, Math.min(100, Number(pet?.health ?? 0)));
  const status = pet?.status ?? "unknown";
  const site = contextualSiteText(currentUrl, event);
  const band = healthBand(health);
  const voice =
    band === "critical"
      ? `I'm barely hanging on at ${health}%. Please scroll TikTok so I don't die.`
      : band === "low"
        ? `I'm at ${health}% and getting nervous. A little TikTok scrolling would help a lot.`
        : `I'm ${status} at ${health}% and watching ${site}.`;
  return `${voice} I'm looking at ${site}.`;
}

function buildFallbackSms({ pet, event, currentUrl } = {}) {
  const health = Math.max(0, Math.min(100, Number(pet?.health ?? 0)));
  const site = contextualSiteText(currentUrl, event);
  const band = healthBand(health);

  if (band === "critical") {
    return `I'm at ${health}%... please scroll TikTok for me right now so I don't die.`;
  }
  if (band === "low") {
    return `I'm at ${health}%. Can you scroll TikTok for me a bit?`;
  }
  if (band === "medium") {
    return `I'm at ${health}% and I need your scroll energy on ${site}.`;
  }
  return `I'm happy at ${health}% while you browse ${site}.`;
}

export function createPetNarrator(config = {}) {
  const gemini = config.gemini ?? createGeminiHelper(config.geminiConfig ?? {});

  async function generatePetSummary({ pet, event, currentUrl } = {}) {
    const pageUrl = trimString(currentUrl || currentPageFromEvent(event));
    const fallback = buildFallbackSummary({ pet, event, currentUrl: pageUrl });

    if (!gemini.isConfigured()) {
      return { ok: true, configured: false, source: "fallback", summary: fallback, currentUrl: pageUrl };
    }

    try {
      const health = Math.max(0, Math.min(100, Number(pet?.health ?? 0)));
      const site = contextualSiteText(pageUrl, event);
      const result = await gemini.generateText({
        systemInstruction:
          `Write a concise, playful pet status summary in first person. No markdown. Mention the page URL or domain when available. ${voiceInstructionForHealth(health)} Keep it to 1-2 sentences.`,
        prompt: [
          `Pet health: ${health}`,
          `Pet status: ${pet?.status ?? "unknown"}`,
          `Latest event type: ${event?.type ?? "none"}`,
          `Latest page URL: ${pageUrl || "unknown"}`,
          `Current site: ${site}`,
          `Latest domain class: ${event?.domainClass ?? "unknown"}`
        ].join("\n"),
        temperature: 0.6,
        maxOutputTokens: 120
      });

      return {
        ok: true,
        configured: true,
        source: "gemini",
        summary: result.text || fallback,
        currentUrl: pageUrl
      };
    } catch {
      return { ok: true, configured: true, source: "fallback", summary: fallback, currentUrl: pageUrl };
    }
  }

  async function generateTwilioMessage({ pet, event, currentUrl, note } = {}) {
    const pageUrl = trimString(currentUrl || currentPageFromEvent(event));
    const fallback = buildFallbackSms({ pet, event, currentUrl: pageUrl });
    const extraNote = trimString(note);

    if (!gemini.isConfigured()) {
      return { ok: true, configured: false, source: "fallback", text: fallback, currentUrl: pageUrl };
    }

    try {
      const health = Math.max(0, Math.min(100, Number(pet?.health ?? 0)));
      const site = contextualSiteText(pageUrl, event);
      const result = await gemini.generateText({
        systemInstruction:
          `Write a short SMS in first person, as if the pet is talking to the user. No markdown. Keep it under 160 characters if possible. ${voiceInstructionForHealth(health)} Make it playful, concise, and specific to the current page URL or domain. If health is critical or low, explicitly ask the user to scroll TikTok. Mention the current page URL or domain naturally.`,
        prompt: [
          `Pet health: ${health}`,
          `Pet status: ${pet?.status ?? "unknown"}`,
          `Latest event type: ${event?.type ?? "none"}`,
          `Current page URL: ${pageUrl || "unknown"}`,
          `Current site: ${site}`,
          `Latest domain class: ${event?.domainClass ?? "unknown"}`,
          extraNote ? `Extra note: ${extraNote}` : ""
        ]
          .filter(Boolean)
          .join("\n"),
        temperature: 0.7,
        maxOutputTokens: 80
      });

      return {
        ok: true,
        configured: true,
        source: "gemini",
        text: trimString(result.text) || fallback,
        currentUrl: pageUrl
      };
    } catch {
      return { ok: true, configured: true, source: "fallback", text: fallback, currentUrl: pageUrl };
    }
  }

  return {
    generatePetSummary,
    generateTwilioMessage
  };
}
