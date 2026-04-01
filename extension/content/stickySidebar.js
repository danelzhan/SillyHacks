(function () {
  if (window.top !== window) return;

  const TOTAL_SEGS = 10;
  let segEls = [];
  let healthValEl = null;
  let msgEl = null;
  let sidebarEl = null;
  let mounted = false;

  let pet = null;
  let recentEvents = [];
  let displayedHealth = -1;
  let animFrame = null;

  function buildMessage() {
    if (!pet) return "connecting...";
    if (pet.status === "dead") return "i died...";
    if (pet.status === "critical") return "i'm fading...";
    const latest = recentEvents[0];
    if (latest) {
      if (latest.type === "reels_scroll") return "nom nom scrolls...";
      if (latest.type === "tab_active" && latest.domainClass === "good")
        return `${latest.domain}... ow...`;
      if (latest.type === "tab_active" && latest.domainClass === "bad")
        return "doom scroll for me...";
      if (latest.type === "decay_tick") return "hungry...";
    }
    return "feed me scrolls...";
  }

  function mount() {
    if (mounted) return;
    mounted = true;

    const root = document.createElement("div");
    root.id = "scrollagotchi-sidebar-root";

    let segsHTML = "";
    for (let i = 0; i < TOTAL_SEGS; i++) segsHTML += `<div class="sg-seg" id="sg-seg-${i}"></div>`;

    root.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap');
        #sg-sidebar {
          position: fixed; top: 72px; right: 0; z-index: 2147483647;
          width: 220px; font-family: 'Silkscreen', monospace;
          transition: transform .2s ease;
        }
        #sg-sidebar.collapsed { transform: translateX(188px); }
        #sg-sidebar .sg-shell {
          border: 3px solid #2a4f52; border-right: 0;
          border-radius: 16px 0 0 16px; background: #3b6b6b;
          padding: 2px; box-shadow: 0 6px 18px rgba(0,0,0,.3);
        }
        #sg-sidebar .sg-inner {
          background: #7ecec8; border-radius: 13px 0 0 13px; padding: 10px;
        }
        #sg-sidebar .sg-title {
          text-align: center; font-size: 7px; font-weight: 700;
          color: #2a4f52; margin-bottom: 6px; letter-spacing: 1px;
        }
        #sg-sidebar .sg-bar {
          display: flex; align-items: center; gap: 3px;
          background: #fff; border: 2px solid #2a4f52;
          border-radius: 6px; padding: 4px 6px;
        }
        #sg-sidebar .sg-bar-label {
          font-size: 7px; font-weight: 700; color: #1e293b; margin-right: 2px;
        }
        #sg-sidebar .sg-segs { display: flex; gap: 2px; flex: 1; }
        .sg-seg {
          width: 10px; height: 12px; border-radius: 1px; background: #d1d5db;
        }
        .sg-seg.on { background: #5ec6c0; }
        .sg-seg.on.warn { background: #f59e0b; }
        .sg-seg.on.crit { background: #ef4444; }
        #sg-sidebar .sg-val {
          font-size: 7px; font-weight: 700; color: #1e293b;
          margin-left: auto; white-space: nowrap;
        }
        #sg-sidebar .sg-viewport {
          margin-top: 6px; height: 80px; background: #e8e4d4;
          border: 2px solid #2a4f52; border-radius: 6px;
          background-image: repeating-linear-gradient(
            0deg, transparent, transparent 3px,
            rgba(0,0,0,.03) 3px, rgba(0,0,0,.03) 4px
          );
        }
        #sg-sidebar .sg-msg {
          margin-top: 6px; background: #fff; border: 2px solid #2a4f52;
          border-radius: 6px; padding: 6px 8px; font-size: 7px;
          color: #1e293b; line-height: 1.5; min-height: 28px;
        }
        #sg-sidebar .sg-toggle {
          position: absolute; left: -24px; top: 10px;
          border: 2px solid #2a4f52; border-right: 0;
          width: 24px; height: 60px; border-radius: 6px 0 0 6px;
          background: #3b6b6b; color: #e2e8f0; cursor: pointer;
          font-family: 'Silkscreen', monospace; font-size: 7px;
          writing-mode: vertical-rl; text-orientation: mixed;
          display: flex; align-items: center; justify-content: center; padding: 0;
        }
        #sg-sidebar .sg-toggle:hover { background: #4a7a7a; }
      </style>
      <div id="sg-sidebar">
        <button class="sg-toggle" id="sg-toggle">PET</button>
        <div class="sg-shell"><div class="sg-inner">
          <div class="sg-title">SCROLLAGOTCHI</div>
          <div class="sg-bar">
            <span class="sg-bar-label">HP</span>
            <div class="sg-segs">${segsHTML}</div>
            <span class="sg-val" id="sg-health-val">--</span>
          </div>
          <div class="sg-viewport"></div>
          <div class="sg-msg" id="sg-msg">connecting...</div>
        </div></div>
      </div>
    `;

    document.documentElement.appendChild(root);
    sidebarEl = document.getElementById("sg-sidebar");
    healthValEl = document.getElementById("sg-health-val");
    msgEl = document.getElementById("sg-msg");
    segEls = [];
    for (let i = 0; i < TOTAL_SEGS; i++) segEls.push(document.getElementById(`sg-seg-${i}`));
    document.getElementById("sg-toggle").addEventListener("click", () => {
      sidebarEl.classList.toggle("collapsed");
    });
  }

  function renderBar(health) {
    const filled = Math.round((health / 100) * TOTAL_SEGS);
    for (let i = 0; i < TOTAL_SEGS; i++) {
      if (i < filled) {
        let cls = "sg-seg on";
        if (health <= 20) cls += " crit";
        else if (health <= 50) cls += " warn";
        segEls[i].className = cls;
      } else {
        segEls[i].className = "sg-seg";
      }
    }
  }

  function animateHealth(target) {
    if (animFrame) clearInterval(animFrame);
    if (displayedHealth === -1) displayedHealth = target;
    if (displayedHealth === target) {
      healthValEl.textContent = `${target}`;
      return;
    }
    animFrame = setInterval(() => {
      if (displayedHealth < target) displayedHealth++;
      else if (displayedHealth > target) displayedHealth--;
      healthValEl.textContent = `${displayedHealth}`;
      if (displayedHealth === target) clearInterval(animFrame);
    }, 30);
  }

  function render() {
    mount();
    const health = Math.max(0, Math.min(100, Number(pet?.health ?? 0)));
    renderBar(health);
    animateHealth(health);
    msgEl.textContent = buildMessage();
  }

  // ── connect to background via port ──

  function connect() {
    try {
      const port = chrome.runtime.connect({ name: "sidebar" });
      port.onMessage.addListener((msg) => {
        if (msg.type === "state") {
          pet = msg.pet;
          recentEvents = msg.recentEvents ?? [];
          render();
        }
      });
      port.onDisconnect.addListener(() => {
        setTimeout(connect, 2000);
      });
    } catch {
      setTimeout(connect, 2000);
    }
  }

  connect();
})();
