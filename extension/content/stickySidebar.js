(function () {
  if (window.top !== window) return;
  if (document.getElementById("scrollagotchi-sidebar-root")) return;

  const root = document.createElement("div");
  root.id = "scrollagotchi-sidebar-root";
  root.innerHTML = `
    <style>
      #scrollagotchi-sidebar {
        position: fixed;
        top: 88px;
        right: 0;
        z-index: 2147483647;
        width: 260px;
        font-family: Arial, sans-serif;
        color: #e2e8f0;
        transition: transform 0.2s ease;
      }
      #scrollagotchi-sidebar.collapsed {
        transform: translateX(228px);
      }
      #scrollagotchi-sidebar .panel {
        background: #020617;
        border: 1px solid #1e293b;
        border-right: 0;
        border-radius: 10px 0 0 10px;
        padding: 10px;
        box-shadow: 0 8px 20px rgba(2, 6, 23, 0.45);
      }
      #scrollagotchi-sidebar .title {
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 8px;
      }
      #scrollagotchi-sidebar .line {
        font-size: 12px;
        margin: 4px 0;
      }
      #scrollagotchi-sidebar .bar {
        height: 8px;
        background: #1e293b;
        border-radius: 999px;
        overflow: hidden;
        margin-top: 8px;
      }
      #scrollagotchi-sidebar .fill {
        height: 100%;
        width: 0%;
        background: #38bdf8;
        transition: width 0.15s ease;
      }
      #scrollagotchi-sidebar .toggle {
        position: absolute;
        left: -30px;
        top: 12px;
        border: none;
        width: 30px;
        height: 76px;
        border-radius: 8px 0 0 8px;
        background: #0f172a;
        color: #e2e8f0;
        cursor: pointer;
        font-size: 11px;
        writing-mode: vertical-rl;
        text-orientation: mixed;
      }
    </style>
    <div id="scrollagotchi-sidebar">
      <button id="scrollagotchi-toggle" class="toggle">Scrollagotchi</button>
      <div class="panel">
        <div class="title">Scrollagotchi</div>
        <div class="line">Health: <strong id="scrollagotchi-health">--</strong></div>
        <div class="line">Status: <strong id="scrollagotchi-status">unknown</strong></div>
        <div class="line">Backend: <strong id="scrollagotchi-backend">offline</strong></div>
        <div class="bar"><div id="scrollagotchi-fill" class="fill"></div></div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(root);

  const sidebar = document.getElementById("scrollagotchi-sidebar");
  const toggle = document.getElementById("scrollagotchi-toggle");
  const healthEl = document.getElementById("scrollagotchi-health");
  const statusEl = document.getElementById("scrollagotchi-status");
  const backendEl = document.getElementById("scrollagotchi-backend");
  const fillEl = document.getElementById("scrollagotchi-fill");

  function fillColor(health) {
    if (health <= 20) return "#ef4444";
    if (health <= 50) return "#f59e0b";
    return "#38bdf8";
  }

  function render(data) {
    const pet = data?.pet ?? null;
    const backendOnline = Boolean(data?.backendOnline);

    if (!pet) {
      healthEl.textContent = "--";
      statusEl.textContent = "unknown";
      fillEl.style.width = "0%";
    } else {
      const health = Math.max(0, Math.min(100, Number(pet.health ?? 0)));
      healthEl.textContent = String(health);
      statusEl.textContent = pet.status ?? "unknown";
      fillEl.style.width = `${health}%`;
      fillEl.style.background = fillColor(health);
    }

    backendEl.textContent = backendOnline ? "online" : "offline";
  }

  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

  chrome.storage.local
    .get({ pet: null, backendOnline: false })
    .then(render)
    .catch(() => {});

  chrome.storage.onChanged.addListener((changes) => {
    const patch = {};
    if (changes.pet) patch.pet = changes.pet.newValue;
    if (changes.backendOnline) patch.backendOnline = changes.backendOnline.newValue;
    if (Object.keys(patch).length > 0) render(patch);
  });
})();
