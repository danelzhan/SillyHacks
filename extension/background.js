const API_BASES = ["http://127.0.0.1:8787/api", "http://localhost:8787/api"];
const WS_URLS = ["ws://127.0.0.1:8787/ws", "ws://localhost:8787/ws"];
const MAX_EVENTS = 20;
const MAX_QUEUE = 100;
const IDLE_HEARTBEAT_MS = 10000;

let ws;
let wsConnected = false;
let wsUrlIndex = 0;
let lastTabDomain = "";

let pet = null;
let backendOnline = false;
let recentEvents = [];
let pendingQueue = [];

// ── port-based broadcast to all sidebars ──

const ports = new Set();

function broadcast(msg) {
  for (const p of ports) {
    try { p.postMessage(msg); } catch { ports.delete(p); }
  }
}

function broadcastState() {
  broadcast({ type: "state", pet, backendOnline, recentEvents });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "sidebar") return;
  ports.add(port);
  port.postMessage({ type: "state", pet, backendOnline, recentEvents });
  port.onDisconnect.addListener(() => ports.delete(port));
});

// ── network ──

async function fetchWithFallback(path, options) {
  let lastError;
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}${path}`, options);
      return response;
    } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error("All backend endpoints failed.");
}

// ── config ──

async function getConfig() {
  return chrome.storage.local.get({
    trackTabActivity: true,
    trackIdleHeartbeat: true,
    trackReelsScroll: true
  });
}

async function ensureConfigDefaults() {
  const current = await chrome.storage.local.get([
    "sidebarEnabled", "trackTabActivity", "trackIdleHeartbeat", "trackReelsScroll"
  ]);
  const patch = {};
  if (typeof current.sidebarEnabled !== "boolean") patch.sidebarEnabled = true;
  if (typeof current.trackTabActivity !== "boolean") patch.trackTabActivity = true;
  if (typeof current.trackIdleHeartbeat !== "boolean") patch.trackIdleHeartbeat = true;
  if (typeof current.trackReelsScroll !== "boolean") patch.trackReelsScroll = true;
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
}

// ── event posting ──

function addRecentEvent(event) {
  const dominated = recentEvents.slice(0, 5).some(
    (e) => e && e.type === event.type && e.timestamp === event.timestamp && e.domain === event.domain
  );
  if (!dominated) recentEvents = [event, ...recentEvents].slice(0, MAX_EVENTS);
}

async function postEvent(event) {
  const response = await fetchWithFallback("/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error(await response.text() || "Failed posting event");

  const payload = await response.json();
  pet = payload.pet;
  backendOnline = true;
  addRecentEvent(payload.event ?? event);
  broadcastState();
  return payload;
}

async function sendEvent(event) {
  try {
    await postEvent(event);
  } catch {
    pendingQueue = [...pendingQueue, event].slice(-MAX_QUEUE);
    backendOnline = false;
    broadcastState();
  }
}

async function flushQueue() {
  if (!pendingQueue.length) return;
  const keep = [];
  for (const event of pendingQueue) {
    try { await postEvent(event); } catch { keep.push(event); }
  }
  pendingQueue = keep;
}

// ── helpers ──

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function isHttp(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

// ── heartbeat ──

async function emitHeartbeatFromActiveTab() {
  try {
    const config = await getConfig();
    if (!config.trackIdleHeartbeat) return;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !isHttp(tab.url)) return;
    await sendEvent({
      type: "idle_tick",
      timestamp: new Date().toISOString(),
      source: "extension_bg",
      url: tab.url,
      domain: getDomain(tab.url),
      meta: { title: tab.title ?? "" }
    });
  } catch { /* transient tab query failure */ }
}

// ── tab listeners ──

async function handleTabChange(tab) {
  const config = await getConfig();
  if (!config.trackTabActivity) return;
  if (!isHttp(tab.url)) return;

  const domain = getDomain(tab.url);
  if (domain === lastTabDomain) return;
  lastTabDomain = domain;

  await sendEvent({
    type: "tab_active",
    timestamp: new Date().toISOString(),
    source: "extension_bg",
    url: tab.url,
    domain,
    meta: { title: tab.title ?? "" }
  });
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  await handleTabChange(tab);
});

// ── message handler ──

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "backend_health_ping") {
    sendResponse({ ok: true, online: backendOnline });
    return false;
  }

  if (message?.type !== "reels_scroll_signal") return;

  getConfig().then((config) => {
    if (!config.trackReelsScroll) {
      sendResponse({ ok: true, skipped: true });
      return;
    }
    sendEvent({
      type: "reels_scroll",
      timestamp: message.timestamp ?? new Date().toISOString(),
      source: "extension_content",
      url: message.url ?? "",
      domain: message.domain ?? "instagram.com",
      meta: {}
    })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
  });
  return true;
});

// ── bootstrap ──

async function bootstrapPetState() {
  try {
    const response = await fetchWithFallback("/pet");
    const payload = await response.json();
    pet = payload.item;
    backendOnline = true;
  } catch {
    backendOnline = false;
  }
  broadcastState();
}

// ── websocket ──

function connectWs() {
  try {
    ws = new WebSocket(WS_URLS[wsUrlIndex]);

    ws.onopen = () => {
      wsConnected = true;
      backendOnline = true;
      broadcastState();
      flushQueue();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "pet_state") {
          pet = msg.payload;
        } else if (msg.type === "event") {
          addRecentEvent(msg.payload);
        } else if (msg.type === "bootstrap") {
          pet = msg.payload?.pet ?? null;
          recentEvents = (msg.payload?.events ?? []).slice(0, MAX_EVENTS);
        }
        broadcastState();
      } catch { /* malformed WS payload */ }
    };

    ws.onclose = () => {
      wsConnected = false;
      backendOnline = false;
      broadcastState();
      wsUrlIndex = (wsUrlIndex + 1) % WS_URLS.length;
      setTimeout(connectWs, 3000);
    };
  } catch {
    wsUrlIndex = (wsUrlIndex + 1) % WS_URLS.length;
    setTimeout(connectWs, 3000);
  }
}

// ── sidebar injection for already-open tabs ──

async function injectSidebarIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !isHttp(tab.url)) continue;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/stickySidebar.js"]
      }).catch(() => {});
    }
  } catch { /* scripting API unavailable */ }
}

chrome.runtime.onInstalled.addListener(() => {
  injectSidebarIntoExistingTabs();
});

// ── timers ──

setInterval(() => { if (!wsConnected) flushQueue(); }, 5000);
setInterval(() => { emitHeartbeatFromActiveTab(); }, IDLE_HEARTBEAT_MS);

// ── init ──

ensureConfigDefaults();
bootstrapPetState();
connectWs();
