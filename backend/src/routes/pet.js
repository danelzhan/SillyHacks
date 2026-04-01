import express from "express";

export function createPetRouter({ engine, narrator, store, wsHub }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json({ item: engine.getState() });
  });

  router.post("/restart", (req, res) => {
    const restartEvent = engine.restart((sideEvent) => {
      store.add(sideEvent);
      wsHub.broadcast({ type: "event", payload: sideEvent });
    });

    store.add(restartEvent);
    wsHub.broadcast({ type: "event", payload: restartEvent });
    wsHub.broadcast({ type: "pet_state", payload: engine.getState() });
    res.status(201).json({
      ok: true,
      item: engine.getState(),
      event: restartEvent
    });
  });

  router.get("/summary", async (req, res) => {
    const currentUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    const pet = engine.getState();
    const latestEvent = store?.list?.(1)?.[0] ?? null;

    try {
      const summary = await narrator.generatePetSummary({
        pet,
        event: latestEvent,
        currentUrl: currentUrl || (latestEvent?.meta?.pageUrl ?? latestEvent?.url ?? "")
      });

      res.json({
        ok: true,
        item: summary
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: error?.message ?? "Failed to generate pet summary."
      });
    }
  });

  return router;
}
