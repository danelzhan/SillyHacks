(function () {
  const TRACKED_HOSTS = new Set(["instagram.com", "tiktok.com"]);
  const EMIT_WINDOW_MS = 250;
  const GESTURE_IDLE_MS = 120;
  let scrollCount = 0;
  let timerStarted = false;
  let lastWheelAt = 0;

  function getDomain() {
    try {
      return window.location.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function isTrackedShortFormSite() {
    return TRACKED_HOSTS.has(getDomain());
  }

  function bucketFromRate(rate) {
    if (rate >= 30) return "high";
    if (rate >= 12) return "medium";
    return "low";
  }

  function emit() {
    if (!isTrackedShortFormSite()) return;
    if (scrollCount <= 0) return;
    if (Date.now() - lastWheelAt < GESTURE_IDLE_MS) return;

    const perMinute = Math.round((scrollCount * 60 * 1000) / EMIT_WINDOW_MS);
    if (perMinute <= 0) {
      scrollCount = 0;
      return;
    }

    const payload = {
      type: "reels_scroll_signal",
      url: window.location.href,
      domain: getDomain(),
      perMinute,
      bucket: bucketFromRate(perMinute)
    };

    // Content scripts can outlive extension reloads; swallow invalidated-context errors.
    try {
      chrome.runtime.sendMessage(payload, () => {
        if (chrome.runtime.lastError) {
          // No-op: extension worker may be restarting or context invalidated.
        }
      });
    } catch {
      // No-op: extension context invalidated.
    }
    scrollCount = 0;
  }

  function start() {
    if (timerStarted) return;
    timerStarted = true;
    setInterval(emit, EMIT_WINDOW_MS);
  }

  window.addEventListener(
    "wheel",
    (event) => {
      if (!isTrackedShortFormSite()) return;
      if (Math.abs(Number(event.deltaY ?? 0)) < 1) return;
      scrollCount += 1;
      lastWheelAt = Date.now();
    },
    { passive: true }
  );

  start();
})();
