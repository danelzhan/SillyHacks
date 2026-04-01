const API_BASES = ["http://127.0.0.1:8787/api", "http://localhost:8787/api"];

async function requestWithFallback(path, options) {
  let lastError;
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}${path}`, options);
      if (!response.ok) {
        lastError = new Error(`Request failed: ${response.status}`);
        continue;
      }
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Backend request failed.");
}

export async function getHealth() {
  return requestWithFallback("/health");
}

export async function getPet() {
  return requestWithFallback("/pet");
}

export async function getEvents(limit = 50) {
  return requestWithFallback(`/events?limit=${limit}`);
}

export async function sendStatusNotification(note = "") {
  return requestWithFallback("/notifications/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note })
  });
}
