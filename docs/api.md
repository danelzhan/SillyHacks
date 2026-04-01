# Scrollagotchi API

Base URL: `http://localhost:8787`

## Health

- `GET /api/health`
- Response:

```json
{
  "ok": true,
  "service": "scrollagotchi-backend",
  "port": 8787,
  "events": 12
}
```

## Pet state

- `GET /api/pet`
- Response:

```json
{
  "item": {
    "health": 58,
    "status": "alive",
    "lastFeedAt": "2026-04-01T14:00:00.000Z",
    "lastEventAt": "2026-04-01T14:01:00.000Z",
    "createdAt": "2026-04-01T13:55:00.000Z"
  }
}
```

## Event ingestion

- `POST /api/events`
- Request body:

```json
{
  "type": "tab_active",
  "source": "extension_bg",
  "url": "https://www.instagram.com/reels/",
  "domain": "instagram.com",
  "meta": {
    "title": "Instagram"
  }
}
```

- Success response:

```json
{
  "ok": true,
  "event": {
    "type": "tab_active",
    "timestamp": "2026-04-01T14:01:00.000Z",
    "source": "extension_bg",
    "domain": "instagram.com",
    "url": "",
    "meta": {
      "title": "Instagram"
    },
    "domainClass": "bad"
  },
  "pet": {
    "health": 62,
    "status": "alive",
    "lastFeedAt": "2026-04-01T14:01:00.000Z",
    "lastEventAt": "2026-04-01T14:01:00.000Z",
    "createdAt": "2026-04-01T13:55:00.000Z"
  }
}
```

- Validation errors:
  - `422` when event `type` is missing/invalid
  - `422` when neither `domain` nor `url` is provided

## Event listing

- `GET /api/events?limit=50`
- Response:

```json
{
  "items": []
}
```

## WebSocket

- `ws://localhost:8787/ws`
- Message envelope:
  - `bootstrap` with `{ pet, events }`
  - `pet_state` with current pet snapshot
  - `event` for each ingested and lifecycle event
