const API_BASES = ["http://127.0.0.1:8787/api", "http://localhost:8787/api"];

const SPRITE_THRESHOLDS = [
  { min: 81, img: "assets/dog_happy.png" },
  { min: 61, img: "assets/dog_sleep.png" },
  { min: 41, img: "assets/dog_confused.png" },
  { min: 21, img: "assets/dog_tear.png" },
  { min: 1,  img: "assets/dog_ghost.png" },
  { min: 0,  img: "assets/dog_gravestone.png" },
];
let currentSprite = null;

const statusBadge = document.getElementById("statusBadge");
const petSpriteEl = document.getElementById("petSprite");
const eventListEl = document.getElementById("eventList");
const clearEventsBtn = document.getElementById("clearEventsBtn");
const testTwilioBtn = document.getElementById("testTwilioBtn");
const twilioStatusEl = document.getElementById("twilioStatus");
const trackTabActivityEl = document.getElementById("trackTabActivity");
const trackIdleHeartbeatEl = document.getElementById("trackIdleHeartbeat");
const trackReelsScrollEl = document.getElementById("trackReelsScroll");

async function sendTwilioTest() {
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}/notifications/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "popup test" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Twilio test failed.");
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
      const domain = item.domain ? ` · ${item.domain}` : "";
      return `<li>${item.type}${domain}<br/><small>${ts}</small></li>`;
    })
    .join("");
}

function renderStatus(online) {
  statusBadge.textContent = online ? "ON" : "OFF";
  statusBadge.className = "status-badge" + (online ? " online" : "");
}

function bindToggle(el, key) {
  el.addEventListener("change", async () => {
    await chrome.storage.local.set({ [key]: el.checked });
  });
}
bindToggle(trackTabActivityEl, "trackTabActivity");
bindToggle(trackIdleHeartbeatEl, "trackIdleHeartbeat");
bindToggle(trackReelsScrollEl, "trackReelsScroll");

clearEventsBtn.addEventListener("click", () => {
  renderEvents([]);
});

testTwilioBtn.addEventListener("click", async () => {
  testTwilioBtn.disabled = true;
  twilioStatusEl.textContent = "Sending...";
  try {
    const payload = await sendTwilioTest();
    twilioStatusEl.textContent = payload.configured ? "SMS sent." : "Twilio not configured.";
  } catch (error) {
    twilioStatusEl.textContent = error?.message ?? "Twilio test failed.";
  } finally {
    testTwilioBtn.disabled = false;
  }
});

// Config from storage
chrome.storage.local.get({
  trackTabActivity: true,
  trackIdleHeartbeat: true,
  trackReelsScroll: true
}).then((cfg) => {
  trackTabActivityEl.checked = Boolean(cfg.trackTabActivity);
  trackIdleHeartbeatEl.checked = Boolean(cfg.trackIdleHeartbeat);
  trackReelsScrollEl.checked = Boolean(cfg.trackReelsScroll);
});

function updatePopupSprite(health) {
  const h = Math.max(0, Math.min(100, Number(health ?? 0)));
  let file = "assets/dogdead.png";
  for (const t of SPRITE_THRESHOLDS) {
    if (h >= t.min) { file = t.img; break; }
  }
  if (file !== currentSprite) {
    currentSprite = file;
    petSpriteEl.src = file;
  }
}

// Live state from background via port
const port = chrome.runtime.connect({ name: "sidebar" });
port.onMessage.addListener((msg) => {
  if (msg.type === "state") {
    renderStatus(msg.backendOnline);
    renderEvents(msg.recentEvents ?? []);
    updatePopupSprite(msg.pet?.health);
  }
});
