import type { AppState, Dose, Med, Rules, Slot } from "./types";

export const STORE_KEY = "damla_v5";

export function pad(n: number) {
  return n < 10 ? "0" + n : "" + n;
}
export function dateKey(d: Date) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
export function todayISO() {
  return dateKey(new Date());
}
export function parseISO(s: string) {
  const p = (s || todayISO()).split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
export function midnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export const DEFAULT_MEDS: Med[] = [
  { id: "pred", name: "PRED FORTE", color: "pred" },
  { id: "moxai", name: "MOXAİ %0.5", color: "moxai" },
  { id: "apfecto", name: "APFECTO %3", color: "apfecto" },
];

export const DEFAULT_SLOTS: Slot[] = [
  { id: "s1", label: "Sabah", time: "08:00" },
  { id: "s2", label: "Öğle", time: "12:00" },
  { id: "s3", label: "İkindi", time: "16:00" },
  { id: "s4", label: "Akşam", time: "20:00" },
  { id: "s5", label: "Gece", time: "23:00" },
];

export const DEFAULT_RULES: Rules = {
  s1: { pred: true, moxai: true, apfecto: true },
  s2: { pred: true, moxai: true, apfecto: false },
  s3: { pred: true, moxai: true, apfecto: true },
  s4: { pred: true, moxai: true, apfecto: false },
  s5: { pred: true, moxai: true, apfecto: false },
};

export function defaultState(): AppState {
  return {
    setupDone: false,
    name: "",
    startDate: todayISO(),
    days: 7,
    meds: structuredClone(DEFAULT_MEDS),
    slots: structuredClone(DEFAULT_SLOTS),
    rules: structuredClone(DEFAULT_RULES),
    taken: {},
    settings: {
      alarmsEnabled: true,
      sound: true,
      vib: true,
      tone: "urgent",
      volume: 0.9,
      snooze: 10,
    },
  };
}

export function loadState(): AppState {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<AppState>;
    return {
      ...base,
      ...p,
      meds: p.meds?.length ? p.meds : base.meds,
      slots: p.slots?.length ? p.slots : base.slots,
      rules: p.rules ?? base.rules,
      taken: p.taken ?? {},
      settings: { ...base.settings, ...(p.settings ?? {}) },
    };
  } catch {
    return base;
  }
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function slotMeds(s: AppState, slotId: string): Med[] {
  const rule = s.rules[slotId] ?? {};
  return s.meds.filter((m) => rule[m.id]);
}

export function dosesForDay(s: AppState, day: Date): Dose[] {
  const out: Dose[] = [];
  for (const sl of s.slots) {
    const meds = slotMeds(s, sl.id);
    if (!meds.length) continue;
    const [h, m] = sl.time.split(":");
    const dt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(h), Number(m || 0), 0, 0);
    out.push({ key: dateKey(day) + "|" + sl.id, slot: sl, meds, dt, dayKey: dateKey(day) });
  }
  return out.sort((a, b) => a.dt.getTime() - b.dt.getTime());
}

export function allDoses(s: AppState): Dose[] {
  const start = midnight(parseISO(s.startDate));
  const out: Dose[] = [];
  for (let i = 0; i < s.days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(...dosesForDay(s, day));
  }
  return out;
}

export function isTaken(s: AppState, dayKey: string, slotId: string, medId: string) {
  return !!s.taken[dayKey + "|" + slotId + "|" + medId];
}
export function doseDone(s: AppState, d: Dose) {
  return d.meds.every((m) => isTaken(s, d.dayKey, d.slot.id, m.id));
}

export function nextDose(s: AppState, now = new Date()): Dose | null {
  const pending = allDoses(s).filter((d) => !doseDone(s, d));
  return pending.find((d) => d.dt.getTime() > now.getTime() - 5 * 60 * 1000) ?? null;
}

export function stats(s: AppState) {
  const all = allDoses(s);
  let total = 0;
  let taken = 0;
  for (const d of all) {
    for (const m of d.meds) {
      total++;
      if (isTaken(s, d.dayKey, d.slot.id, m.id)) taken++;
    }
  }
  return { total, taken, perc: total ? Math.round((taken / total) * 100) : 0 };
}

export function treatmentDay(s: AppState, now = new Date()) {
  const start = midnight(parseISO(s.startDate));
  const diff = Math.floor((midnight(now).getTime() - start.getTime()) / 86400000);
  return diff + 1;
}

export function hashId(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000;
}

export function fmtTime(d: Date) {
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}
