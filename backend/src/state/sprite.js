export const SPRITE_THRESHOLDS = [
  { minHealth: 81, tier: "happy" },
  { minHealth: 61, tier: "sleep" },
  { minHealth: 41, tier: "confused" },
  { minHealth: 21, tier: "tear" },
  { minHealth: 1, tier: "ghost" },
  { minHealth: 0, tier: "dead" }
];

function clampHealth(value) {
  return Math.max(0, Math.min(100, Number(value ?? 0)));
}

export function getSpriteTierForHealth(health) {
  const normalized = clampHealth(health);
  for (const threshold of SPRITE_THRESHOLDS) {
    if (normalized >= threshold.minHealth) return threshold.tier;
  }
  return "dead";
}
