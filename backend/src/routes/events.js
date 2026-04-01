import express from "express";
import { EVENT_TYPES } from "../state/constants.js";

const ALLOWED_TYPES = new Set([
  EVENT_TYPES.TAB_ACTIVE,
  EVENT_TYPES.REELS_SCROLL,
  EVENT_TYPES.IDLE_TICK
]);

export function createEventsRouter({ store, engine, wsHub, storeFullUrl }) {
  const router = express.Router();
  const REELS_DEDUPE_WINDOW_MS = 900;
  let lastReelsFingerprint = "";
  let lastReelsAt = 0;

  router.post("/", (req, res) => {
    const payload = req.body ?? {};
    if (!payload.type || !ALLOWED_TYPES.has(payload.type)) {
      return res.status(422).json({ error: "Invalid or missing event type." });
    }

    if (!payload.domain && !payload.url) {
      return res.status(422).json({ error: "domain or url is required." });
    }

    if (payload.type === EVENT_TYPES.REELS_SCROLL) {
      const fingerprint = [
        payload.source ?? "extension",
        payload.domain ?? "",
        payload.url ?? "",
        payload.meta?.bucket ?? "",
        Number(payload.meta?.perMinute ?? 0)
      ].join("|");
      const now = Date.now();

      if (fingerprint === lastReelsFingerprint && now - lastReelsAt <= REELS_DEDUPE_WINDOW_MS) {
        return res.status(202).json({ ok: true, duplicate: true, pet: engine.getState() });
      }

      lastReelsFingerprint = fingerprint;
      lastReelsAt = now;
    }

    const event = {
      type: payload.type,
      timestamp: payload.timestamp,
      source: payload.source ?? "extension",
      domain: payload.domain ?? "",
      url: storeFullUrl ? payload.url ?? "" : "",
      meta: payload.meta ?? {}
    };

    const normalized = engine.ingest(event, (sideEvent) => {
      store.add(sideEvent);
      wsHub.broadcast({ type: "event", payload: sideEvent });
    });

    store.add(normalized);
    const pet = engine.getState();

    wsHub.broadcast({ type: "event", payload: normalized });
    wsHub.broadcast({ type: "pet_state", payload: pet });
    return res.status(201).json({ ok: true, event: normalized, pet });
  });

  router.get("/", (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    res.json({ items: store.list(limit) });
  });

  return router;
}
