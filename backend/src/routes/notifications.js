import express from "express";

export function createNotificationsRouter({ engine, notifier, store, wsHub }) {
  const router = express.Router();

  router.post("/status", async (req, res) => {
    const pet = engine.getState();
    const lastEvent = store.list(1)[0] ?? null;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    try {
      const result = await notifier.sendStatusNotification({
        pet,
        event: lastEvent,
        note
      });

      if (!result.configured) {
        return res.status(503).json({
          ok: false,
          configured: false,
          error: "Twilio is not configured."
        });
      }

      const notificationEvent = {
        type: "status_notification_sent",
        timestamp: new Date().toISOString(),
        source: "backend",
        domain: lastEvent?.domain ?? "",
        meta: {
          note,
          sid: result.sid ?? null
        }
      };

      store.add(notificationEvent);
      wsHub.broadcast({ type: "event", payload: notificationEvent });

      return res.json({
        ok: true,
        configured: true,
        sent: true,
        sid: result.sid ?? null
      });
    } catch (error) {
      return res.status(502).json({
        ok: false,
        configured: true,
        sent: false,
        error: error?.message ?? "Failed to send Twilio message."
      });
    }
  });

  return router;
}
