import express from "express";
import { EVENT_TYPES } from "../state/constants.js";

const ALLOWED_TYPES = new Set([
  EVENT_TYPES.TAB_ACTIVE,
  EVENT_TYPES.REELS_SCROLL,
  EVENT_TYPES.IDLE_TICK
]);

export function createEventsRouter({ store, engine, wsHub, storeFullUrl }) {
  const router = express.Router();
  router.post("/", (req, res) => {
    const payload = req.body ?? {};
    if (!payload.type || !ALLOWED_TYPES.has(payload.type)) {
      return res.status(422).json({ error: "Invalid or missing event type." });
    }

    if (!payload.domain && !payload.url) {
      return res.status(422).json({ error: "domain or url is required." });
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
