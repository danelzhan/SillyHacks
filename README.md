# Scrollagotchi

Scrollagotchi is a Chrome-extension-first MVP where a pet dies if you stop scrolling.

- Extension captures active tab activity and Instagram Reels scroll signals.
- Backend applies feed/decay rules and maintains pet health/state.
- React dashboard observes pet status and event logs in real-time.

## Project structure

- `backend/` Express + WebSocket + in-memory state engine
- `extension/` Manifest V3 Chrome extension UI/tracking
- `frontend/` React + Vite + Tailwind observer dashboard
- `docs/` API and schema docs

## 1) Run backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Default backend URL: `http://localhost:8787`

## 2) Run dashboard

```bash
cd frontend
npm install
npm run dev
```

Default dashboard URL: `http://localhost:5173`

## 3) Load extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `extension/`

Open the extension popup to view pet health and recent events.

## Verify quickly

With backend running:

```bash
cd backend
npm run replay
```

This sends synthetic events and prints pet state transitions.

## Config

See `backend/.env.example`:

- `ALLOW_REVIVE` to allow revival from dead state
- `STORE_FULL_URL` to persist full URLs
- `DECAY_TICK_SECONDS` decay interval
- `EVENT_LOG_LIMIT` in-memory log cap

## Notes

- LinkedIn/X posting is intentionally excluded from this MVP.
- Backend decay timer is source of truth to avoid MV3 worker-sleep drift.
