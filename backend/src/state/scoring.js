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
  "drive.google.com",
  "github.com",
  "stackoverflow.com",
  "notion.so",
  "linear.app",
  "figma.com",
  "slack.com",
  "teams.microsoft.com",
  "outlook.com",
  "mail.google.com",
  "calendar.google.com",
  "jira.atlassian.com",
  "confluence.atlassian.com",
  "leetcode.com",
  "kaggle.com",
  "coursera.org",
  "udemy.com",
  "wikipedia.org"
];

export function classifyDomain(domain = "") {
  const lower = domain.toLowerCase();
  if (!lower) return DOMAIN_CLASS.NEUTRAL;
  if (BAD_DOMAINS.some((d) => lower === d || lower.endsWith(`.${d}`))) return DOMAIN_CLASS.BAD;
  if (GOOD_DOMAINS.some((d) => lower === d || lower.endsWith(`.${d}`))) return DOMAIN_CLASS.GOOD;
  return DOMAIN_CLASS.NEUTRAL;
}

export function getHealthDeltaForEvent(event) {
  if (!event) return 0;
  if (event.type === EVENT_TYPES.REELS_SCROLL) return 5;
  if (event.type === EVENT_TYPES.TAB_ACTIVE && event.domainClass === DOMAIN_CLASS.BAD) return 10;
  if (event.type === EVENT_TYPES.TAB_ACTIVE && event.domainClass === DOMAIN_CLASS.GOOD) return -5;
  return 0;
}

export function getDecayDelta() {
  return -1;
}
