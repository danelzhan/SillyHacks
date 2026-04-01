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
const petSummaryEl = document.getElementById("petSummary");
const clearEventsBtn = document.getElementById("clearEventsBtn");
const refreshSummaryBtn = document.getElementById("refreshSummaryBtn");
const restartPetBtn = document.getElementById("restartPetBtn");
const restartStatusEl = document.getElementById("restartStatus");
const testTwilioBtn = document.getElementById("testTwilioBtn");
const twilioStatusEl = document.getElementById("twilioStatus");
const twilioArmedToggleEl = document.getElementById("twilioArmedToggle");
const trackTabActivityEl = document.getElementById("trackTabActivity");
const trackIdleHeartbeatEl = document.getElementById("trackIdleHeartbeat");
const trackReelsScrollEl = document.getElementById("trackReelsScroll");

async function sendTwilioTest() {
  const context = await getActiveTabContext();
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}/notifications/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: "popup test",
          url: context.url,
          title: context.title
        })
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

async function getActiveTabContext() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || typeof tab.url !== "string") return { url: "", title: "" };
    return {
      url: tab.url,
      title: tab.title ?? ""
    };
  } catch {
    return { url: "", title: "" };
  }
}

async function getTwilioArmState() {
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}/notifications/arm`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to read Twilio state.");
      return payload;
    } catch (error) {
      if (base === API_BASES[API_BASES.length - 1]) throw error;
    }
  }
  throw new Error("All backend endpoints failed.");
}

async function setTwilioArmState(armed) {
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}/notifications/arm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ armed })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to update Twilio state.");
      return payload;
    } catch (error) {
      if (base === API_BASES[API_BASES.length - 1]) throw error;
    }
  }
  throw new Error("All backend endpoints failed.");
}

async function restartPet() {
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}/pet/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to restart pet.");
      return payload;
    } catch (error) {
      if (base === API_BASES[API_BASES.length - 1]) throw error;
    }
  }
  throw new Error("All backend endpoints failed.");
}

async function fetchPetSummary() {
  const { url } = await getActiveTabContext();
  const suffix = url ? `?url=${encodeURIComponent(url)}` : "";
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}/pet/summary${suffix}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to fetch pet summary.");
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

refreshSummaryBtn.addEventListener("click", async () => {
  refreshSummaryBtn.disabled = true;
  petSummaryEl.textContent = "Refreshing summary...";
  try {
    const payload = await fetchPetSummary();
    petSummaryEl.textContent = payload.item?.summary ?? "No summary available.";
  } catch (error) {
    petSummaryEl.textContent = error?.message ?? "Failed to load summary.";
  } finally {
    refreshSummaryBtn.disabled = false;
  }
});

restartPetBtn.addEventListener("click", async () => {
  restartPetBtn.disabled = true;
  restartStatusEl.textContent = "Restarting...";
  try {
    const payload = await restartPet();
    restartStatusEl.textContent = `Restarted to ${payload.item?.health ?? 50}%.`;
    twilioStatusEl.textContent = "Restarted pet.";
  } catch (error) {
    restartStatusEl.textContent = error?.message ?? "Failed to restart pet.";
  } finally {
    restartPetBtn.disabled = false;
  }
});

twilioArmedToggleEl.addEventListener("change", async () => {
  twilioArmedToggleEl.disabled = true;
  twilioStatusEl.textContent = twilioArmedToggleEl.checked ? "Arming Twilio..." : "Disarming Twilio...";
  try {
    await setTwilioArmState(twilioArmedToggleEl.checked);
    twilioStatusEl.textContent = twilioArmedToggleEl.checked ? "Twilio armed." : "Twilio disarmed.";
    testTwilioBtn.disabled = !twilioArmedToggleEl.checked;
  } catch (error) {
    twilioStatusEl.textContent = error?.message ?? "Failed to update Twilio state.";
    twilioArmedToggleEl.checked = !twilioArmedToggleEl.checked;
  } finally {
    twilioArmedToggleEl.disabled = false;
  }
});

testTwilioBtn.addEventListener("click", async () => {
  testTwilioBtn.disabled = true;
  twilioStatusEl.textContent = "Sending...";
  try {
    const payload = await sendTwilioTest();
    if (payload.armed === false) {
      twilioStatusEl.textContent = "Twilio is off.";
    } else if (payload.retryAfterMs) {
      twilioStatusEl.textContent = "Cooldown active.";
    } else {
      twilioStatusEl.textContent = payload.configured ? "SMS sent." : "Twilio not configured.";
    }
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

getTwilioArmState()
  .then((state) => {
    twilioArmedToggleEl.checked = Boolean(state.armed);
    testTwilioBtn.disabled = !state.armed;
    if (state.cooldownMs > 0) {
      twilioStatusEl.textContent = `Cooldown active for ${Math.ceil(state.cooldownMs / 1000)}s.`;
    } else {
      twilioStatusEl.textContent = state.armed ? "Twilio armed." : "Twilio disarmed.";
    }
  })
  .catch((error) => {
    twilioStatusEl.textContent = error?.message ?? "Failed to load Twilio state.";
  });

refreshSummaryBtn.disabled = true;
fetchPetSummary()
  .then((payload) => {
    petSummaryEl.textContent = payload.item?.summary ?? "No summary available.";
  })
  .catch((error) => {
    petSummaryEl.textContent = error?.message ?? "Failed to load summary.";
  })
  .finally(() => {
    refreshSummaryBtn.disabled = false;
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
