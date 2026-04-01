import { DOMAIN_CLASS, EVENT_TYPES } from "./constants.js";

const BAD_DOMAINS = [
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "reddit.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "discord.com",
  "netflix.com",
  "twitch.tv"
];

const GOOD_DOMAINS = [
  "developer.mozilla.org",
  "docs.google.com",
  "github.com",
  "stackoverflow.com",
  "notion.so",
  "linear.app"
];

export function classifyDomain(domain = "") {
  const lower = domain.toLowerCase();
  if (!lower) return DOMAIN_CLASS.NEUTRAL;

  if (BAD_DOMAINS.some((d) => lower === d || lower.endsWith(`.${d}`))) {
    return DOMAIN_CLASS.BAD;
  }

  if (GOOD_DOMAINS.some((d) => lower === d || lower.endsWith(`.${d}`))) {
    return DOMAIN_CLASS.GOOD;
  }

  return DOMAIN_CLASS.NEUTRAL;
}

export function getHealthDeltaForEvent(event) {
  if (!event) return 0;

  if (event.type === EVENT_TYPES.REELS_SCROLL) {
    const bucket = event.meta?.bucket ?? "low";
    if (bucket === "high") return 2;
    if (bucket === "medium") return 2;
    return 1;
  }

  if (event.type === EVENT_TYPES.TAB_ACTIVE) {
    if (event.domainClass === DOMAIN_CLASS.BAD) return 2;
    if (event.domainClass === DOMAIN_CLASS.GOOD) return -2;
    return -1;
  }

  if (event.type === EVENT_TYPES.IDLE_TICK) {
    if (event.domainClass === DOMAIN_CLASS.BAD) return 1;
    if (event.domainClass === DOMAIN_CLASS.GOOD) return -2;
    return -1;
  }

  if (event.type !== EVENT_TYPES.TAB_ACTIVE && event.type !== EVENT_TYPES.IDLE_TICK) {
    return 0;
  }

  return 0;
}

export function getDecayDelta({ millisSinceFeed }) {
  return -1;
}
