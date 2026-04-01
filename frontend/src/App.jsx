import { useEffect, useState } from "react";
import { getEvents, getHealth, getPet, sendStatusNotification } from "./lib/api.js";
import { connectWs } from "./lib/ws.js";

function HealthBar({ health }) {
  const total = 15;
  const filled = Math.round((health / 100) * total);

  return (
    <div className="flex items-center gap-3 rounded-lg border-2 border-shell-bezel bg-white px-3 py-2">
      <span className="text-[10px] font-bold tracking-wider">Health</span>
      <div className="flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="health-segment"
            style={{
              background: i < filled
                ? health <= 20 ? "#ef4444" : health <= 50 ? "#f59e0b" : "#5ec6c0"
                : "#d1d5db"
            }}
          />
        ))}
      </div>
      <span className="ml-auto text-[10px] font-bold">{health}/100</span>
    </div>
  );
}

function MessageBox({ message }) {
  return (
    <div className="rounded-lg border-2 border-shell-bezel bg-white px-4 py-3">
      <p className="min-h-[2.5rem] text-[10px] leading-relaxed">
        {message || "\u00A0"}
      </p>
      <div className="mt-1 inline-block h-3 w-2 animate-pulse bg-slate-400" />
    </div>
  );
}

function buildMessage(pet, latestEvent) {
  if (!pet) return "connecting...";
  if (pet.status === "dead") return "i died... you stopped scrolling...";
  if (pet.status === "critical") return "i'm fading... please scroll...";

  if (latestEvent) {
    if (latestEvent.type === "reels_scroll") return "nom nom scrolls...";
    if (latestEvent.type === "tab_active") {
      if (latestEvent.domainClass === "good")
        return `you opened ${latestEvent.domain}... i feel weaker`;
      if (latestEvent.domainClass === "bad")
        return `${latestEvent.domain}... yes... doom scroll for me...`;
    }
    if (latestEvent.type === "decay_tick") return "i'm getting hungry... scroll something...";
  }

  return "feed me scrolls...";
}

export default function App() {
  const [pet, setPet] = useState(null);
  const [events, setEvents] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [error, setError] = useState("");
  const [smsState, setSmsState] = useState({ sending: false, message: "" });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [healthPayload, petPayload, eventsPayload] = await Promise.all([
          getHealth(),
          getPet(),
          getEvents(50)
        ]);
        if (cancelled) return;
        setBackendOnline(Boolean(healthPayload.ok));
        setPet(petPayload.item);
        setEvents(eventsPayload.items ?? []);
        setError("");
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setBackendOnline(false);
      }
    }

    bootstrap();

    const pollId = setInterval(async () => {
      try {
        const healthPayload = await getHealth();
        if (!cancelled) setBackendOnline(Boolean(healthPayload.ok));
      } catch {
        if (!cancelled) setBackendOnline(false);
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
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

    socket.addEventListener("close", () => setBackendOnline(false));

    return () => socket.close();
  }, []);

  const health = Math.max(0, Math.min(100, Number(pet?.health ?? 0)));
  const latestEvent = events[0] ?? null;
  const message = buildMessage(pet, latestEvent);

  async function handleSendSms() {
    setSmsState({ sending: true, message: "" });
    try {
      await sendStatusNotification();
      setSmsState({ sending: false, message: "SMS sent." });
    } catch (err) {
      setSmsState({ sending: false, message: err?.message ?? "Failed." });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-[28px] border-4 border-shell-bezel bg-shell-outer p-2 shadow-2xl">
          <div className="rounded-[22px] bg-shell-inner p-5">

            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-1 rounded bg-[#f8c4c0] px-2 py-1 text-[10px] font-bold">
                <span>{backendOnline ? "ON" : "OFF"}</span>
              </div>
              <div className="text-center">
                <h1 className="rounded bg-shell-bezel px-4 py-1 text-sm font-bold tracking-widest text-white">
                  DOOMAGOTCHI
                </h1>
                <p className="mt-1 text-[8px] text-shell-bezel">a pet that feeds on doom</p>
              </div>
              <div className="w-10" />
            </div>

            <HealthBar health={health} />

            <div className="screen-lines mt-3 flex h-64 items-center justify-center rounded-lg border-2 border-shell-bezel bg-shell-screen">
              {error && (
                <p className="px-4 text-center text-[9px] text-red-700">{error}</p>
              )}
            </div>

            <div className="mt-3">
              <MessageBox message={message} />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendSms}
                disabled={!backendOnline || smsState.sending}
                className="rounded border-2 border-shell-bezel bg-white px-3 py-1 text-[9px] font-bold text-shell-bezel disabled:opacity-50"
              >
                {smsState.sending ? "Sending..." : "Send SMS"}
              </button>
              {smsState.message && (
                <span className="text-[8px] text-shell-bezel">{smsState.message}</span>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
