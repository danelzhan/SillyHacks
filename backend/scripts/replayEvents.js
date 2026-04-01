const API_BASE = "http://localhost:8787/api/events";

const sample = [
  { type: "tab_active", domain: "instagram.com", url: "https://instagram.com/reels", meta: { reason: "feed" } },
  { type: "reels_scroll", domain: "instagram.com", url: "https://instagram.com/reels", meta: { bucket: "high" } },
  { type: "tab_active", domain: "github.com", url: "https://github.com", meta: { reason: "work" } },
  { type: "idle_tick", domain: "github.com", url: "https://github.com", meta: { reason: "idle" } }
];

async function main() {
  for (const event of sample) {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });
    const payload = await response.json();
    console.log(event.type, payload.pet);
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
