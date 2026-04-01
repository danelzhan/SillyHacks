const backendStatusEl = document.getElementById("backendStatus");
const eventListEl = document.getElementById("eventList");
const clearEventsBtn = document.getElementById("clearEventsBtn");
const testTwilioBtn = document.getElementById("testTwilioBtn");
const twilioStatusEl = document.getElementById("twilioStatus");
const sidebarEnabledEl = document.getElementById("sidebarEnabled");
const trackTabActivityEl = document.getElementById("trackTabActivity");
const trackIdleHeartbeatEl = document.getElementById("trackIdleHeartbeat");
const trackReelsScrollEl = document.getElementById("trackReelsScroll");
const API_BASES = ["http://127.0.0.1:8787/api", "http://localhost:8787/api"];

async function checkBackendOnline() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "backend_health_ping" });
    if (response && typeof response.online === "boolean") return response.online;
  } catch {
    // Fallback to direct fetch checks below.
  }

  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return true;
    } catch {
      // try next base
    }
  }
  return false;
}

async function sendTwilioTest() {
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}/notifications/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ note: "popup test" })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || `Twilio test failed with status ${response.status}.`);
      }

      return payload;
    } catch (error) {
      if (base === API_BASES[API_BASES.length - 1]) throw error;
    }
  }

  throw new Error("All backend endpoints failed.");
}

function renderEvents(events) {
  const items = Array.isArray(events) ? events.slice(0, 10) : [];
  if (!items.length) {
    eventListEl.innerHTML = "<li>No events yet.</li>";
    return;
  }

  eventListEl.innerHTML = items
    .map((item) => {
      const ts = new Date(item.timestamp ?? Date.now()).toLocaleTimeString();
      const domain = item.domain ? ` • ${item.domain}` : "";
      return `<li>${item.type}${domain}<br/><small>${ts}</small></li>`;
    })
    .join("");
}

async function refresh() {
  const state = await chrome.storage.local.get({
    recentEvents: [],
    backendOnline: false,
    sidebarEnabled: true,
    trackTabActivity: true,
    trackIdleHeartbeat: true,
    trackReelsScroll: true
  });
  const liveBackendOnline = await checkBackendOnline();
  renderEvents(state.recentEvents);
  const backendOnline = Boolean(liveBackendOnline || state.backendOnline);
  backendStatusEl.textContent = `Backend: ${backendOnline ? "online" : "offline"}`;
  sidebarEnabledEl.checked = Boolean(state.sidebarEnabled);
  trackTabActivityEl.checked = Boolean(state.trackTabActivity);
  trackIdleHeartbeatEl.checked = Boolean(state.trackIdleHeartbeat);
  trackReelsScrollEl.checked = Boolean(state.trackReelsScroll);
}

function bindToggle(element, key) {
  element.addEventListener("change", async () => {
    await chrome.storage.local.set({ [key]: element.checked });
  });
}

bindToggle(sidebarEnabledEl, "sidebarEnabled");
bindToggle(trackTabActivityEl, "trackTabActivity");
bindToggle(trackIdleHeartbeatEl, "trackIdleHeartbeat");
bindToggle(trackReelsScrollEl, "trackReelsScroll");

clearEventsBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ recentEvents: [] });
  renderEvents([]);
});

testTwilioBtn.addEventListener("click", async () => {
  testTwilioBtn.disabled = true;
  twilioStatusEl.textContent = "Sending test SMS...";
  try {
    const payload = await sendTwilioTest();
    twilioStatusEl.textContent = payload.configured
      ? "Twilio test sent."
      : "Twilio is not configured.";
  } catch (error) {
    twilioStatusEl.textContent = error?.message ?? "Twilio test failed.";
  } finally {
    testTwilioBtn.disabled = false;
  }
});

chrome.storage.onChanged.addListener(() => {
  refresh();
});

refresh();
setInterval(() => {
  refresh();
}, 1000);
