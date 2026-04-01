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
import { createTwilioNotifier } from "./services/twilioNotifier.js";

const PORT = Number(process.env.PORT ?? 8787);
const EVENT_LOG_LIMIT = Number(process.env.EVENT_LOG_LIMIT ?? 500);
const STORE_FULL_URL = (process.env.STORE_FULL_URL ?? "false").toLowerCase() === "true";

const engine = createPetEngine({
  allowRevive: (process.env.ALLOW_REVIVE ?? "true").toLowerCase() === "true",
  decayTickSeconds: Number(process.env.DECAY_TICK_SECONDS ?? 1),
  initialHealth: Number(process.env.INITIAL_HEALTH ?? 50)
});

const store = createEventStore(EVENT_LOG_LIMIT);
const notifier = createTwilioNotifier();
const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "1mb" }));

const server = createServer(app);
const wsHub = createWsHub(server);

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
    store,
    wsHub
  })
);
app.use("/api/pet", createPetRouter({ engine }));

setInterval(() => {
  const decayEvent = engine.decay((sideEvent) => {
    store.add(sideEvent);
    wsHub.broadcast({ type: "event", payload: sideEvent });
  });
  if (decayEvent) {
    store.add(decayEvent);
    wsHub.broadcast({ type: "event", payload: decayEvent });
    wsHub.broadcast({ type: "pet_state", payload: engine.getState() });
  }
}, engine.config.decayTickSeconds * 1000);

server.listen(PORT, () => {
  console.log(`Scrollagotchi backend listening at http://localhost:${PORT}`);
});
