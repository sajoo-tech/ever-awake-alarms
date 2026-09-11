import type { AppState } from "@/lib/damla/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <span className="text-sm font-bold">{label}</span>
      {children}
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${on ? "bg-primary" : "bg-muted-foreground/35"}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-card shadow transition-transform ${on ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

export function SettingsSheet({
  state,
  update,
  onClose,
  onTest,
  onExactAlarm,
  onReset,
}: {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  onClose: () => void;
  onTest: () => void;
  onExactAlarm: () => void;
  onReset: () => void;
}) {
  const s = state.settings;
  const setS = (patch: Partial<AppState["settings"]>) => update({ settings: { ...s, ...patch } });

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <header className="safe-top sticky top-0 flex items-center justify-between border-b border-border bg-card px-4 pb-3">
        <h2 className="text-lg font-extrabold">Ayarlar</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-muted px-4 py-2 text-sm font-bold text-muted-foreground"
        >
          Kapat
        </button>
      </header>

      <div className="safe-bottom flex-1 space-y-4 overflow-y-auto p-4">
        {/* ALARM ANA ŞALTERİ */}
        <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Alarm Sistemi
          </h3>
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Alarmlar telefon kapalıyken ve uygulama kapalıyken de çalar. Sadece bu düğmeyle
            kapatılabilir.
          </p>
          <button
            type="button"
            onClick={() => setS({ alarmsEnabled: !s.alarmsEnabled })}
            className={`w-full rounded-2xl px-4 py-4 text-base font-black transition-colors ${
              s.alarmsEnabled
                ? "bg-success text-success-foreground"
                : "bg-destructive-soft text-destructive"
            }`}
          >
            {s.alarmsEnabled ? "🔔 ALARMLAR AÇIK — Kapatmak için bas" : "🔕 ALARMLAR KAPALI — Açmak için bas"}
          </button>
        </section>

        {/* SES */}
        <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Ses ve Titreşim
          </h3>
          <Row label="Sesli uyarı">
            <Switch on={s.sound} onChange={(v) => setS({ sound: v })} />
          </Row>
          <Row label="Titreşim">
            <Switch on={s.vib} onChange={(v) => setS({ vib: v })} />
          </Row>
          <Row label="Alarm tonu">
            <select
              value={s.tone}
              onChange={(e) => setS({ tone: e.target.value as AppState["settings"]["tone"] })}
              className="rounded-xl border border-input bg-secondary px-3 py-2 text-sm font-bold"
            >
              <option value="soft">Yumuşak</option>
              <option value="medium">Orta</option>
              <option value="urgent">Acil</option>
            </select>
          </Row>
          <Row label={`Ses seviyesi %${Math.round(s.volume * 100)}`}>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.1}
              value={s.volume}
              onChange={(e) => setS({ volume: Number(e.target.value) })}
              className="w-32 accent-[var(--primary)]"
            />
          </Row>
          <Row label="Erteleme süresi">
            <select
              value={s.snooze}
              onChange={(e) => setS({ snooze: Number(e.target.value) })}
              className="rounded-xl border border-input bg-secondary px-3 py-2 text-sm font-bold"
            >
              {[5, 10, 15, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m} dakika
                </option>
              ))}
            </select>
          </Row>
        </section>

        {/* TEDAVİ */}
        <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Tedavi
          </h3>
          <Row label="Adınız">
            <input
              value={state.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-40 rounded-xl border border-input bg-secondary px-3 py-2 text-sm font-bold"
            />
          </Row>
          <Row label="Başlangıç tarihi">
            <input
              type="date"
              value={state.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
              className="rounded-xl border border-input bg-secondary px-3 py-2 text-sm font-bold"
            />
          </Row>
          <Row label="Süre (gün)">
            <input
              type="number"
              min={1}
              max={90}
              value={state.days}
              onChange={(e) => update({ days: Math.max(1, Number(e.target.value) || 1) })}
              className="w-24 rounded-xl border border-input bg-secondary px-3 py-2 text-sm font-bold"
            />
          </Row>
        </section>

        {/* SAATLER */}
        <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Saatler ve İlaçlar
          </h3>
          <div className="space-y-3">
            {state.slots.map((sl) => (
              <div key={sl.id} className="rounded-xl bg-secondary p-3">
                <div className="mb-2 flex gap-2">
                  <input
                    type="time"
                    value={sl.time}
                    onChange={(e) =>
                      update({
                        slots: state.slots.map((x) =>
                          x.id === sl.id ? { ...x, time: e.target.value } : x,
                        ),
                      })
                    }
                    className="w-28 rounded-lg border border-input bg-card px-3 py-2 text-sm font-bold"
                  />
                  <input
                    value={sl.label}
                    onChange={(e) =>
                      update({
                        slots: state.slots.map((x) =>
                          x.id === sl.id ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                    className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {state.meds.map((m) => {
                    const on = !!state.rules[sl.id]?.[m.id];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          update({
                            rules: {
                              ...state.rules,
                              [sl.id]: { ...(state.rules[sl.id] ?? {}), [m.id]: !on },
                            },
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition-colors ${
                          on
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* İLAÇ İSİMLERİ */}
        <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            İlaç İsimleri
          </h3>
          <div className="space-y-2">
            {state.meds.map((m) => (
              <input
                key={m.id}
                value={m.name}
                onChange={(e) =>
                  update({
                    meds: state.meds.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
                  })
                }
                className="w-full rounded-xl border border-input bg-secondary px-3 py-3 text-sm font-bold"
              />
            ))}
          </div>
        </section>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onTest}
            className="w-full rounded-xl bg-primary-soft py-3.5 text-sm font-extrabold text-primary"
          >
            🔊 Test alarmı gönder (5 sn sonra)
          </button>
          <button
            type="button"
            onClick={onExactAlarm}
            className="w-full rounded-xl bg-warning-soft py-3.5 text-sm font-extrabold text-warning"
          >
            ⚙️ Tam zamanlı alarm iznini kontrol et
          </button>
          <button
            type="button"
            onClick={onReset}
            className="w-full rounded-xl bg-destructive-soft py-3.5 text-sm font-extrabold text-destructive"
          >
            🗑️ Tüm verileri sıfırla
          </button>
        </div>
      </div>
    </div>
  );
}
