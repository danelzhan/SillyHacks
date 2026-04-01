import express from "express";

export function createNotificationsRouter({ engine, notifier, narrator, store, wsHub }) {
  const router = express.Router();

  router.get("/arm", (_req, res) => {
    res.json({
      ok: true,
      armed: notifier.isArmed(),
      cooldownMs: notifier.isOnCooldown() ? notifier.cooldownRemainingMs() : 0
    });
  });

  router.post("/arm", (req, res) => {
    const armed = notifier.setArmed(Boolean(req.body?.armed));
    res.json({ ok: true, armed });
  });

  router.post("/status", async (req, res) => {
    const pet = engine.getState();
    const lastEvent = store.list(1)[0] ?? null;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    const currentUrl =
      typeof req.body?.url === "string"
        ? req.body.url.trim()
        : lastEvent?.meta?.pageUrl ?? lastEvent?.url ?? "";

    if (!notifier.isArmed()) {
      return res.status(423).json({
        ok: false,
        configured: true,
        armed: false,
        error: "Twilio notifications are turned off."
      });
    }

    if (notifier.isOnCooldown()) {
      return res.status(429).json({
        ok: false,
        configured: true,
        armed: true,
        retryAfterMs: notifier.cooldownRemainingMs(),
        error: "Twilio notification cooldown is active."
      });
    }

    try {
      const composed = await narrator.generateTwilioMessage({
        pet,
        event: lastEvent,
        currentUrl,
        note
      });

      const result = await notifier.sendStatusNotification({
        pet,
        event: lastEvent,
        note,
        body: composed.text
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
          sid: result.sid ?? null,
          currentUrl,
          messageSource: composed.source,
          trigger: "manual"
        }
      };

      store.add(notificationEvent);
      wsHub.broadcast({ type: "event", payload: notificationEvent });

      return res.json({
        ok: true,
        configured: true,
        sent: true,
        armed: true,
        sid: result.sid ?? null,
        messageSource: composed.source,
        retryAfterMs: 0
      });
    } catch (error) {
      return res.status(502).json({
        ok: false,
        configured: true,
        sent: false,
        armed: notifier.isArmed(),
        error: error?.message ?? "Failed to send Twilio message."
      });
    }
  });

  return router;
}
