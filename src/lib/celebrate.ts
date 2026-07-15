// Self-contained celebration effects: Web Audio tones + canvas confetti.
// No external assets — works offline and under a strict CSP.

export type CelebrationKind = 'par' | 'birdie' | 'eagle' | 'albatross' | 'finish';

const SOUND_KEY = 'gbl.sound';

export function isSoundOn(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SOUND_KEY) !== 'off';
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

// ---- Sound (Web Audio) ---------------------------------------------------

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function note(freq: number, start: number, dur: number, peak = 0.16, type: OscillatorType = 'triangle') {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ac.destination);
  const t = ac.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

const C = 523.25, E = 659.25, G = 783.99, C2 = 1046.5;

function playSound(kind: CelebrationKind) {
  if (!isSoundOn()) return;
  switch (kind) {
    case 'par':
      note(G, 0, 0.22, 0.14);
      break;
    case 'birdie':
      [C, E, G].forEach((f, i) => note(f, i * 0.09, 0.26));
      break;
    case 'eagle':
      [C, E, G, C2].forEach((f, i) => note(f, i * 0.09, 0.3, 0.18));
      break;
    case 'albatross':
    case 'finish':
      [C, E, G, C2, G, C2].forEach((f, i) => note(f, i * 0.1, 0.34, 0.18));
      break;
  }
}

export function playClink() {
  if (!isSoundOn()) return;
  note(1180, 0, 0.07, 0.07, 'square');
  note(1560, 0.05, 0.08, 0.05, 'square');
}

// ---- Confetti (canvas) ---------------------------------------------------

const COLORS = ['#45E3A0', '#F5B93C', '#FF6B5E', '#EAF2EE', '#3b82f6'];

function confettiBurst(count: number) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  if (!g) {
    canvas.remove();
    return;
  }
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.4;
  const parts = Array.from({ length: count }, () => ({
    x: cx,
    y: cy,
    vx: (Math.random() - 0.5) * 11,
    vy: Math.random() * -10 - 3,
    grav: 0.28 + Math.random() * 0.12,
    size: 5 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.32,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const start = performance.now();
  const DURATION = 1500;
  function frame(now: number) {
    const t = now - start;
    g!.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.vy += p.grav;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      g!.save();
      g!.translate(p.x, p.y);
      g!.rotate(p.rot);
      g!.globalAlpha = Math.max(0, 1 - t / DURATION);
      g!.fillStyle = p.color;
      g!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      g!.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

const CONFETTI_COUNT: Record<CelebrationKind, number> = {
  par: 34,
  birdie: 90,
  eagle: 140,
  albatross: 180,
  finish: 200,
};

export function celebrate(kind: CelebrationKind) {
  playSound(kind);
  confettiBurst(CONFETTI_COUNT[kind]);
}
