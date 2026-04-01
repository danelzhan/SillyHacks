export default function PetHealthCard({ pet }) {
  const health = Math.max(0, Math.min(100, Number(pet?.health ?? 0)));
  const color =
    health <= 20 ? "bg-red-500" : health <= 50 ? "bg-amber-500" : "bg-sky-500";

  return (
    <div className="rounded-lg bg-slate-900 p-4 shadow">
      <p className="text-xs uppercase text-slate-400">Pet Health</p>
      <p className="mt-1 text-3xl font-bold">{health}</p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-700">
        <div className={`${color} h-full`} style={{ width: `${health}%` }} />
      </div>
      <p className="mt-2 text-sm text-slate-300">Status: {pet?.status ?? "unknown"}</p>
    </div>
  );
}
