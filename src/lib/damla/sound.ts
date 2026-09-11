let ctx: AudioContext | null = null;
let toneTimer: ReturnType<typeof setInterval> | null = null;
let vibTimer: ReturnType<typeof setInterval> | null = null;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignore */
  }
}

function beep(freq: number, dur: number, vol: number) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.05, vol), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch {
    /* ignore */
  }
}

type Tone = "soft" | "medium" | "urgent";

function playTone(tone: Tone, volume: number) {
  const v = volume * 0.5;
  if (tone === "soft") {
    beep(660, 0.4, v);
    setTimeout(() => beep(880, 0.4, v), 600);
  } else if (tone === "medium") {
    beep(880, 0.2, v);
    setTimeout(() => beep(1180, 0.2, v), 220);
    setTimeout(() => beep(880, 0.2, v), 440);
  } else {
    beep(1400, 0.15, v);
    setTimeout(() => beep(1000, 0.15, v), 170);
    setTimeout(() => beep(1400, 0.15, v), 340);
    setTimeout(() => beep(1000, 0.15, v), 510);
  }
}

export function startAlarmSound(opts: { sound: boolean; vib: boolean; tone: Tone; volume: number }) {
  stopAlarmSound();
  initAudio();
  if (opts.sound) {
    playTone(opts.tone, opts.volume);
    const gap = opts.tone === "urgent" ? 1000 : opts.tone === "medium" ? 1300 : 1800;
    toneTimer = setInterval(() => playTone(opts.tone, opts.volume), gap);
  }
  if (opts.vib && typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([600, 200, 600]);
    vibTimer = setInterval(() => navigator.vibrate([600, 200, 600]), 2200);
  }
}

export function stopAlarmSound() {
  if (toneTimer) {
    clearInterval(toneTimer);
    toneTimer = null;
  }
  if (vibTimer) {
    clearInterval(vibTimer);
    vibTimer = null;
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(0);
}

export function previewTone(tone: Tone, volume: number) {
  initAudio();
  playTone(tone, volume);
}
