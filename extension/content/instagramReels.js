(function () {
  const TRACKED_HOSTS = new Set(["instagram.com", "tiktok.com"]);

  function getDomain() {
    try { return window.location.hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  if (!TRACKED_HOSTS.has(getDomain())) return;

  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    const url = window.location.href;
    if (url === lastUrl) return;
    lastUrl = url;

    if (!url.includes("/reels/") && !url.includes("/video/")) return;

    try {
      chrome.runtime.sendMessage({
        type: "reels_scroll_signal",
        timestamp: new Date().toISOString(),
        url,
        domain: getDomain()
      }, () => {
        if (chrome.runtime.lastError) { /* worker restarting */ }
      });
    } catch {
      // extension context invalidated
    }
  });

  observer.observe(document, { subtree: true, childList: true });
})();
