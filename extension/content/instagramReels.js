(function () {
  const TRACKED_HOSTS = new Set(["instagram.com", "tiktok.com"]);
  const host = location.hostname.replace(/^www\./, "");
  if (!TRACKED_HOSTS.has(host)) return;

  let lastUrl = location.href;

  setInterval(() => {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    if (!url.includes("/reels/") && !url.includes("/video/")) return;

    try {
      chrome.runtime.sendMessage({
        type: "reels_scroll_signal",
        timestamp: new Date().toISOString(),
        url,
        domain: host
      }, () => { void chrome.runtime.lastError; });
    } catch {}
  }, 500);
})();
