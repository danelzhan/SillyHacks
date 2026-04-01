export default function EventLogList({ events }) {
  return (
    <div className="rounded-lg bg-slate-900 p-4 shadow">
      <p className="text-xs uppercase text-slate-400">Event Stream</p>
      <ul className="mt-3 max-h-[420px] space-y-2 overflow-auto">
        {events.map((event, idx) => (
          <li key={`${event.type}-${event.timestamp}-${idx}`} className="rounded bg-slate-800 p-2 text-sm">
            <div className="font-medium">{event.type}</div>
            <div className="text-slate-400">
              {event.domain ? `${event.domain} • ` : ""}
              {new Date(event.timestamp ?? Date.now()).toLocaleTimeString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
