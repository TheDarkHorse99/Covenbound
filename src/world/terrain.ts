// Bakes a map into two 16-bit style layers:
//  • ground  — terrain with soft edges (grass lips over paths, shorelines, blight creep), tree trunks, walls, props
//  • over    — everything that should hide the player when they walk behind it: tree crowns, roofs, awnings
import { T, rngFrom } from '../core/util';
import { TL, isGrassy, isWater, isRoof, isWall } from './tiles';
import { mk } from '../art/pixel';
import { ramp } from '../art/pix16';

// ---------- pixel buffer ----------
const u32Cache = new Map<string, number>();
export function u32(hex: string): number { let v = u32Cache.get(hex); if (v === undefined) { const n = parseInt(hex.slice(1), 16); v = ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16)) >>> 0; u32Cache.set(hex, v); } return v; }
export class PixelBuf {
  w: number; h: number; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData; d: Uint32Array;
  clip: [number, number, number, number] | null = null;
  constructor(w: number, h: number) { this.w = w; this.h = h; this.canvas = mk(w, h); this.ctx = this.canvas.getContext('2d')!; this.img = this.ctx.createImageData(w, h); this.d = new Uint32Array(this.img.data.buffer); }
  ok(x: number, y: number) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false; const c = this.clip; return !c || (x >= c[0] && y >= c[1] && x < c[2] && y < c[3]); }
  set(x: number, y: number, c: number) { x |= 0; y |= 0; if (this.ok(x, y)) this.d[y * this.w + x] = c; }
  get(x: number, y: number) { return this.d[(y | 0) * this.w + (x | 0)]; }
  rect(x: number, y: number, w: number, h: number, c: number) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  /** multiply rgb of an existing pixel (shadows) */
  shade(x: number, y: number, f: number) { x |= 0; y |= 0; if (!this.ok(x, y)) return; const v = this.d[y * this.w + x]; if (!(v >>> 24)) return; const r = (v & 255) * f, g = ((v >> 8) & 255) * f, b = ((v >> 16) & 255) * f; this.d[y * this.w + x] = ((v >>> 24) << 24 | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r)) >>> 0; }
  tint(x: number, y: number, hex: string, a: number) { x |= 0; y |= 0; if (!this.ok(x, y)) return; const v = this.d[y * this.w + x]; const n = parseInt(hex.slice(1), 16); const tr = n >> 16, tg = (n >> 8) & 255, tb = n & 255;
    const r = (v & 255) * (1 - a) + tr * a, g = ((v >> 8) & 255) * (1 - a) + tg * a, b = ((v >> 16) & 255) * (1 - a) + tb * a; this.d[y * this.w + x] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; }
  stamp(src: Uint32Array, sw: number, sh: number, x: number, y: number) { for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) { const v = src[j * sw + i]; if (v >>> 24) this.set(x + i, y + j, v); } }
  clearRect(x: number, y: number, w: number, h: number) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < this.w && yy < this.h) this.d[yy * this.w + xx] = 0; } }
  flush(x = 0, y = 0, w = this.w, h = this.h) { x = Math.max(0, x); y = Math.max(0, y); w = Math.min(this.w - x, w); h = Math.min(this.h - y, h); if (w > 0 && h > 0) this.ctx.putImageData(this.img, 0, 0, x, y, w, h); }
}
const spriteData = new WeakMap<HTMLCanvasElement, Uint32Array>();
export function canvasData(c: HTMLCanvasElement): Uint32Array { let d = spriteData.get(c); if (!d) { d = new Uint32Array(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.buffer.slice(0)); spriteData.set(c, d); } return d; }
function stampCanvas(pb: PixelBuf, c: HTMLCanvasElement, x: number, y: number) { pb.stamp(canvasData(c), c.width, c.height, Math.round(x), Math.round(y)); }

// ---------- palette ----------
const C = (h: string) => u32(h);
const G = { g0: '#2f6a2c', g1: '#3d7d36', g2: '#4b923f', g3: '#5fa84b', g4: '#7cc25c' };
const GRASS_BASES = ['#4b923f', '#529a43', '#45883a'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function vnoise(x: number, y: number) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const s = (t: number) => t * t * (3 - 2 * t);
  const a = h2(xi, yi, 41), b = h2(xi + 1, yi, 41), c = h2(xi, yi + 1, 41), d = h2(xi + 1, yi + 1, 41); const u = s(xf), v = s(yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const PATH = { d0: '#7a6040', d1: '#8f7350', d2: '#a4865c', d3: '#b99c70', d4: '#cdb487' };

function h2(x: number, y: number, s = 0) { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

// ---------- prebuilt object sprites ----------
const crownCache = new Map<string, HTMLCanvasElement>();
export function crown(variant: number, dead = false): HTMLCanvasElement {
  const key = `${variant}:${dead}`; const hit = crownCache.get(key); if (hit) return hit;
  const W = 32, H = 30; const c = mk(W, H), g = c.getContext('2d')!; const r = rngFrom(variant * 97 + 11);
  if (dead) {
    const col = ['#3e3a46', '#57525f', '#6e6878']; const branch = (x0: number, y0: number, x1: number, y1: number) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); g.fillStyle = col[0]; g.fillRect(x, y + 1, 2, 1); g.fillStyle = col[1]; g.fillRect(x, y, 2, 1); } };
    branch(16, 29, 16, 12); branch(16, 18, 7, 8); branch(16, 16, 25, 6); branch(9, 10, 5, 3); branch(23, 8, 27, 2); branch(16, 13, 13, 4); branch(16, 12, 19, 3);
    for (let i = 0; i < 6; i++) { g.fillStyle = '#9a5ad6'; g.fillRect(4 + Math.floor(r() * 24), 2 + Math.floor(r() * 14), 1, 1); }
    crownCache.set(key, c); return c;
  }
  const base = ['#3f8a3a', '#4a8f34', '#3a8242', '#43893a'][variant % 4]; const rp = ramp(base); const leaf = [rp[0], rp[1], rp[2], rp[3]];
  const circles: [number, number, number][] = [[16, 17, 11], [8, 19, 7], [24, 19, 7], [11, 10, 7], [21, 10, 7], [16, 6, 6], [16, 22, 8]];
  const mask = new Int8Array(W * H).fill(-1);
  for (const [cx, cy, rr] of circles) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy; const d = Math.hypot(dx, dy); if (d > rr) continue;
    const lit = (-dx * 0.6 - dy * 0.8) / rr; let t = lit > 0.35 ? 3 : lit > -0.15 ? 2 : lit > -0.55 ? 1 : 0;
    if (d > rr - 1.2 && t > 1 && dy > 0) t--; mask[y * W + x] = t;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let t = mask[y * W + x]; if (t < 0) continue; const n = h2(x, y, variant); if (n < 0.12) t = Math.max(0, t - 1); else if (n > 0.93) t = Math.min(3, t + 1); g.fillStyle = leaf[t]; g.fillRect(x, y, 1, 1); }
  // outline
  const od = rp[0].replace('#', ''); const outline = '#' + od; const dark = shadeHex(outline, 0.6);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (mask[y * W + x] >= 0) continue; const nb = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H && mask[yy * W + xx] >= 0; if (nb(x, y - 1)) { g.fillStyle = dark; g.fillRect(x, y, 1, 1); } else if (nb(x + 1, y) || nb(x - 1, y) || nb(x, y + 1)) { g.fillStyle = shadeHex(outline, 0.8); g.fillRect(x, y, 1, 1); } }
  if (variant === 2) for (let i = 0; i < 7; i++) { const x = 5 + Math.floor(r() * 22), y = 5 + Math.floor(r() * 18); if (mask[y * W + x] >= 0) { g.fillStyle = '#c23a4a'; g.fillRect(x, y, 2, 2); g.fillStyle = '#ff8a8a'; g.fillRect(x, y, 1, 1); } }
  if (variant === 3) for (let i = 0; i < 9; i++) { const x = 5 + Math.floor(r() * 22), y = 4 + Math.floor(r() * 18); if (mask[y * W + x] >= 0) { g.fillStyle = '#f4e4f0'; g.fillRect(x, y, 1, 1); g.fillStyle = '#f0a0c8'; g.fillRect(x + 1, y, 1, 1); } }
  crownCache.set(key, c); return c;
}
function shadeHex(hex: string, f: number) { const n = parseInt(hex.slice(1), 16); const r = Math.round((n >> 16) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }

const objCache = new Map<string, HTMLCanvasElement>();
function obj(key: string, w: number, h: number, draw: (p: (c: string, x: number, y: number, w?: number, h?: number) => void, g: CanvasRenderingContext2D) => void) {
  const hit = objCache.get(key); if (hit) return hit; const c = mk(w, h), g = c.getContext('2d')!; draw((col, x, y, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, g); objCache.set(key, c); return c;
}
function blob(p: (c: string, x: number, y: number, w?: number, h?: number) => void, cx: number, cy: number, rx: number, ry: number, rp: string[], outline: string) {
  for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
    const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    if (d <= 1) { const lit = (-x / rx * 0.6 - y / ry * 0.8); const t = lit > 0.4 ? 3 : lit > -0.1 ? 2 : lit > -0.6 ? 1 : 0; p(rp[t], cx + x, cy + y); }
    else if (d <= 1.35 && ((x * x) / ((rx + 1) * (rx + 1)) + (y * y) / ((ry + 1) * (ry + 1))) <= 1.05) p(outline, cx + x, cy + y);
  }
}
const bush = (berry: boolean) => obj('bush' + berry, 16, 14, (p) => { const rp = ramp('#3f8a3a'); blob(p, 5, 8, 4, 4, rp, '#183418'); blob(p, 11, 8, 4, 4, rp, '#183418'); blob(p, 8, 5, 5, 4, rp, '#183418'); if (berry) for (const [x, y] of [[4, 7], [10, 5], [12, 9], [7, 10]]) { p('#c23a4a', x, y, 2, 2); p('#ff9a9a', x, y); } });
const rock = (v: number) => obj('rock' + v, 16, 13, (p) => { const rp = ramp('#8a8478'); blob(p, 8, 7, 6, 5, rp, '#3a3630'); if (v % 2) { p('#5a8a3a', 5, 3, 3, 1); p('#6aa04a', 4, 4, 2, 1); } p(rp[1], 9, 8, 3, 1); });
const tent = () => obj('tent', 18, 16, (p) => { const rp = ramp('#9a8a5a'); for (let y = 0; y < 13; y++) { const hw = Math.floor(y * 0.62) + 1; for (let x = -hw; x <= hw; x++) p(x < 0 ? rp[3] : x === 0 ? rp[2] : rp[1], 9 + x, 2 + y); p('#3a2e1e', 9 - hw - 1, 2 + y); p('#3a2e1e', 9 + hw + 1, 2 + y); } for (let y = 6; y < 15; y++) { const hw = Math.floor((y - 6) * 0.45); for (let x = -hw; x <= hw; x++) p('#2a1e12', 9 + x, y); } p('#6a5a3a', 8, 0, 2, 3); p('#c8a040', 9, 0); });
const shrine = () => obj('shrine', 16, 16, (p) => { const rp = ramp('#8a8aa0'); p('#2a2838', 2, 6, 12, 10); p(rp[1], 3, 7, 10, 8); p(rp[3], 3, 7, 10, 1); p(rp[2], 3, 8, 10, 3); p(rp[0], 3, 14, 10, 1); p('#2a2838', 4, 2, 8, 5); p(rp[2], 5, 3, 6, 3); p(rp[3], 5, 3, 6, 1); p('#f2e8c8', 6, 0, 1, 3); p('#f2e8c8', 9, 0, 1, 3); p('#ffd166', 6, -1 + 1, 1, 1); p('#ffd166', 9, 0, 1, 1); p('#b06aff', 7, 10, 2, 2); });

// ---------- painting ----------
export interface Roof { x0: number; y0: number; x1: number; y1: number; t: number }
export interface TerrainCtx { w: number; h: number; m: Uint8Array; v: Uint8Array; id: string; roofs: Roof[]; home: { wall: number; floor: number }; bakeOver?: boolean }
type Cls = 'grass' | 'path' | 'cobble' | 'soil' | 'tilled' | 'wet' | 'water' | 'shallow' | 'blight' | 'floor' | 'wallin' | 'floorin' | 'void';
function cls(t: number): Cls {
  switch (t) {
    case TL.PATH: case TL.EXIT: case TL.CAMPFIRE: return 'path';
    case TL.COBBLE: case TL.STALL: return 'cobble';
    case TL.SOIL: return 'soil'; case TL.TILLED: return 'tilled'; case TL.WET: return 'wet';
    case TL.DEEP: case TL.LILY: case TL.BRIDGE: return 'water'; case TL.SHALLOW: return 'shallow';
    case TL.BLIGHT: case TL.DEADTREE: return 'blight'; case TL.FLOOR: case TL.STONEWALL: return 'floor';
    case TL.WALL_IN: return 'wallin'; case TL.FLOOR_IN: case TL.DOOR_IN: return 'floorin'; case TL.VOID: return 'void';
    default: return 'grass';
  }
}
const LOW: Set<Cls> = new Set(['path', 'cobble', 'soil', 'tilled', 'wet', 'blight', 'floor']);

export const WALLPAPERS = [
  { name: 'Plum damask', a: '#6a3a6a', b: '#7e4a7e', c: '#a06aa0' },
  { name: 'Moss stripe', a: '#3e5a3a', b: '#4e6e48', c: '#78a06a' },
  { name: 'Candle cream', a: '#c8b088', b: '#d8c49c', c: '#f0e0bc' },
  { name: 'Night sky', a: '#24264a', b: '#2e3260', c: '#f2c14e' },
  { name: 'Rose trellis', a: '#8a4a52', b: '#9e5a62', c: '#e0a0a8' },
];
export const FLOORS = [
  { name: 'Oak boards', a: '#8a6440', b: '#9c744c', c: '#6e4e30' },
  { name: 'Ash boards', a: '#b89a72', b: '#c8ac84', c: '#94785a' },
  { name: 'Slate tiles', a: '#5a5a6a', b: '#6a6a7c', c: '#44445a' },
  { name: 'Green checker', a: '#3e5a3a', b: '#c8c0a0', c: '#2a3e28' },
  { name: 'Walnut herringbone', a: '#5a3a24', b: '#6e4a30', c: '#40281a' },
];

export class Terrain {
  ctx: TerrainCtx; ground: PixelBuf; over: PixelBuf;
  constructor(ctx: TerrainCtx) {
    this.ctx = ctx; this.ground = new PixelBuf(ctx.w * T, ctx.h * T); this.over = new PixelBuf(ctx.w * T, ctx.h * T);
    for (let ty = 0; ty < ctx.h; ty++) for (let tx = 0; tx < ctx.w; tx++) this.paintGround(tx, ty);
    if (ctx.bakeOver) this.paintOverRegion(0, 0, ctx.w, ctx.h);
    this.ground.flush(); if (ctx.bakeOver) this.over.flush();
  }
  private t(x: number, y: number): number { const c = this.ctx; if (x < 0 || y < 0 || x >= c.w || y >= c.h) { x = Math.max(0, Math.min(c.w - 1, x)); y = Math.max(0, Math.min(c.h - 1, y)); } return c.m[y * c.w + x]; }
  /** Repaint after a tile changed: ground in a 3×3 block, overhead in the area crowns can reach. */
  repaint(tx: number, ty: number) {
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (x >= 0 && y >= 0 && x < this.ctx.w && y < this.ctx.h) this.paintGround(x, y);
    this.ground.flush((tx - 1) * T, (ty - 1) * T, 3 * T, 3 * T);
    if (this.ctx.bakeOver) { this.paintOverRegion(tx - 2, ty - 2, tx + 3, ty + 2); this.over.flush((tx - 2) * T, (ty - 2) * T, 5 * T, 4 * T); }
  }
  private paintGround(tx: number, ty: number) {
    const pb = this.ground, ox = tx * T, oy = ty * T, t = this.t(tx, ty), c = cls(t); const v = this.ctx.v[ty * this.ctx.w + tx];
    const rnd = rngFrom(tx * 7349 + ty * 911 + 17);
    const px = (x: number, y: number, col: string) => pb.set(ox + x, oy + y, C(col));
    const fill = (col: string) => pb.rect(ox, oy, T, T, C(col));
    const speck = (cols: string[], n: number) => { for (let i = 0; i < n; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), cols[i % cols.length]); };
    // ---- base ----
    switch (c) {
      case 'grass': {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const n = vnoise((ox + x) / 37, (oy + y) / 37) * 2.2 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.1; pb.set(ox + x, oy + y, C(GRASS_BASES[n < 0.75 ? 2 : n < 1.45 ? 0 : 1])); }
        speck([G.g1, G.g3, G.g1], 22);
        for (let i = 0; i < 3; i++) { const x = 1 + Math.floor(rnd() * 13), y = 3 + Math.floor(rnd() * 11); px(x, y + 1, G.g1); px(x + 1, y, G.g3); px(x + 2, y + 1, G.g1); px(x + 1, y + 1, G.g2); }
        if (t === TL.FLOWERS || (t === TL.GRASS && v === 1 && h2(tx, ty, 9) < 0.5)) { const fc = [['#f4f0e8', '#f2c14e'], ['#e86a8a', '#ffd0dc'], ['#b48ae0', '#f4e8ff'], ['#f2d64e', '#fff4b0']]; const n = t === TL.FLOWERS ? 4 : 1;
          for (let i = 0; i < n; i++) { const x = 2 + Math.floor(rnd() * 11), y = 2 + Math.floor(rnd() * 11); const [pc, cc] = fc[(i + v) % 4]; px(x, y - 1, pc); px(x - 1, y, pc); px(x + 1, y, pc); px(x, y + 1, pc); px(x, y, cc); px(x, y + 2, G.g0); } }
        if (t === TL.TALL) for (let i = 0; i < 4; i++) { const x = 1 + Math.floor(rnd() * 12), y = 5 + Math.floor(rnd() * 8); for (let k = 0; k < 3; k++) { px(x + k, y + 3, G.g0); px(x + k, y + 2 - (k % 2), G.g2); px(x + k, y + 1 - (k % 2) * 2, G.g3); } px(x + 1, y - 1, G.g4); }
        break; }
      case 'path': fill(PATH.d2); speck([PATH.d1, PATH.d3, PATH.d1, PATH.d3], 26);
        for (let i = 0; i < 2; i++) { const x = 1 + Math.floor(rnd() * 12), y = 1 + Math.floor(rnd() * 13); px(x, y, '#7a6a58'); px(x + 1, y, '#6a5a48'); px(x, y - 1, '#c8b498'); px(x + 1, y + 1, PATH.d1); } break;
      case 'cobble': { fill('#57514a'); const rows = [[0, 5], [5, 5], [10, 6]]; let off = (ty % 2) * 3;
        for (const [y0, hh] of rows) { let x = -off; off = (off + 4) % 7; while (x < 16) { const ww = 4 + Math.floor(h2(tx * 16 + x, ty * 16 + y0, 5) * 3); const shade = ['#8e877b', '#857e72', '#979084'][Math.floor(h2(x, y0, tx + ty) * 3)];
          for (let yy = y0 + 1; yy < y0 + hh; yy++) for (let xx = x + 1; xx < x + ww; xx++) if (xx >= 0 && xx < 16) px(xx, yy, shade);
          for (let xx = x + 1; xx < x + ww - 1; xx++) if (xx >= 0 && xx < 16) px(xx, y0 + 1, '#aaa396'); for (let yy = y0 + 2; yy < y0 + hh; yy++) if (x + ww - 1 >= 0 && x + ww - 1 < 16) px(x + ww - 1, yy, '#6c665c'); x += ww; } } break; }
      case 'soil': fill('#8a6440'); speck(['#7a5636', '#9c7650', '#6e4c2e'], 30); break;
      case 'tilled': case 'wet': { const wet = c === 'wet'; fill(wet ? '#4a2e1c' : '#7a5232'); for (let y = 1; y < 16; y += 4) { for (let x = 1; x < 15; x++) { px(x, y, wet ? '#36200f' : '#5e3c22'); px(x, y + 1, wet ? '#5a3a24' : '#946a42'); px(x, y + 2, wet ? '#4a2e1c' : '#845c38'); } }
        if (wet) { px(4 + v, 6, '#6a8aa0'); px(10, 11 - v, '#6a8aa0'); } break; }
      case 'water': { fill('#2c5f94'); for (let i = 0; i < 4; i++) { const x = Math.floor(h2(tx, ty, i) * 12), y = Math.floor(h2(ty, tx, i + 7) * 14); for (let k = 0; k < 4; k++) px(x + k, y, '#24507f'); px(x + 1, y - 1, '#3a72a8'); px(x + 2, y - 1, '#3a72a8'); } break; }
      case 'shallow': fill('#4f9bc4'); speck(['#6fb3d0', '#3f88b0', '#7cc0da'], 14); break;
      case 'blight': fill('#3b2a48'); speck(['#2c1f38', '#4a3456', '#2c1f38'], 30);
        for (let i = 0; i < 2; i++) { let x = Math.floor(rnd() * 16), y = Math.floor(rnd() * 16); for (let k = 0; k < 6; k++) { px(x, y, '#5a3a7a'); x += Math.round(rnd() * 2 - 1); y += 1; } }
        if (v % 2) { px(4 + v, 6, '#a46ad6'); px(11, 3 + v, '#c8ff6a'); px(11, 4 + v, '#7aa83a'); } break;
      case 'floor': fill('#5f5a72'); for (let y = 0; y < 16; y += 8) for (let x = (y / 8) % 2 * 4; x < 16; x += 8) { pb.rect(ox + x, oy + y, 7, 7, C('#6a6580')); px(x, y, '#7a7590'); } break;
      case 'wallin': { const s = WALLPAPERS[this.ctx.home.wall] || WALLPAPERS[0]; fill(s.a); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if ((x + (ty * 16 + y) % 8 * 0) % 4 === 0) px(x, y, s.b); }
        for (let k = 0; k < 2; k++) { const x = 3 + k * 8, y = 4 + ((tx + k) % 2) * 6; px(x, y, s.c); px(x - 1, y + 1, s.c); px(x + 1, y + 1, s.c); px(x, y + 2, s.c); }
        if (this.t(tx, ty + 1) !== TL.WALL_IN) { pb.rect(ox, oy + 11, 16, 5, C('#6e4e30')); pb.rect(ox, oy + 11, 16, 1, C('#9c744c')); pb.rect(ox, oy + 15, 16, 1, C('#3a2416')); }
        if (this.t(tx, ty - 1) !== TL.WALL_IN) { pb.rect(ox, oy, 16, 2, C('#3a2416')); pb.rect(ox, oy + 2, 16, 1, C('#8a6440')); } break; }
      case 'floorin': { const f = FLOORS[this.ctx.home.floor] || FLOORS[0];
        if (f.name === 'Green checker') { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, ((x >> 3) + (y >> 3)) % 2 ? f.a : f.b); }
        else if (f.name === 'Slate tiles') { fill(f.c); for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) { pb.rect(ox + x + 1, oy + y + 1, 7, 7, C(f.a)); pb.rect(ox + x + 1, oy + y + 1, 7, 1, C(f.b)); } }
        else { fill(f.a); for (let y = 0; y < 16; y += 4) { pb.rect(ox, oy + y + 3, 16, 1, C(f.c)); const seam = (Math.floor(h2(tx, ty * 4 + y, 3) * 12) + 2); px(seam, y, f.c); px(seam, y + 1, f.c); px(seam, y + 2, f.c); pb.rect(ox, oy + y, 16, 1, C(f.b)); } }
        if (t === TL.DOOR_IN) { pb.rect(ox + 2, oy + 4, 12, 9, C('#8a3a3a')); pb.rect(ox + 3, oy + 5, 10, 7, C('#a84a4a')); pb.rect(ox + 3, oy + 8, 10, 1, C('#f2c14e')); }
        if (this.t(tx, ty - 1) === TL.WALL_IN) for (let x = 0; x < 16; x++) { pb.shade(ox + x, oy, 0.55); pb.shade(ox + x, oy + 1, 0.75); }
        break; }
      case 'void': fill('#0b0812'); break;
    }
    // ---- edges ----
    if (LOW.has(c)) this.grassLips(tx, ty, c);
    if (c === 'grass') this.blightCreep(tx, ty);
    if (c === 'water' || c === 'shallow') this.shore(tx, ty, c);
    else if (c !== 'void' && c !== 'wallin' && c !== 'floorin') this.bank(tx, ty);
    // ---- objects ----
    this.paintObject(tx, ty, t, v, rnd);
  }
  private grassLips(tx: number, ty: number, c: Cls) {
    const pb = this.ground, ox = tx * T, oy = ty * T; const gr = (x: number, y: number) => cls(this.t(x, y)) === 'grass';
    const lip = c === 'soil' || c === 'tilled' || c === 'wet' ? '#5a3c22' : c === 'blight' ? '#241830' : c === 'cobble' ? '#3e3a34' : PATH.d0;
    const depth = (i: number, s: number) => 1 + Math.floor(h2(tx * 16 + i, ty * 16 + s, 21) * 3);
    if (gr(tx, ty - 1)) for (let x = 0; x < 16; x++) { const d = depth(x, 1); for (let y = 0; y < d; y++) pb.set(ox + x, oy + y, C(y === d - 1 ? G.g2 : G.g1)); pb.set(ox + x, oy + d, C(lip)); }
    if (gr(tx, ty + 1)) for (let x = 0; x < 16; x++) { const d = depth(x, 2); for (let y = 0; y < d; y++) pb.set(ox + x, oy + 15 - y, C(G.g2)); pb.set(ox + x, oy + 15 - d, C(G.g3)); }
    if (gr(tx - 1, ty)) for (let y = 0; y < 16; y++) { const d = depth(y, 3); for (let x = 0; x < d; x++) pb.set(ox + x, oy + y, C(G.g2)); pb.set(ox + d, oy + y, C(lip)); }
    if (gr(tx + 1, ty)) for (let y = 0; y < 16; y++) { const d = depth(y, 4); for (let x = 0; x < d; x++) pb.set(ox + 15 - x, oy + y, C(G.g1)); pb.set(ox + 15 - d, oy + y, C(lip)); }
    const corner = (dx: number, dy: number, x0: number, y0: number) => { if (gr(tx + dx, ty + dy) && !gr(tx + dx, ty) && !gr(tx, ty + dy)) { pb.rect(ox + x0, oy + y0, 2, 2, C(G.g2)); } };
    corner(-1, -1, 0, 0); corner(1, -1, 14, 0); corner(-1, 1, 0, 14); corner(1, 1, 14, 14);
  }
  private blightCreep(tx: number, ty: number) {
    const pb = this.ground, ox = tx * T, oy = ty * T; const bl = (x: number, y: number) => cls(this.t(x, y)) === 'blight'; if (!(bl(tx - 1, ty) || bl(tx + 1, ty) || bl(tx, ty - 1) || bl(tx, ty + 1))) return;
    for (let i = 0; i < 40; i++) { const x = Math.floor(h2(tx, ty, i) * 16), y = Math.floor(h2(ty, tx, i + 50) * 16);
      const near = (bl(tx - 1, ty) && x < 4) || (bl(tx + 1, ty) && x > 11) || (bl(tx, ty - 1) && y < 4) || (bl(tx, ty + 1) && y > 11);
      if (near) pb.tint(ox + x, oy + y, i % 3 ? '#4a3456' : '#6a3a8a', 0.75); }
  }
  private shore(tx: number, ty: number, c: Cls) {
    const pb = this.ground, ox = tx * T, oy = ty * T; const land = (x: number, y: number) => !isWater(this.t(x, y));
    const foam = c === 'water' ? '#a8d8f0' : '#d8f2fa', inner = c === 'water' ? '#4a86bc' : '#7cc0da';
    if (land(tx, ty - 1)) for (let x = 0; x < 16; x++) { pb.set(ox + x, oy, C('#3a2a1a')); pb.set(ox + x, oy + 1, C(foam)); if (h2(tx * 16 + x, ty, 3) > 0.4) pb.set(ox + x, oy + 2, C(inner)); }
    if (land(tx, ty + 1)) for (let x = 0; x < 16; x++) { pb.set(ox + x, oy + 15, C(foam)); }
    if (land(tx - 1, ty)) for (let y = 0; y < 16; y++) { pb.set(ox, oy + y, C(foam)); if (h2(tx, ty * 16 + y, 4) > 0.5) pb.set(ox + 1, oy + y, C(inner)); }
    if (land(tx + 1, ty)) for (let y = 0; y < 16; y++) { pb.set(ox + 15, oy + y, C(foam)); }
    const t = this.t(tx, ty);
    if (t === TL.LILY) { const rp = ramp('#3f8a3a'); for (let y = 0; y < 6; y++) for (let x = 0; x < 9; x++) { const dx = x - 4, dy = y - 2.5; if (dx * dx / 20 + dy * dy / 7 < 1 && !(x > 4 && y > 1 && y < 4)) pb.set(ox + 3 + x, oy + 5 + y, C(y < 2 ? rp[3] : y < 4 ? rp[2] : rp[1])); } pb.set(ox + 6, oy + 6, C('#f08ac0')); pb.set(ox + 7, oy + 6, C('#ffd0e8')); pb.set(ox + 6, oy + 5, C('#ffd0e8')); }
    if (t === TL.BRIDGE) { for (let y = 0; y < 16; y += 4) { pb.rect(ox, oy + y, 16, 3, C('#8a6a44')); pb.rect(ox, oy + y, 16, 1, C('#a8845a')); pb.rect(ox, oy + y + 3, 16, 1, C('#4a3420')); } pb.rect(ox, oy, 1, 16, C('#4a3420')); pb.rect(ox + 15, oy, 1, 16, C('#4a3420')); }
  }
  private bank(tx: number, ty: number) {
    const pb = this.ground, ox = tx * T, oy = ty * T; const wat = (x: number, y: number) => isWater(this.t(x, y)) && this.t(x, y) !== TL.BRIDGE;
    if (wat(tx, ty + 1)) { pb.rect(ox, oy + 13, 16, 2, C('#7a5a36')); pb.rect(ox, oy + 15, 16, 1, C('#4a3420')); pb.rect(ox, oy + 12, 16, 1, C('#c2a06a')); }
    if (wat(tx - 1, ty)) { pb.rect(ox, oy, 1, 16, C('#c2a06a')); }
    if (wat(tx + 1, ty)) { pb.rect(ox + 15, oy, 1, 16, C('#7a5a36')); }
    if (wat(tx, ty - 1)) { pb.rect(ox, oy, 16, 1, C('#c2a06a')); }
  }
  private paintObject(tx: number, ty: number, t: number, v: number, rnd: () => number) {
    const pb = this.ground, ox = tx * T, oy = ty * T; const P = (col: string, x: number, y: number, w = 1, h = 1) => pb.rect(ox + x, oy + y, w, h, C(col));
    const shadow = (cx: number, cy: number, rx: number, ry: number, f = 0.62) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if (x * x / (rx * rx) + y * y / (ry * ry) <= 1) pb.shade(ox + cx + x, oy + cy + y, f); };
    switch (t) {
      case TL.TREE: shadow(8, 13, 8, 3); P('#3a2414', 6, 7, 5, 8); P('#5a3a20', 7, 7, 1, 8); P('#7a5230', 8, 7, 1, 8); P('#6a4628', 9, 7, 1, 8); P('#4a2e1a', 5, 13, 1, 2); P('#4a2e1a', 11, 13, 1, 2); P('#2a180c', 6, 15, 5, 1); break;
      case TL.DEADTREE: shadow(8, 13, 6, 2, 0.7); P('#2a2632', 6, 6, 5, 9); P('#57525f', 7, 6, 2, 9); P('#3e3a46', 9, 6, 1, 9); P('#3e3a46', 4, 14, 2, 1); P('#3e3a46', 10, 14, 2, 1); break;
      case TL.BUSH: shadow(8, 13, 7, 2); stampCanvas(pb, bush(v >= 2), ox, oy + 2); break;
      case TL.ROCK: shadow(8, 13, 7, 2); stampCanvas(pb, rock(v), ox, oy + 2); break;
      case TL.TENT: shadow(8, 14, 8, 2); stampCanvas(pb, tent(), ox - 1, oy); break;
      case TL.SHRINE: shadow(8, 14, 7, 2); stampCanvas(pb, shrine(), ox, oy); break;
      case TL.CAMPFIRE: for (let a = 0; a < 8; a++) { const x = 8 + Math.round(Math.cos(a * Math.PI / 4) * 5), y = 10 + Math.round(Math.sin(a * Math.PI / 4) * 3); P('#5a5650', x - 1, y - 1, 3, 2); P('#8a867c', x - 1, y - 1, 2, 1); } P('#3a2416', 5, 10, 7, 2); P('#5a3a20', 5, 10, 7, 1); P('#2a1a0e', 7, 9, 3, 1); break;
      case TL.FENCE: { const fh = (x: number, y: number) => this.t(x, y) === TL.FENCE; const horiz = fh(tx - 1, ty) || fh(tx + 1, ty); const vert = fh(tx, ty - 1) || fh(tx, ty + 1);
        const post = (x: number) => { P('#3a2416', x - 1, 2, 4, 13); P('#8a6440', x, 3, 2, 11); P('#b08a5a', x, 3, 1, 11); P('#c8a070', x, 2, 2, 1); };
        if (horiz || !vert) { P('#3a2416', 0, 5, 16, 3); P('#3a2416', 0, 10, 16, 3); P('#a07a50', 0, 6, 16, 1); P('#7a5a38', 0, 7, 16, 1); P('#a07a50', 0, 11, 16, 1); P('#7a5a38', 0, 12, 16, 1); post(3); post(12); }
        if (vert) { P('#3a2416', 6, 0, 4, 16); P('#8a6440', 7, 0, 2, 16); P('#b08a5a', 7, 0, 1, 16); for (let y = 2; y < 16; y += 7) { P('#3a2416', 5, y, 6, 3); P('#c8a070', 6, y, 4, 1); } }
        break; }
      case TL.HEDGE: { const rp = ramp('#3a7a36'); P('#183418', 0, 2, 16, 14); for (let y = 3; y < 15; y++) for (let x = 0; x < 16; x++) { const n = h2(ox + x, oy + y, 77); P(y < 5 ? rp[3] : y > 12 ? rp[0] : n < 0.25 ? rp[1] : n > 0.85 ? rp[3] : rp[2], x, y); } break; }
      case TL.STALL: { const front = this.t(tx, ty + 1) !== TL.STALL; P('#3a2416', 0, 7, 16, 9); P('#a07a50', 1, 8, 14, 5); P('#c8a070', 1, 8, 14, 1); if (front) { P('#6e4e30', 1, 13, 14, 2); }
        const goods = ['#e0484f', '#f2c14e', '#7fd1a0', '#b48ae0']; for (let i = 0; i < 4; i++) { P(goods[(i + tx) % 4], 2 + i * 3, 6, 2, 2); P('#ffffff', 2 + i * 3, 6); } break; }
      case TL.STONEWALL: { P('#2a2838', 0, 0, 16, 16); for (let row = 0; row < 4; row++) { const y = row * 4; const off = (row % 2) * 4; for (let x = -off; x < 16; x += 8) { P('#6a6480', x + 1, y + 1, 6, 3); P('#8a84a0', x + 1, y + 1, 6, 1); } } break; }
    }
    if (isWall(t)) this.paintWall(tx, ty, t);
    void rnd;
  }
  private paintWall(tx: number, ty: number, t: number) {
    const pb = this.ground, ox = tx * T, oy = ty * T; const P = (col: string, x: number, y: number, w = 1, h = 1) => pb.rect(ox + x, oy + y, w, h, C(col));
    const isW = (x: number, y: number) => isWall(this.t(x, y)); const top = !isW(tx, ty - 1), bottom = !isW(tx, ty + 1), left = !isW(tx - 1, ty), right = !isW(tx + 1, ty);
    P('#e4d6b8', 0, 0, 16, 16); for (let i = 0; i < 10; i++) P(h2(tx, ty, i) > 0.5 ? '#d4c4a2' : '#efe4cc', Math.floor(h2(ty, tx, i) * 16), Math.floor(h2(tx + 3, ty, i) * 16));
    P('#5a3a22', 0, 0, 16, 2); P('#7a5230', 0, 0, 16, 1);
    if (left) { P('#4a2e1a', 0, 0, 3, 16); P('#7a5230', 1, 0, 1, 16); } if (right) { P('#4a2e1a', 13, 0, 3, 16); P('#6a4628', 14, 0, 1, 16); }
    if (bottom) { P('#5a5650', 0, 12, 16, 4); for (let x = 0; x < 16; x += 4) { P('#8a867c', x + (ty % 2) * 2, 12, 3, 1); P('#6e6a62', x + 3 + (ty % 2) * 2, 13, 1, 2); } P('#2a2620', 0, 15, 16, 1); }
    if (top) for (let x = 0; x < 16; x++) { pb.shade(ox + x, oy + 2, 0.7); pb.shade(ox + x, oy + 3, 0.82); }
    if (t === TL.WINDOW) { P('#3a2416', 3, 3, 10, 9); P('#2a3a5a', 4, 4, 8, 7); P('#4a6a9a', 4, 4, 3, 3); P('#8ab0d8', 4, 4, 1, 2); P('#5a3a22', 7, 4, 2, 7); P('#5a3a22', 4, 7, 8, 1); P('#6e4e30', 2, 11, 12, 2); P('#e86a8a', 3, 10, 2, 1); P('#f2c14e', 7, 10, 2, 1); P('#b48ae0', 11, 10, 2, 1); P('#3f8a3a', 5, 10, 2, 1); P('#3f8a3a', 9, 10, 2, 1); }
    if (t === TL.DOOR) { P('#2a180c', 3, 2, 10, 14); P('#6a4224', 4, 3, 8, 13); P('#7e5230', 4, 3, 4, 13); P('#5a3820', 8, 3, 1, 13); P('#4a2e1a', 4, 7, 8, 1); P('#4a2e1a', 4, 11, 8, 1); P('#f2c14e', 10, 9, 1, 2); P('#2a180c', 5, 2, 6, 1); P('#8a867c', 2, 15, 12, 1); }
  }
  /** Repaints crowns, roofs and awnings for tiles in [x0,x1)×[y0,y1) (clipped to that pixel area). */
  paintOverRegion(x0: number, y0: number, x1: number, y1: number) {
    const pb = this.over; const cx0 = x0 * T, cy0 = y0 * T, cx1 = x1 * T, cy1 = y1 * T;
    pb.clearRect(cx0, cy0, cx1 - cx0, cy1 - cy0); pb.clip = [cx0, cy0, cx1, cy1];
    for (const r of this.ctx.roofs) if ((r.x1 + 1) * T + 4 > cx0 && r.x0 * T - 4 < cx1 && (r.y1 + 1) * T + 6 > cy0 && r.y0 * T - 8 < cy1) paintRoof(pb, r, 0, 0);
    for (let ty = Math.max(0, y0 - 1); ty < Math.min(this.ctx.h, y1 + 2); ty++) for (let tx = Math.max(0, x0 - 2); tx < Math.min(this.ctx.w, x1 + 2); tx++) {
      const t = this.t(tx, ty);
      if (t === TL.TREE) { const v = this.ctx.v[ty * this.ctx.w + tx]; stampCanvas(pb, crown(v), tx * T + 8 - 16, ty * T + 10 - 30); }
      else if (t === TL.DEADTREE) stampCanvas(pb, crown(0, true), tx * T + 8 - 16, ty * T + 10 - 30);
      else if (t === TL.STALL && this.t(tx, ty - 1) !== TL.STALL) stampCanvas(pb, awning(tx), tx * T - 1, ty * T - 4);
    }
    pb.clip = null;
  }
}
function paintRoof(pb: PixelBuf, r: Roof, ox: number, oy: number) { const col = r.t === TL.ROOF_BLUE ? '#3a5a95' : r.t === TL.ROOF_GREEN ? '#3f7a4a' : r.t === TL.ROOF_PURPLE ? '#6a3a95' : '#9a3a46'; const rp = ramp(col);
  const X0 = r.x0 * T - 3 - ox, X1 = (r.x1 + 1) * T + 3 - ox, Y0 = r.y0 * T - 7 - oy, Y1 = (r.y1 + 1) * T + 3 - oy; const H = Y1 - Y0;
  // chimney
  const chx = X0 + Math.floor((X1 - X0) * 0.72); for (let y = Y0 - 6; y < Y0 + 6; y++) for (let x = chx; x < chx + 6; x++) pb.set(x, y, C(x === chx || y === Y0 - 6 ? '#2a1a14' : (y + (x % 2)) % 3 === 0 ? '#6a3a2a' : '#8a4a36'));
  for (let y = Y0; y < Y1; y++) {
    const k = (y - Y0) / H; const row = Math.floor((y - Y0) / 4); const inRow = (y - Y0) % 4;
    for (let x = X0; x < X1; x++) {
      const edge = x === X0 || x === X1 - 1; if (edge) { pb.set(x, y, C(rp[0])); continue; }
      let tone = k < 0.12 ? 3 : k < 0.55 ? 2 : k < 0.85 ? 1 : 1;
      const sx = (x - X0 + (row % 2) * 2) % 4; if (inRow === 3) tone = Math.max(0, tone - 2); else if (sx === 3 && inRow > 0) tone = Math.max(0, tone - 1); else if (inRow === 0 && sx < 2 && tone < 3) tone++;
      pb.set(x, y, C(rp[tone]));
    }
  }
  for (let x = X0; x < X1; x++) { pb.set(x, Y0, C(rp[0])); pb.set(x, Y0 + 1, C(rp[3])); pb.set(x, Y1 - 1, C('#1a1210')); pb.set(x, Y1 - 2, C(rp[0])); }
}

/** A building's roof as its own sprite, so it can be depth-sorted with the characters around it. */
const roofCache = new Map<string, { c: HTMLCanvasElement; x: number; y: number }>();
export function roofSprite(r: Roof): { c: HTMLCanvasElement; x: number; y: number } {
  const key = `${r.x0},${r.y0},${r.x1},${r.y1},${r.t}`; const hit = roofCache.get(key); if (hit) return hit;
  const x = r.x0 * T - 3, y = r.y0 * T - 13; const pb = new PixelBuf((r.x1 - r.x0 + 1) * T + 6, (r.y1 - r.y0 + 1) * T + 16);
  paintRoof(pb, r, x, y); pb.flush(); const out = { c: pb.canvas, x, y }; roofCache.set(key, out); return out;
}
const awnCache = new Map<number, HTMLCanvasElement>();
export function awning(tx: number): HTMLCanvasElement {
  const k = tx % 2; const hit = awnCache.get(k); if (hit) return hit; const pb = new PixelBuf(18, 6);
  for (let x = 0; x < 18; x++) for (let y = 0; y < 6; y++) pb.set(x, y, C(y === 5 ? '#3a2416' : (Math.floor(x / 3) % 2 ? '#e8e0c8' : (k ? '#3a8a5a' : '#a63a3a'))));
  pb.flush(); awnCache.set(k, pb.canvas); return pb.canvas;
}
/** Finds roof rectangles (one per building) so roofs can be drawn as single pieces. */
export function findRoofs(m: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(w * h); const out: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  for (let i = 0; i < w * h; i++) { if (seen[i] || !isRoof(m[i])) continue; const t = m[i]; let x0 = i % w, y0 = (i / w) | 0, x1 = x0, y1 = y0; const st = [i]; seen[i] = 1;
    while (st.length) { const j = st.pop()!; const x = j % w, y = (j / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const k = ny * w + nx; if (!seen[k] && m[k] === t) { seen[k] = 1; st.push(k); } } }
    out.push({ x0, y0, x1, y1, t }); }
  return out;
}
export { isGrassy };
