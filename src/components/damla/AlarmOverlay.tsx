import type { Dose } from "@/lib/damla/types";
import { fmtTime } from "@/lib/damla/state";

const gradients: Record<string, string> = {
  pred: "from-destructive to-destructive/70",
  moxai: "from-primary to-primary/70",
  apfecto: "from-apfecto to-apfecto/70",
  mix: "from-primary via-apfecto to-destructive",
};

export function AlarmOverlay({
  dose,
  snoozeMinutes,
  onTake,
  onSnooze,
}: {
  dose: Dose;
  snoozeMinutes: number;
  onTake: () => void;
  onSnooze: () => void;
}) {
  const key = dose.meds.length > 1 ? "mix" : (dose.meds[0]?.color ?? "moxai");
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/90 p-5 backdrop-blur-sm">
      <div
        className={`w-full max-w-sm rounded-3xl bg-gradient-to-br ${gradients[key] ?? gradients.moxai} p-8 text-center text-primary-foreground shadow-[var(--shadow-float)] animate-in zoom-in-95 duration-300`}
      >
        <span className="inline-block rounded-full bg-white/20 px-4 py-1.5 text-[11px] font-extrabold tracking-[2px]">
          🔔 DOZ ZAMANI
        </span>
        <div className="mt-4 text-6xl font-black leading-none tracking-tight">{fmtTime(dose.dt)}</div>
        <div className="mt-2 text-sm font-bold opacity-85">{dose.slot.label} dozu</div>

        <div className="mt-6 rounded-2xl border-2 border-white/35 bg-white/15 p-4">
          <div className="text-lg font-black leading-snug">{dose.meds.map((m) => m.name).join(" + ")}</div>
          <div className="mt-1.5 text-xs font-bold opacity-85">Şimdi damlat, gözünü 1-2 dk kapalı tut</div>
        </div>

        <div className="mt-6 grid gap-2.5">
          <button
            type="button"
            onClick={onTake}
            className="rounded-full bg-white px-5 py-4 text-base font-black text-foreground shadow-lg active:scale-[0.98]"
          >
            ✓ Damlattım
          </button>
          <button
            type="button"
            onClick={onSnooze}
            className="rounded-full border border-white/35 bg-white/20 px-5 py-3.5 text-sm font-extrabold active:scale-[0.98]"
          >
            ⏰ {snoozeMinutes} dk ertele
          </button>
        </div>
      </div>
    </div>
  );
}
