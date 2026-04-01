export function createEventStore(limit = 500) {
  const events = [];

  return {
    add(event) {
      events.unshift(event);
      if (events.length > limit) events.length = limit;
      return event;
    },
    list(limitCount = 50) {
      return events.slice(0, limitCount);
    },
    count() {
      return events.length;
    }
  };
}
