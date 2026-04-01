const API_BASE = "http://localhost:8787/api";
const WS_URL = "ws://localhost:8787/ws";
const MAX_EVENTS = 20;
const MAX_QUEUE = 100;

let ws;
let wsConnected = false;
let currentPet = null;

async function getState() {
  return chrome.storage.local.get({
    pendingQueue: [],
    recentEvents: [],
    pet: null,
    backendOnline: false
  });
}

async function setState(patch) {
  await chrome.storage.local.set(patch);
}

async function enqueueEvent(event) {
  const state = await getState();
  const queue = [...state.pendingQueue, event];
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  await setState({ pendingQueue: queue });
}

async function pushRecentEvent(event) {
  const state = await getState();
  const recentEvents = [event, ...state.recentEvents].slice(0, MAX_EVENTS);
  await setState({ recentEvents });
}

async function postEvent(event) {
  const response = await fetch(`${API_BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed posting event");
  }

  const payload = await response.json();
  currentPet = payload.pet;
  await setState({ pet: payload.pet, backendOnline: true });
  return payload;
}

async function sendEvent(event) {
  try {
    await postEvent(event);
  } catch {
    await enqueueEvent(event);
    await setState({ backendOnline: false });
  }
}

async function flushQueue() {
  const state = await getState();
  if (!state.pendingQueue.length) return;

  const keep = [];
  for (const event of state.pendingQueue) {
    try {
      await postEvent(event);
    } catch {
      keep.push(event);
    }
  }
  await setState({ pendingQueue: keep });
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isHttp(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

async function emitHeartbeatFromActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !isHttp(tab.url)) return;

    await sendEvent({
      type: "idle_tick",
      source: "extension_bg",
      url: tab.url,
      domain: getDomain(tab.url),
      meta: { title: tab.title ?? "", reason: "active_heartbeat" }
    });
  } catch {
    // ignore transient tab query failures
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (!isHttp(tab.url)) return;

  const event = {
    type: "tab_active",
    source: "extension_bg",
    url: tab.url,
    domain: getDomain(tab.url),
    meta: { title: tab.title ?? "" }
  };
  await sendEvent(event);
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!isHttp(tab.url)) return;

  const event = {
    type: "tab_active",
    source: "extension_bg",
    url: tab.url,
    domain: getDomain(tab.url),
    meta: { title: tab.title ?? "", reason: "tab_updated" }
  };
  await sendEvent(event);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "reels_scroll_signal") return;

  const event = {
    type: "reels_scroll",
    source: "extension_content",
    url: message.url ?? "",
    domain: "instagram.com",
    meta: { bucket: message.bucket ?? "low", perMinute: message.perMinute ?? 0 }
  };

  sendEvent(event).then(() => sendResponse({ ok: true }));
  return true;
});

async function bootstrapPetState() {
  try {
    const response = await fetch(`${API_BASE}/pet`);
    const payload = await response.json();
    await setState({ pet: payload.item, backendOnline: true });
  } catch {
    await setState({ backendOnline: false });
  }
}

function connectWs() {
  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = async () => {
      wsConnected = true;
      await setState({ backendOnline: true });
      await flushQueue();
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "pet_state") {
        currentPet = message.payload;
        await setState({ pet: message.payload });
      } else if (message.type === "event") {
        await pushRecentEvent(message.payload);
      } else if (message.type === "bootstrap") {
        currentPet = message.payload?.pet ?? currentPet;
        await setState({
          pet: message.payload?.pet ?? null,
          recentEvents: message.payload?.events?.slice(0, MAX_EVENTS) ?? []
        });
      }
    };

    ws.onclose = async () => {
      wsConnected = false;
      await setState({ backendOnline: false });
      setTimeout(connectWs, 3000);
    };
  } catch {
    setTimeout(connectWs, 3000);
  }
}

setInterval(() => {
  if (!wsConnected) {
    flushQueue();
  }
}, 5000);

setInterval(() => {
  emitHeartbeatFromActiveTab();
}, 3000);

bootstrapPetState();
connectWs();
