const healthValueEl = document.getElementById("healthValue");
const healthFillEl = document.getElementById("healthFill");
const petStatusEl = document.getElementById("petStatus");
const backendStatusEl = document.getElementById("backendStatus");
const eventListEl = document.getElementById("eventList");

function healthColor(health) {
  if (health <= 20) return "#ef4444";
  if (health <= 50) return "#f59e0b";
  return "#38bdf8";
}

function renderPet(pet) {
  if (!pet) {
    healthValueEl.textContent = "--";
    petStatusEl.textContent = "Status: unknown";
    healthFillEl.style.width = "0%";
    return;
  }

  const health = Math.max(0, Math.min(100, Number(pet.health ?? 0)));
  healthValueEl.textContent = `${health}`;
  petStatusEl.textContent = `Status: ${pet.status}`;
  healthFillEl.style.width = `${health}%`;
  healthFillEl.style.background = healthColor(health);
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
    pet: null,
    recentEvents: [],
    backendOnline: false
  });
  renderPet(state.pet);
  renderEvents(state.recentEvents);
  backendStatusEl.textContent = `Backend: ${state.backendOnline ? "online" : "offline"}`;
}

chrome.storage.onChanged.addListener(() => {
  refresh();
});

refresh();
