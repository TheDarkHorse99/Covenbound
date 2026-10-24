export const T = 16; // tile size in pixels
export const VW = 400; // game view width (pixels)
export const VH = 225; // game view height (pixels)

export type Rng = () => number;
export function rngFrom(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const R: Rng = Math.random;
export const rint = (a: number, b: number, r: Rng = R) => a + Math.floor(r() * (b - a + 1));
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function pick<X>(arr: readonly X[], r: Rng = R): X { return arr[Math.floor(r() * arr.length)]; }
export function shuffle<X>(arr: X[], r: Rng = R): X[] { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export function weighted<X>(items: [X, number][], r: Rng = R): X {
  const total = items.reduce((s, [, w]) => s + w, 0); let x = r() * total;
  for (const [v, w] of items) { x -= w; if (x <= 0) return v; }
  return items[items.length - 1][0];
}
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255);
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
export function fmtTime(min: number): string {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  const ap = h < 12 ? 'am' : 'pm'; const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m - (m % 10)).padStart(2, '0')}${ap}`;
}
export const stars = (q: number) => '★'.repeat(q) + '☆'.repeat(Math.max(0, 3 - q));
