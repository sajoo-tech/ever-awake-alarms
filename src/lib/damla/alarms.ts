import type { LocalNotificationSchema, LocalNotificationsPlugin } from "@capacitor/local-notifications";
import type { AppState, Dose } from "./types";
import { allDoses, doseDone, fmtTime, hashId } from "./state";

export const ACTION_TYPE = "DAMLA_DOSE";

export function isNative() {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

let plugin: LocalNotificationsPlugin | null = null;
async function ln(): Promise<LocalNotificationsPlugin | null> {
  if (!isNative()) return null;
  if (!plugin) {
    const mod = await import("@capacitor/local-notifications");
    plugin = mod.LocalNotifications;
  }
  return plugin;
}

/** Android bildirim kanalı: en yüksek önem, kilit ekranında görünür, titreşimli. */
export async function initNotifications() {
  const L = await ln();
  if (!L) {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    return;
  }
  try {
    let perm = await L.checkPermissions();
    if (perm.display !== "granted") perm = await L.requestPermissions();
    await L.createChannel({
      id: "damla-alarm",
      name: "İlaç Alarmları",
      description: "Göz damlası doz alarmları",
      importance: 5,
      visibility: 1,
      sound: "alarm.wav",
      vibration: true,
      lights: true,
    });
    await L.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE,
          actions: [
            { id: "take", title: "✓ Damlattım" },
            { id: "snooze", title: "⏰ Ertele" },
          ],
        },
      ],
    });
  } catch {
    /* ignore */
  }
}

function buildBody(d: Dose) {
  return d.meds.map((m) => m.name).join(" + ");
}

function toNotification(d: Dose, snoozeAt?: Date): LocalNotificationSchema {
  return {
    id: hashId(d.key) + (snoozeAt ? 1 : 0),
    title: `💧 ${d.slot.label} dozu • ${fmtTime(d.dt)}`,
    body: buildBody(d),
    largeBody: `${buildBody(d)}\nŞimdi damlat ve gözünü 1-2 dk kapalı tut.`,
    summaryText: "Damla Takip",
    channelId: "damla-alarm",
    actionTypeId: ACTION_TYPE,
    autoCancel: false,
    ongoing: false,
    smallIcon: "ic_stat_icon_config_sample",
    extra: { key: d.key },
    schedule: {
      at: snoozeAt ?? d.dt,
      allowWhileIdle: true,
    },
  };
}

/** Bekleyen tüm dozları yeniden planlar (uygulama kapalıyken de çalar). */
export async function rescheduleAll(state: AppState) {
  const L = await ln();
  if (!L) return;
  try {
    const pending = await L.getPending();
    if (pending.notifications.length) await L.cancel({ notifications: pending.notifications });
  } catch {
    /* ignore */
  }
  if (!state.settings.alarmsEnabled) return;

  const now = Date.now();
  const upcoming = allDoses(state)
    .filter((d) => !doseDone(state, d) && d.dt.getTime() > now + 5000)
    .slice(0, 60)
    .map((d) => toNotification(d));

  if (!upcoming.length) return;
  try {
    await L.schedule({ notifications: upcoming });
  } catch {
    /* ignore */
  }
}

export async function cancelAllAlarms() {
  const L = await ln();
  if (!L) return;
  try {
    const pending = await L.getPending();
    if (pending.notifications.length) await L.cancel({ notifications: pending.notifications });
  } catch {
    /* ignore */
  }
}

export async function scheduleSnooze(d: Dose, minutes: number) {
  const at = new Date(Date.now() + minutes * 60 * 1000);
  const L = await ln();
  if (!L) return;
  try {
    await L.schedule({ notifications: [toNotification(d, at)] });
  } catch {
    /* ignore */
  }
}

export async function testNotification() {
  const L = await ln();
  const at = new Date(Date.now() + 5000);
  if (!L) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setTimeout(() => new Notification("💧 Test alarmı", { body: "Alarm sistemi çalışıyor." }), 5000);
    }
    return;
  }
  try {
    await L.schedule({
      notifications: [
        {
          id: 999999,
          title: "💧 Test alarmı",
          body: "Alarm sistemi çalışıyor.",
          channelId: "damla-alarm",
          schedule: { at, allowWhileIdle: true },
        },
      ],
    });
  } catch {
    /* ignore */
  }
}

/** Android'de pil optimizasyonu / tam zamanlı alarm izinlerini açtırır. */
export async function requestExactAlarmSetup() {
  const L = await ln();
  if (!L) return;
  try {
    const res = await L.checkExactNotificationSetting();
    if (res.exact_alarm !== "granted") await L.changeExactNotificationSetting();
  } catch {
    /* ignore */
  }
}
