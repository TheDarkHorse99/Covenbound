// 16-bit sprite pipeline.
// Sprites are authored as character grids where each letter is a *material*. The pipeline gives every material a
// 4-tone hue-shifted ramp (cool shadows, warm highlights), shades each pixel from its neighbours (light from the
// top-left), and draws a coloured selective outline (darker at the bottom/right) instead of flat black.
import { mk } from './pixel';

export type Ramp = [string, string, string, string]; // 0 darkest … 3 lightest

// ---------- colour maths ----------
function hexToRgb(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function rgbToHex(r: number, g: number, b: number) { return '#' + ((1 << 24) | (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).slice(1); }
const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360; if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function hueToward(h: number, target: number, amt: number) { let d = ((target - h + 540) % 360) - 180; d = Math.max(-amt, Math.min(amt, d)); return h + d; }
export function hsl(hex: string, dh: number, ds: number, dl: number, toward?: number) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex)); const nh = toward !== undefined ? hueToward(h, toward, Math.abs(dh)) : h + dh;
  return rgbToHex(...hslToRgb(nh, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l + dl))));
}
const rampCache = new Map<string, Ramp>();
/** Hue-shifted 4-tone ramp around a base colour: shadows drift toward blue-violet, highlights toward warm yellow. */
export function ramp(base: string): Ramp {
  const hit = rampCache.get(base); if (hit) return hit;
  const [, s, l] = rgbToHsl(...hexToRgb(base));
  const lo = s < 0.08 ? 0 : 0.08;
  const r: Ramp = [
    mix(hsl(base, 22, 0, -Math.min(0.3, l * 0.5), 255), '#1c1426', 0.28),
    hsl(base, 14, lo / 2, -Math.min(0.16, l * 0.3), 255),
    base,
    hsl(base, 12, -0.04, Math.min(0.16, (1 - l) * 0.38), 55),
  ];
  rampCache.set(base, r); return r;
}
export function darken(hex: string, amt: number) { return hsl(hex, 0, 0, -amt); }
export function mix(a: string, b: string, t: number) { const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b); return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t); }

// ---------- shaded sprites ----------
export interface ShadeOpts { outline?: boolean; flat?: Record<string, string>; noShade?: string; lightDir?: 'tl' | 't' }
const cache = new Map<string, HTMLCanvasElement>();
/**
 * rows: grid of material letters ('.' = empty). mats: letter → base colour (shaded) ; opts.flat: letter → exact colour (unshaded, e.g. eyes).
 * Returns a canvas 2px larger than the grid in each dimension when outlined.
 */
export function shaded(key: string, rows: string[], mats: Record<string, string>, opts: ShadeOpts = {}, scale = 1): HTMLCanvasElement {
  const ck = key + '|' + scale; const hit = cache.get(ck); if (hit) return hit;
  const flat = opts.flat || {}; const outline = opts.outline !== false;
  const h = rows.length, w = Math.max(...rows.map(r => r.length)); const pad = outline ? 1 : 0; const W = w + pad * 2, H = h + pad * 2;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h) ? '.' : (rows[y][x] || '.');
  const opaque = (c: string) => c !== '.' && (mats[c] !== undefined || flat[c] !== undefined);
  const out: (string | null)[] = new Array(W * H).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = at(x, y); if (!opaque(c)) continue;
    if (flat[c] !== undefined) { out[(y + pad) * W + x + pad] = flat[c]; continue; }
    const r = ramp(mats[c]);
    if (opts.noShade && opts.noShade.includes(c)) { out[(y + pad) * W + x + pad] = r[2]; continue; }
    const up = at(x, y - 1) === c, dn = at(x, y + 1) === c, lf = at(x - 1, y) === c, rt = at(x + 1, y) === c;
    const upO = opaque(at(x, y - 1)), dnO = opaque(at(x, y + 1)), rtO = opaque(at(x + 1, y)), lfO = opaque(at(x - 1, y));
    let t = 2;
    if (!up) t += upO ? 0.6 : 1; if (!lf) t += lfO ? 0.25 : 0.5;
    if (!dn) t -= dnO ? 0.6 : 1; if (!rt) t -= rtO ? 0.25 : 0.5;
    if (!opaque(at(x, y + 2)) && dn) t -= 0.35;
    const ti = Math.max(0, Math.min(3, Math.round(t)));
    out[(y + pad) * W + x + pad] = r[ti];
  }
  if (outline) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (out[y * W + x]) continue; const gx = x - pad, gy = y - pad;
      const nb: [number, number, number][] = [[0, 1, 1], [0, -1, 0], [1, 0, 1], [-1, 0, 0]]; // dx,dy, dark side?
      let best: string | null = null, dark = 0;
      for (const [dx, dy, d] of nb) { const c = at(gx - dx, gy - dy); if (!opaque(c)) continue; const base = flat[c] !== undefined ? '#2a1d2a' : ramp(mats[c])[0]; if (!best || d > dark) { best = base; dark = d; } }
      if (best) out[y * W + x] = mix(best, '#100a14', dark ? 0.55 : 0.35);
    }
    // darken the outline under the sprite further (ground contact)
  }
  const cv = mk(W * scale, H * scale), g = cv.getContext('2d')!;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const col = out[y * W + x]; if (col) { g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale); } }
  cache.set(ck, cv); return cv;
}

/** Scale2x (EPX): doubles a canvas while rounding diagonal staircase edges — the classic smooth pixel upscale. */
const s2Cache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
export function scale2x(src: HTMLCanvasElement): HTMLCanvasElement {
  const hit = s2Cache.get(src); if (hit) return hit;
  const w = src.width, h = src.height; const d = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const px = (x: number, y: number) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const i = (y * w + x) * 4; return (d[i] << 24 | d[i + 1] << 16 | d[i + 2] << 8 | d[i + 3]) >>> 0; };
  const out = mk(w * 2, h * 2), g = out.getContext('2d')!; const img = g.createImageData(w * 2, h * 2); const o = img.data;
  const put = (x: number, y: number, v: number) => { const i = (y * w * 2 + x) * 4; o[i] = v >>> 24; o[i + 1] = (v >>> 16) & 255; o[i + 2] = (v >>> 8) & 255; o[i + 3] = v & 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = px(x, y), A = px(x, y - 1), B = px(x + 1, y), C = px(x - 1, y), D = px(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (C === A && C !== D && A !== B) e0 = A; if (A === B && A !== C && B !== D) e1 = B; if (D === C && D !== B && C !== A) e2 = C; if (B === D && B !== A && D !== C) e3 = D;
    put(x * 2, y * 2, e0); put(x * 2 + 1, y * 2, e1); put(x * 2, y * 2 + 1, e2); put(x * 2 + 1, y * 2 + 1, e3);
  }
  g.putImageData(img, 0, 0); s2Cache.set(src, out); return out;
}

/** Validates that every row in a grid has the same width (development aid). */
export function checkGrid(name: string, rows: string[]) {
  const w = rows[0].length; rows.forEach((r, i) => { if (r.length !== w) console.warn(`grid ${name} row ${i} is ${r.length} wide, expected ${w}`); });
}
