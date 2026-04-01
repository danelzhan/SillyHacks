const API_BASE = "http://localhost:8787/api";

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error("Failed to fetch health.");
  return response.json();
}

export async function getPet() {
  const response = await fetch(`${API_BASE}/pet`);
  if (!response.ok) throw new Error("Failed to fetch pet state.");
  return response.json();
}

export async function getEvents(limit = 50) {
  const response = await fetch(`${API_BASE}/events?limit=${limit}`);
  if (!response.ok) throw new Error("Failed to fetch events.");
  return response.json();
}
