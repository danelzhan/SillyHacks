import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import { createEventStore } from "./state/eventStore.js";
import { createPetEngine } from "./state/petEngine.js";
import { createEventsRouter } from "./routes/events.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createPetRouter } from "./routes/pet.js";
import { createWsHub } from "./ws/hub.js";
import { createGeminiHelper } from "./services/geminiHelper.js";
import { createPetNarrator } from "./services/petNarrator.js";
import { createTwilioNotifier } from "./services/twilioNotifier.js";

const PORT = Number(process.env.PORT ?? 8787);
const EVENT_LOG_LIMIT = Number(process.env.EVENT_LOG_LIMIT ?? 500);
const STORE_FULL_URL = (process.env.STORE_FULL_URL ?? "false").toLowerCase() === "true";

const store = createEventStore(EVENT_LOG_LIMIT);
const notifier = createTwilioNotifier();
const gemini = createGeminiHelper();
const narrator = createPetNarrator({ gemini });
const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "1mb" }));

const server = createServer(app);
const wsHub = createWsHub(server);

let engine;

function triggerSpriteThresholdNotification(change) {
  void (async () => {
    const pet = engine?.getState?.() ?? null;
    const triggerEvent = change.triggerEvent ?? null;
    const note = `Sprite changed from ${change.previousSpriteTier} to ${change.nextSpriteTier}.`;

    try {
      const result = await notifier.sendStatusNotification({
        pet,
        event: triggerEvent,
        note,
        body: (await narrator.generateTwilioMessage({
          pet,
          event: triggerEvent,
          currentUrl: triggerEvent?.meta?.pageUrl ?? triggerEvent?.url ?? "",
          note
        })).text
      });

      if (!result.configured || !result.sent) return;

      const notificationEvent = {
        type: "status_notification_sent",
        timestamp: new Date().toISOString(),
        source: "backend",
        domain: triggerEvent?.domain ?? "",
        meta: {
          note,
          sid: result.sid ?? null,
          trigger: "sprite_threshold",
          previousSpriteTier: change.previousSpriteTier,
          nextSpriteTier: change.nextSpriteTier,
          health: change.health
        }
      };

      store.add(notificationEvent);
      wsHub.broadcast({ type: "event", payload: notificationEvent });
    } catch (error) {
      console.error("Failed to send sprite-threshold Twilio notification:", error);
    }
  })();
}

engine = createPetEngine({
  allowRevive: (process.env.ALLOW_REVIVE ?? "true").toLowerCase() === "true",
  decayTickSeconds: Number(process.env.DECAY_TICK_SECONDS ?? 1),
  initialHealth: Number(process.env.INITIAL_HEALTH ?? 50),
  onSpriteThresholdChange: triggerSpriteThresholdNotification
});

wsHub.attachBootstrap(() => ({
  pet: engine.getState(),
  events: store.list(20)
}));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "scrollagotchi-backend",
    port: PORT,
    events: store.count()
  });
});

app.use(
  "/api/events",
  createEventsRouter({
    store,
    engine,
    wsHub,
    storeFullUrl: STORE_FULL_URL
  })
);
app.use(
  "/api/notifications",
  createNotificationsRouter({
    engine,
    notifier,
    narrator,
    store,
    wsHub
  })
);
app.use("/api/pet", createPetRouter({ engine, narrator, store, wsHub }));

const DECAY_MS = engine.config.decayTickSeconds * 1000;
let nextDecay = Date.now() + DECAY_MS;

function decayTick() {
  const decayEvent = engine.decay((sideEvent) => {
    store.add(sideEvent);
    wsHub.broadcast({ type: "event", payload: sideEvent });
  });
  if (decayEvent) {
    store.add(decayEvent);
    wsHub.broadcast({ type: "event", payload: decayEvent });
    wsHub.broadcast({ type: "pet_state", payload: engine.getState() });
  }
  nextDecay += DECAY_MS;
  const drift = nextDecay - Date.now();
  setTimeout(decayTick, Math.max(0, drift));
}

setTimeout(decayTick, DECAY_MS);

server.listen(PORT, () => {
  console.log(`Scrollagotchi backend listening at http://localhost:${PORT}`);
});
