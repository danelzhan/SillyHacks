import { useEffect, useMemo, useState } from "react";
import PetHealthCard from "./components/PetHealthCard.jsx";
import EventLogList from "./components/EventLogList.jsx";
import { getEvents, getHealth, getPet, sendStatusNotification } from "./lib/api.js";
import { connectWs } from "./lib/ws.js";

function classCounts(events) {
  return events.reduce(
    (acc, event) => {
      if (event.domainClass === "bad") acc.bad += 1;
      else if (event.domainClass === "good") acc.good += 1;
      else acc.neutral += 1;
      return acc;
    },
    { bad: 0, neutral: 0, good: 0 }
  );
}

export default function App() {
  const [pet, setPet] = useState(null);
  const [events, setEvents] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [error, setError] = useState("");
  const [notificationState, setNotificationState] = useState({
    sending: false,
    message: ""
  });

  useEffect(() => {
    async function bootstrap() {
      try {
        const [healthPayload, petPayload, eventsPayload] = await Promise.all([
          getHealth(),
          getPet(),
          getEvents(50)
        ]);
        setBackendOnline(Boolean(healthPayload.ok));
        setPet(petPayload.item);
        setEvents(eventsPayload.items ?? []);
      } catch (err) {
        setError(err.message);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    const socket = connectWs((message) => {
      if (message.type === "pet_state") setPet(message.payload);
      if (message.type === "event") setEvents((prev) => [message.payload, ...prev].slice(0, 100));
      if (message.type === "bootstrap") {
        setPet(message.payload?.pet ?? null);
        setEvents(message.payload?.events ?? []);
      }
      setBackendOnline(true);
    });

    socket.onclose = () => setBackendOnline(false);
    socket.onerror = () => setBackendOnline(false);

    return () => socket.close();
  }, []);

  const counts = useMemo(() => classCounts(events), [events]);

  async function handleSendNotification() {
    setNotificationState({ sending: true, message: "" });
    try {
      await sendStatusNotification();
      setNotificationState({
        sending: false,
        message: "SMS sent."
      });
    } catch (err) {
      setNotificationState({
        sending: false,
        message: err?.message ?? "Failed to send SMS."
      });
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scrollagotchi Dashboard</h1>
        <span
          className={`rounded px-3 py-1 text-xs font-semibold ${
            backendOnline ? "bg-emerald-800 text-emerald-100" : "bg-rose-800 text-rose-100"
          }`}
        >
          {backendOnline ? "Backend Online" : "Backend Offline"}
        </span>
      </header>

      {error ? <p className="mb-4 rounded bg-rose-900 p-3 text-rose-100">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <PetHealthCard pet={pet} />
        <div className="rounded-lg bg-slate-900 p-4 shadow">
          <p className="text-xs uppercase text-slate-400">Domain Class Counts</p>
          <p className="mt-2 text-sm">Bad: {counts.bad}</p>
          <p className="text-sm">Neutral: {counts.neutral}</p>
          <p className="text-sm">Good: {counts.good}</p>
        </div>
        <div className="rounded-lg bg-slate-900 p-4 shadow">
          <p className="text-xs uppercase text-slate-400">Latest Event</p>
          <p className="mt-2 text-sm">
            {events[0]?.type ?? "none"} {events[0]?.domain ? `• ${events[0].domain}` : ""}
          </p>
          <button
            type="button"
            onClick={handleSendNotification}
            disabled={!backendOnline || notificationState.sending}
            className="mt-4 rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {notificationState.sending ? "Sending..." : "Send status SMS"}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            {notificationState.message || "Manually trigger the Twilio helper for now."}
          </p>
        </div>
      </section>

      <section className="mt-4">
        <EventLogList events={events} />
      </section>
    </div>
  );
}
