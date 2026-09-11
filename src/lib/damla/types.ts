export type Med = { id: string; name: string; color: "pred" | "moxai" | "apfecto" | "other" };
export type Slot = { id: string; label: string; time: string };
export type Rules = Record<string, Record<string, boolean>>;

export type Settings = {
  alarmsEnabled: boolean;
  sound: boolean;
  vib: boolean;
  tone: "soft" | "medium" | "urgent";
  volume: number;
  snooze: number;
};

export type AppState = {
  setupDone: boolean;
  name: string;
  startDate: string;
  days: number;
  meds: Med[];
  slots: Slot[];
  rules: Rules;
  taken: Record<string, boolean>;
  settings: Settings;
};

export type Dose = {
  key: string;
  slot: Slot;
  meds: Med[];
  dt: Date;
  dayKey: string;
};
