# Event Schema

Core event shape sent to `POST /api/events`:

```json
{
  "type": "tab_active | reels_scroll | idle_tick",
  "timestamp": "ISO date optional",
  "source": "string optional",
  "url": "string optional",
  "domain": "string optional when url present",
  "meta": {}
}
```

Server-enriched fields:

- `domainClass`: `bad | neutral | good`
- `timestamp`: populated with server time if omitted

Engine lifecycle events (server-generated):

- `critical_entered`
- `died`
- `revived`
- `decay_tick`

`reels_scroll` expected `meta`:

```json
{
  "bucket": "low | medium | high",
  "perMinute": 18
}
```

Suggested domain-class policy:

- `bad`: social feed and short-form domains that feed health
- `neutral`: uncategorized/general browsing
- `good`: work/documentation domains that starve health
