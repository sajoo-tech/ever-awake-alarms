import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlarmOverlay } from "@/components/damla/AlarmOverlay";
import { SettingsSheet } from "@/components/damla/SettingsSheet";
import {
  cancelAllAlarms,
  initNotifications,
  requestExactAlarmSetup,
  rescheduleAll,
  scheduleSnooze,
  testNotification,
} from "@/lib/damla/alarms";
import { startAlarmSound, stopAlarmSound } from "@/lib/damla/sound";
import {
  allDoses,
  dateKey,
  defaultState,
  doseDone,
  dosesForDay,
  fmtTime,
  isTaken,
  loadState,
  midnight,
  nextDose,
  parseISO,
  saveState,
  stats,
  STORE_KEY,
  todayISO,
  treatmentDay,
} from "@/lib/damla/state";
import type { AppState, Dose } from "@/lib/damla/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Damla Takip — Göz Damlası Alarm ve Tedavi Takibi" },
      {
        name: "description",
        content:
          "Göz damlası tedaviniz için birebir alarm: uygulama kapalıyken bile çalan doz hatırlatıcıları, ilerleme takibi ve esnek saat ayarları.",
      },
      { property: "og:title", content: "Damla Takip — Göz Damlası Alarm Uygulaması" },
      {
        property: "og:description",
        content: "Uygulama kapalıyken bile çalan göz damlası alarmları ve tedavi ilerleme takibi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#2563EB" },
    ],
  }),
  component: DamlaApp,
});

const SNOOZE_KEY = "damla_snooze_v5";

function useNow(ms = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function DamlaApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [alarm, setAlarm] = useState<Dose | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const snoozeRef = useRef<Record<string, number>>({});
  const now = useNow();

  /* --- yükleme --- */
  useEffect(() => {
    setState(loadState());
    try {
      snoozeRef.current = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}");
    } catch {
      snoozeRef.current = {};
    }
    void initNotifications();
  }, []);

  /* --- kaydet + alarmları yeniden planla --- */
  useEffect(() => {
    if (!state) return;
    saveState(state);
    if (state.settings.alarmsEnabled) void rescheduleAll(state);
    else void cancelAllAlarms();
  }, [state]);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((s) => (s ? { ...s, ...patch } : s));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const markTaken = useCallback((d: Dose) => {
    setState((s) => {
      if (!s) return s;
      const taken = { ...s.taken };
      for (const m of d.meds) taken[`${d.dayKey}|${d.slot.id}|${m.id}`] = true;
      return { ...s, taken };
    });
  }, []);

  const toggleMed = useCallback((dayKey: string, slotId: string, medId: string) => {
    setState((s) => {
      if (!s) return s;
      const k = `${dayKey}|${slotId}|${medId}`;
      const taken = { ...s.taken };
      if (taken[k]) delete taken[k];
      else taken[k] = true;
      return { ...s, taken };
    });
  }, []);

  /* --- uygulama açıkken alarm kontrolü --- */
  useEffect(() => {
    if (!state || !now || !state.setupDone || !state.settings.alarmsEnabled || alarm) return;
    const t = now.getTime();
    const due = allDoses(state).find((d) => {
      if (doseDone(state, d)) return false;
      const snoozed = snoozeRef.current[d.key] ?? 0;
      const at = Math.max(d.dt.getTime(), snoozed);
      return t >= at && t - at < 60 * 60 * 1000;
    });
    if (due) {
      setAlarm(due);
      startAlarmSound(state.settings);
    }
  }, [now, state, alarm]);

  /* --- bildirim aksiyonları (Android) --- */
  useEffect(() => {
    if (!state) return;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
      if (!cap?.isNativePlatform?.()) return;
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const handle = await LocalNotifications.addListener("localNotificationActionPerformed", (ev) => {
        const key = (ev.notification.extra as { key?: string } | undefined)?.key;
        if (!key) return;
        const cur = loadState();
        const dose = allDoses(cur).find((d) => d.key === key);
        if (!dose) return;
        if (ev.actionId === "take") {
          markTaken(dose);
        } else if (ev.actionId === "snooze") {
          const min = cur.settings.snooze;
          snoozeRef.current[key] = Date.now() + min * 60 * 1000;
          localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozeRef.current));
          void scheduleSnooze(dose, min);
        } else {
          setAlarm(dose);
          startAlarmSound(cur.settings);
        }
      });
      cleanup = () => void handle.remove();
    })();
    return () => cleanup?.();
  }, [state, markTaken]);

  const closeAlarm = useCallback(() => {
    stopAlarmSound();
    setAlarm(null);
  }, []);

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-4xl">💧</span>
      </main>
    );
  }

  if (!state.setupDone) {
    return <Setup state={state} update={update} />;
  }

  const next = now ? nextDose(state, now) : null;
  const st = stats(state);
  const today = now ?? new Date();
  const dayNo = treatmentDay(state, today);
  const started = midnight(today) >= midnight(parseISO(state.startDate));
  const todayDoses = dosesForDay(state, today);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-background pb-10">
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card px-4 pb-3">
        <div>
          <h1 className="text-lg font-extrabold leading-tight">Tedavi Programı</h1>
          <p className="text-xs font-bold text-muted-foreground">
            {now ? now.toLocaleTimeString("tr-TR") : "--:--:--"}
            <span className={state.settings.alarmsEnabled ? "text-success" : "text-destructive"}>
              {state.settings.alarmsEnabled ? " • ALARMLAR AKTİF" : " • ALARMLAR KAPALI"}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="rounded-xl bg-muted px-3 py-2.5 text-lg"
          aria-label="Ayarlar"
        >
          ⚙️
        </button>
      </header>

      <div className="space-y-4 p-4">
        {!state.settings.alarmsEnabled && (
          <div className="rounded-2xl bg-destructive-soft p-3 text-xs font-bold text-destructive">
            ⚠️ Alarmlar kapalı. Ayarlar bölümündeki büyük düğmeden tekrar açabilirsin.
          </div>
        )}

        {/* SIRADAKİ DOZ */}
        <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Sıradaki Doz
            </span>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-extrabold text-primary">
              {!started ? "BEKLİYOR" : next ? "PLANLI" : "TAMAMLANDI"}
            </span>
          </div>
          <div className="mt-2 text-5xl font-black tracking-tight">
            {!started ? "—" : next ? fmtTime(next.dt) : "🎉"}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {next?.meds.map((m) => (
              <span
                key={m.id}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold text-secondary-foreground"
              >
                {m.name}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">
            {!started
              ? `Tedavi ${state.startDate} tarihinde başlıyor`
              : next
                ? `${next.slot.label} dozu • ${next.dt.toLocaleDateString("tr-TR")}`
                : "Tüm dozlar tamamlandı, geçmiş olsun!"}
          </p>
        </section>

        {/* İLERLEME */}
        <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold">📊 Tedavi İlerlemesi</h2>
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-extrabold text-muted-foreground">
              {started && dayNo <= state.days ? `${dayNo}. GÜN / ${state.days}` : "—"}
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${st.perc}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { v: st.taken, l: "Alınan" },
              { v: st.total, l: "Toplam" },
              { v: `%${st.perc}`, l: "Tamamlanan" },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl bg-secondary py-3">
                <div className="text-xl font-black">{x.v}</div>
                <div className="text-[11px] font-bold text-muted-foreground">{x.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* BUGÜN */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Bugünün Programı
            </h2>
            <span className="text-xs font-bold text-muted-foreground">
              {today.toLocaleDateString("tr-TR")}
            </span>
          </div>
          <div className="space-y-2.5">
            {todayDoses.map((d) => {
              const done = doseDone(state, d);
              const past = d.dt.getTime() < today.getTime();
              return (
                <div
                  key={d.key}
                  className={`rounded-2xl border-l-4 bg-card p-4 shadow-[var(--shadow-card)] ${
                    done ? "border-l-success" : past ? "border-l-destructive" : "border-l-primary"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-black">{fmtTime(d.dt)}</div>
                      <div className="text-xs font-bold text-muted-foreground">{d.slot.label}</div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                        done
                          ? "bg-success-soft text-success"
                          : past
                            ? "bg-destructive-soft text-destructive"
                            : "bg-primary-soft text-primary"
                      }`}
                    >
                      {done ? "TAMAM" : past ? "GECİKTİ" : "BEKLİYOR"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.meds.map((m) => {
                      const on = isTaken(state, d.dayKey, d.slot.id, m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMed(d.dayKey, d.slot.id, m.id)}
                          className={`rounded-full border px-3 py-2 text-xs font-extrabold transition-colors ${
                            on
                              ? "border-success bg-success-soft text-success"
                              : "border-border bg-secondary text-muted-foreground"
                          }`}
                        >
                          {on ? "✓ " : ""}
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {alarm && (
        <AlarmOverlay
          dose={alarm}
          snoozeMinutes={state.settings.snooze}
          onTake={() => {
            markTaken(alarm);
            closeAlarm();
            showToast("Doz kaydedildi 👍");
          }}
          onSnooze={() => {
            const min = state.settings.snooze;
            snoozeRef.current[alarm.key] = Date.now() + min * 60 * 1000;
            localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozeRef.current));
            void scheduleSnooze(alarm, min);
            closeAlarm();
            showToast(`${min} dakika ertelendi`);
          }}
        />
      )}

      {showSettings && (
        <SettingsSheet
          state={state}
          update={update}
          onClose={() => setShowSettings(false)}
          onTest={() => {
            void testNotification();
            showToast("Test alarmı 5 saniye sonra gelecek");
          }}
          onExactAlarm={() => void requestExactAlarmSetup()}
          onReset={() => {
            if (!confirm("Tüm veriler silinsin mi?")) return;
            localStorage.removeItem(STORE_KEY);
            localStorage.removeItem(SNOOZE_KEY);
            void cancelAllAlarms();
            setState(defaultState());
            setShowSettings(false);
          }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 top-4 z-[90] flex justify-center px-4">
          <div className="rounded-2xl bg-foreground px-4 py-3 text-sm font-bold text-background shadow-[var(--shadow-float)]">
            {toast}
          </div>
        </div>
      )}
    </main>
  );
}

function Setup({ state, update }: { state: AppState; update: (p: Partial<AppState>) => void }) {
  const [name, setName] = useState(state.name);
  const [date, setDate] = useState(state.startDate || todayISO());
  const [days, setDays] = useState(state.days);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-foreground to-primary p-5">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-[var(--shadow-float)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl">
          💧
        </div>
        <h1 className="text-center text-xl font-extrabold">Damla Takip</h1>
        <p className="mt-1 text-center text-xs font-bold text-muted-foreground">
          Göz damlası alarm asistanı
        </p>

        <div className="mt-5 rounded-2xl bg-success-soft p-3 text-xs font-semibold text-success">
          ✅ Alarmlar telefonun kendi alarm sistemine kurulur. Uygulama kapalı olsa bile zamanında
          çalar.
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Adınız">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Ayşen"
              className="w-full rounded-xl border border-input bg-secondary px-4 py-3.5 text-sm font-bold"
            />
          </Field>
          <Field label="Tedavi başlangıç tarihi">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-input bg-secondary px-4 py-3.5 text-sm font-bold"
            />
          </Field>
          <Field label="Tedavi süresi (gün)">
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-xl border border-input bg-secondary px-4 py-3.5 text-sm font-bold"
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={async () => {
            await initNotifications();
            await requestExactAlarmSetup();
            update({ setupDone: true, name: name.trim() || "Kullanıcı", startDate: date, days });
          }}
          className="mt-5 w-full rounded-2xl bg-primary py-4 text-base font-black text-primary-foreground shadow-[var(--shadow-card)] active:scale-[0.99]"
        >
          ▶ Alarmları Kur ve Başlat
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
