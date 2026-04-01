(function () {
  let scrollCount = 0;
  let timerStarted = false;
  let lastUrl = window.location.href;

  function bucketFromRate(rate) {
    if (rate >= 30) return "high";
    if (rate >= 12) return "medium";
    return "low";
  }

  function emit() {
    const perMinute = scrollCount;
    const payload = {
      type: "reels_scroll_signal",
      url: window.location.href,
      perMinute,
      bucket: bucketFromRate(perMinute)
    };
    chrome.runtime.sendMessage(payload);
    scrollCount = 0;
  }

  function start() {
    if (timerStarted) return;
    timerStarted = true;
    setInterval(emit, 60 * 1000);
  }

  window.addEventListener(
    "wheel",
    () => {
      if (!window.location.href.includes("instagram.com")) return;
      scrollCount += 1;
    },
    { passive: true }
  );

  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (lastUrl.includes("/reels")) scrollCount += 3;
    }
  }, 1500);

  start();
})();
