/**
 * Web Audio ring tones for calls.
 *
 * - Ringback (caller): standard dual-frequency 440Hz + 480Hz, 1s on / 2s off.
 * - Incoming ringtone (receiver): repeating E5/G5 chime sequence, louder.
 *
 * Note on proximity: browsers do not expose a hardware proximity sensor
 * (the old DeviceProximityEvent API was removed for privacy/security reasons),
 * so screen-off-on-ear behaviour like native WhatsApp requires a native
 * wrapper such as Capacitor/Cordova. We keep the screen awake instead when
 * the Screen Wake Lock API is available.
 */

type Tone = { stop: () => void };

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/** Caller-side ringback: 440 + 480 Hz, 1s pulse every 3s. */
export function startRingback(): Tone {
  const ctx = createContext();
  if (!ctx) return { stop: () => undefined };
  void ctx.resume().catch(() => undefined);

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const oscillators = [440, 480].map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(master);
    osc.start();
    return osc;
  });

  const pulse = () => {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.14, now + 0.05);
    master.gain.setValueAtTime(0.14, now + 0.95);
    master.gain.linearRampToValueAtTime(0, now + 1);
  };

  pulse();
  const timer = window.setInterval(pulse, 3000);

  return {
    stop: () => {
      window.clearInterval(timer);
      oscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      });
      void ctx.close().catch(() => undefined);
    },
  };
}

/** Receiver-side ringtone: bright E5/G5/B5 chime sequence, repeating. */
export function startIncomingRingtone(): Tone {
  const ctx = createContext();
  if (!ctx) return { stop: () => undefined };
  void ctx.resume().catch(() => undefined);

  const master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);

  const sequence = [659.25, 783.99, 987.77, 783.99]; // E5, G5, B5, G5

  const chime = () => {
    const start = ctx.currentTime;
    sequence.forEach((freq, index) => {
      const at = start + index * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.9, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(at);
      osc.stop(at + 0.35);
    });
  };

  chime();
  const timer = window.setInterval(chime, 1600);

  return {
    stop: () => {
      window.clearInterval(timer);
      void ctx.close().catch(() => undefined);
    },
  };
}

/** Keep the screen awake during a call where supported. Returns a release fn. */
export function requestCallWakeLock(): () => void {
  type WakeLockSentinel = { release: () => Promise<void> };
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
  };
  if (!nav.wakeLock) return () => undefined;
  let sentinel: WakeLockSentinel | null = null;
  let released = false;
  void nav.wakeLock
    .request("screen")
    .then((lock) => {
      if (released) void lock.release().catch(() => undefined);
      else sentinel = lock;
    })
    .catch(() => undefined);
  return () => {
    released = true;
    void sentinel?.release().catch(() => undefined);
  };
}
