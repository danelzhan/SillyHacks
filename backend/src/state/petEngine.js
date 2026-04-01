import { EVENT_TYPES, PET_STATUS } from "./constants.js";
import { classifyDomain, getDecayDelta, getHealthDeltaForEvent } from "./scoring.js";

function clampHealth(value) {
  return Math.max(0, Math.min(100, value));
}

function nowIso() {
  return new Date().toISOString();
}

function statusFromHealth(health) {
  if (health <= 0) return PET_STATUS.DEAD;
  if (health <= 20) return PET_STATUS.CRITICAL;
  return PET_STATUS.ALIVE;
}

export function createPetEngine(config = {}) {
  const allowRevive = config.allowRevive ?? true;
  const decayTickSeconds = Number(config.decayTickSeconds ?? 3);
  const initialHealth = Number(config.initialHealth ?? 50);

  const state = {
    health: clampHealth(initialHealth),
    status: statusFromHealth(initialHealth),
    lastFeedAt: nowIso(),
    lastEventAt: nowIso(),
    createdAt: nowIso()
  };

  function snapshot() {
    return { ...state };
  }

  function transitionStatus(nextStatus, eventCollector) {
    if (state.status === nextStatus) return;
    const previous = state.status;
    state.status = nextStatus;

    if (nextStatus === PET_STATUS.CRITICAL) {
      eventCollector({
        type: EVENT_TYPES.CRITICAL_ENTERED,
        timestamp: nowIso(),
        source: "engine",
        meta: { previousStatus: previous }
      });
    }

    if (nextStatus === PET_STATUS.DEAD) {
      eventCollector({
        type: EVENT_TYPES.DIED,
        timestamp: nowIso(),
        source: "engine",
        meta: { previousStatus: previous }
      });
    }

    if (previous === PET_STATUS.DEAD && nextStatus !== PET_STATUS.DEAD) {
      eventCollector({
        type: EVENT_TYPES.REVIVED,
        timestamp: nowIso(),
        source: "engine",
        meta: { previousStatus: previous }
      });
    }
  }

  function applyDelta(delta, eventCollector) {
    const previousStatus = state.status;
    state.health = clampHealth(state.health + delta);
    state.lastEventAt = nowIso();
    const nextStatus = statusFromHealth(state.health);

    if (previousStatus === PET_STATUS.DEAD && delta <= 0) return;
    transitionStatus(nextStatus, eventCollector);
  }

  function ingest(rawEvent, eventCollector) {
    const domainClass = classifyDomain(rawEvent.domain);
    const event = {
      ...rawEvent,
      domainClass,
      timestamp: rawEvent.timestamp ?? nowIso()
    };

    if (!allowRevive && state.status === PET_STATUS.DEAD) {
      return event;
    }

    const delta = getHealthDeltaForEvent(event);
    if (delta > 0) state.lastFeedAt = nowIso();

    applyDelta(delta, eventCollector);
    return event;
  }

  function decay(eventCollector) {
    const millisSinceFeed = Date.now() - new Date(state.lastFeedAt).getTime();
    const delta = getDecayDelta({ millisSinceFeed });
    if (!allowRevive && state.status === PET_STATUS.DEAD) return;

    applyDelta(delta, eventCollector);
    return {
      type: EVENT_TYPES.DECAY_TICK,
      timestamp: nowIso(),
      source: "engine",
      meta: { millisSinceFeed, delta }
    };
  }

  return {
    config: { allowRevive, decayTickSeconds },
    getState: snapshot,
    ingest,
    decay
  };
}
