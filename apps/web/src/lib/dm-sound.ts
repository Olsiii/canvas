// A short two-tone chime played when a DM arrives, synthesized via Web
// Audio rather than shipping an audio asset — no file to license, and it
// plays through the same system output the OS already scales, so there's
// deliberately no separate in-app volume control: a quiet machine gets a
// quiet chime, a muted machine gets none, for free.
const STORAGE_KEY = "canvas:dm-sound-enabled";

export function isDmSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setDmSoundEnabled(enabled: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    // Safari-only fallback constructor name, absent from lib.dom's types.
    const webkitCtor = (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
    const Ctor = window.AudioContext ?? webkitCtor;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

function beep(ctx: AudioContext, startOffsetSec: number, frequencyHz: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequencyHz;

  const start = ctx.currentTime + startOffsetSec;
  const duration = 0.12;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
  gain.gain.linearRampToValueAtTime(0, start + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** No-ops silently if sound is muted, the browser blocks autoplay, or Web Audio is unsupported. */
export function playDmChime(): void {
  if (!isDmSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    beep(ctx, 0, 660);
    beep(ctx, 0.11, 880);
  } catch {
    // Autoplay-blocked or unsupported — a missed chime isn't worth surfacing.
  }
}

let primed = false;

/**
 * Chrome/Safari only let an AudioContext actually produce sound once it's
 * been created-or-resumed inside a real user gesture's call stack — a DM
 * arriving over the WebSocket is not one, so without this, `playDmChime()`
 * runs (no error, `ctx.state` may even say "running") but nothing audible
 * ever comes out. Call this once, early, from anywhere already mounted for
 * the whole session (the workspace shell); the first click/keypress
 * anywhere in the app creates and unlocks the context ahead of time so a
 * later, gesture-less chime actually plays.
 */
export function primeDmSoundOnFirstInteraction(): void {
  if (typeof window === "undefined" || primed) return;
  primed = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
