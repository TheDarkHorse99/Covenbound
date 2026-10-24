import { TL, walkSolid, isGrassy } from './tiles';
import { rngFrom, clamp, T } from '../core/util';
import type { Look } from '../art/sprites';

export type PropKind = 'cauldron' | 'roost' | 'rack' | 'crate' | 'board' | 'well' | 'bed' | 'roadblock' | 'stump';
export interface Prop { id: string; kind: PropKind; x: number; y: number; hw: number; hh: number; label: string }
export interface NpcDef { id: string; name: string; look: Look; x: number; y: number; role: string; flag?: string }
export interface Exit { side: 'w' | 'e'; to: string | null; from: 'w' | 'e' }
export interface MapData {
  id: string; name: string; sub: string; w: number; h: number; m: Uint8Array; v: Uint8Array; props: Prop[]; npcs: NpcDef[];
  entries: Record<string, { x: number; y: number }>; exits: Exit[]; field?: { x0: number; y0: number; x1: number; y1: number };
  safe: boolean; open: number[]; blight: number[]; regions: Record<string, { x: number; y: number; r: number }>; mid: number;
}

const L = (hat: Look['hat'], hatCol: string, band: string, hair: string, skin: string, robe: string): Look => ({ hat, hatCol, band, hair, skin, robe });

function base(w: number, h: number, seed: number) {
  const m = new Uint8Array(w * h).fill(TL.GRASS), v = new Uint8Array(w * h), r = rngFrom(seed);
  for (let i = 0; i < w * h; i++) { v[i] = Math.floor(r() * 4); const q = r(); if (q < 0.05) m[i] = TL.FLOWERS; else if (q < 0.12) m[i] = TL.TALL; }
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = t; };
  const rect = (x0: number, y0: number, x1: number, y1: number, t: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const border = (keep: (x: number, y: number) => boolean) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (keep(x, y)) continue;
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (d === 0 || (d === 1 && r() < 0.6)) set(x, y, TL.TREE);
    }
  };
  return { m, v, r, set, rect, border };
}
function openTiles(m: Uint8Array, w: number, h: number): number[] {
  const out: number[] = []; for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0; if (x > 1 && y > 1 && x < w - 2 && y < h - 2 && isGrassy(m[i])) out.push(i); } return out;
}

function buildHome(): MapData {
  const w = 36, h = 26; const { m, v, r, set, rect, border } = base(w, h, 101);
  border((x, y) => x >= w - 2 && y >= 12 && y <= 14);
  rect(4, 2, 10, 3, TL.ROOF_PURPLE); rect(4, 4, 10, 5, TL.HWALL); set(5, 4, TL.WINDOW); set(9, 4, TL.WINDOW); set(7, 5, TL.DOOR); set(9, 5, TL.WINDOW);
  rect(7, 6, 7, 13, TL.PATH); rect(7, 13, w - 1, 13, TL.PATH); rect(w - 3, 12, w - 1, 14, TL.PATH);
  for (let y = 12; y <= 14; y++) set(w - 1, y, TL.EXIT);
  // garden field with fence and a gap
  rect(12, 4, 27, 4, TL.FENCE); rect(12, 11, 27, 11, TL.FENCE); rect(12, 4, 12, 11, TL.FENCE); rect(27, 4, 27, 11, TL.FENCE);
  rect(13, 5, 26, 10, TL.SOIL); set(19, 11, TL.PATH); set(20, 11, TL.PATH); rect(19, 12, 20, 12, TL.PATH);
  // pond
  rect(26, 17, 31, 21, TL.DEEP); rect(25, 18, 25, 20, TL.SHALLOW); rect(27, 16, 30, 16, TL.SHALLOW); set(28, 19, TL.LILY); set(30, 18, TL.LILY);
  // decor
  for (const [x, y] of [[3, 19], [15, 20], [20, 22], [32, 6], [33, 9]]) set(x, y, TL.BUSH);
  for (const [x, y] of [[13, 16], [22, 21], [4, 12]]) set(x, y, TL.ROCK);
  rect(2, 15, 8, 15, TL.HEDGE); set(5, 15, TL.GRASS);
  const props: Prop[] = [
    { id: 'bed', kind: 'bed', x: 7 * T + 8, y: 5 * T + 8, hw: 8, hh: 8, label: 'Sleep' },
    { id: 'crate', kind: 'crate', x: 4 * T + 8, y: 7 * T + 4, hw: 7, hh: 5, label: 'Shipping crate' },
    { id: 'cauldron', kind: 'cauldron', x: 10 * T + 8, y: 7 * T + 4, hw: 8, hh: 5, label: 'Cauldron' },
    { id: 'rack', kind: 'rack', x: 2 * T + 12, y: 9 * T + 4, hw: 6, hh: 4, label: 'Broom rack' },
    { id: 'roost', kind: 'roost', x: 5 * T, y: 18 * T, hw: 18, hh: 10, label: 'Familiar roost' },
  ];
  const md: MapData = { id: 'home', name: 'Thistledown', sub: 'Your homestead', w, h, m, v, props, npcs: [], safe: true,
    entries: { e: { x: (w - 2.5) * T, y: 13 * T + 8 }, bed: { x: 7 * T + 8, y: 6 * T + 10 } }, exits: [{ side: 'e', to: 'village', from: 'w' }],
    field: { x0: 13, y0: 5, x1: 26, y1: 10 }, open: [], blight: [], regions: {}, mid: 13 };
  md.open = openTiles(m, w, h); void r; return md;
}

function buildVillage(): MapData {
  const w = 40, h = 26; const { m, v, set, rect, border } = base(w, h, 202);
  border((x, y) => (x <= 1 || x >= w - 2) && y >= 12 && y <= 13);
  rect(0, 12, w - 1, 13, TL.COBBLE); for (const y of [12, 13]) { set(0, y, TL.EXIT); set(w - 1, y, TL.EXIT); }
  const houses: [number, number, string][] = [[2, TL.ROOF, 'marrow'], [9, TL.ROOF_PURPLE, 'hettie'], [17, TL.ROOF_GREEN, 'wren'], [25, TL.ROOF_BLUE, 'corwin'], [32, TL.ROOF, 'tamsin']];
  for (const [x, roof] of houses) { rect(x, 4, x + 5, 6, roof); rect(x, 7, x + 5, 8, TL.HWALL); set(x + 1, 7, TL.WINDOW); set(x + 4, 7, TL.WINDOW); set(x + 2, 8, TL.DOOR); rect(x + 2, 9, x + 2, 11, TL.COBBLE); }
  rect(16, 14, 23, 19, TL.COBBLE);
  rect(26, 16, 29, 16, TL.STALL); rect(10, 16, 11, 16, TL.STALL);
  rect(3, 18, 8, 22, TL.DEEP); rect(4, 17, 7, 17, TL.SHALLOW); set(5, 20, TL.LILY);
  rect(30, 19, 36, 19, TL.FENCE); rect(30, 19, 30, 22, TL.FENCE); rect(31, 20, 35, 22, TL.FLOWERS);
  for (const [x, y] of [[13, 20], [24, 22], [36, 15], [2, 15]]) set(x, y, TL.BUSH);
  const npcY = 10 * T + 4;
  const npcs: NpcDef[] = [
    { id: 'marrow', name: 'Marrow', role: 'Seeds & sundries', x: 5 * T + 8, y: npcY, look: L('wide', '#5a3a22', '#c8a040', '#3a2a1a', '#c98e62', '#4f6a3a') },
    { id: 'hettie', name: 'Hettie', role: 'Hats & habits', x: 12 * T + 8, y: npcY, look: L('flower', '#3a6a2a', '#f2c14e', '#c0502a', '#f1c6a0', '#a63a6a') },
    { id: 'wren', name: 'Grandmother Wren', role: 'Quests & Crafts', x: 20 * T + 8, y: npcY, look: L('pointed', '#3a2050', '#b06aff', '#e8e8f0', '#f1c6a0', '#4a2a5a') },
    { id: 'corwin', name: 'Corwin', role: 'Wands, staves & charms', x: 28 * T + 8, y: npcY, look: L('crooked', '#1e2a3a', '#4fb3d9', '#8a8aa0', '#8fb8e8', '#2f4f8f') },
    { id: 'tamsin', name: 'Tamsin', role: 'Broom-maker', x: 35 * T + 8, y: npcY, look: L('pointed', '#4a2a1a', '#e07a30', '#e8d8a0', '#7fae5a', '#7a5a2a') },
    { id: 'ysolde', name: 'Ysolde', role: 'Hedge witch: rare goods', x: 22 * T + 8, y: 17 * T + 8, flag: 'ysolde', look: L('crooked', '#3a3a2a', '#9a5ad6', '#2a1a1a', '#d9c7f0', '#3a5a3a') },
  ];
  const props: Prop[] = [
    { id: 'board', kind: 'board', x: 19 * T + 8, y: 15 * T + 4, hw: 8, hh: 4, label: 'Order board' },
    { id: 'well', kind: 'well', x: 14 * T, y: 18 * T, hw: 8, hh: 6, label: 'Well' },
  ];
  const md: MapData = { id: 'village', name: 'Hollowmere', sub: 'Witch village', w, h, m, v, props, npcs, safe: true,
    entries: { w: { x: 2.5 * T, y: 13 * T }, e: { x: (w - 2.5) * T, y: 13 * T } }, exits: [{ side: 'w', to: 'home', from: 'e' }, { side: 'e', to: 'forest', from: 'w' }],
    open: [], blight: [], regions: {}, mid: 12 };
  md.open = openTiles(m, w, h); return md;
}

function buildForest(): MapData {
  const w = 84, h = 60, seed = 4401, r = rngFrom(seed), mid = h >> 1;
  let b = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) b[i] = r() < 0.45 ? 1 : 0;
  for (let pass = 0; pass < 4; pass++) {
    const n = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= w || yy >= h || b[yy * w + xx]) c++; }
      n[y * w + x] = c > 4 ? 1 : c < 4 ? 0 : b[y * w + x];
    }
    b = n;
  }
  const kind = new Uint8Array(w * h); // 1 road, 2 trail, 3 clearing
  const carve = (cx: number, cy: number, rad: number, k: number) => {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (x < 1 || y < 2 || x >= w - 1 || y >= h - 2) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) { const i = y * w + x; b[i] = 0; if (k > kind[i]) kind[i] = k; }
    }
  };
  // King's Road
  const roadY = new Int16Array(w).fill(mid); let x = 0, y = mid;
  while (x < w) { carve(x, y, 2.6, 0); carve(x, y, 1.1, 1); roadY[x] = y; if (r() < 0.65) x++; else y = clamp(y + (r() < 0.5 ? -1 : 1), mid - 5, mid + 5); }
  for (let xx = w - 5; xx < w; xx++) { carve(xx, mid, 1.1, 1); roadY[xx] = mid; } for (let yy = Math.min(y, mid); yy <= Math.max(y, mid); yy++) carve(w - 5, yy, 1.1, 1);
  for (let xx = 0; xx < 5; xx++) { carve(xx, mid, 1.1, 1); roadY[xx] = mid; }
  const regions: MapData['regions'] = {
    camp: { x: 25, y: mid + 15, r: 6 }, hollow: { x: 66, y: mid - 17, r: 7 }, hideout: { x: 47, y: mid + 19, r: 4.5 },
    pond1: { x: 13, y: mid - 15, r: 4.5 }, pond2: { x: 54, y: mid - 9, r: 3.5 }, glade: { x: 38, y: mid - 16, r: 5 }, thicket: { x: 74, y: mid + 14, r: 5 },
  };
  const trail = (x0: number, y0: number, x1: number, y1: number) => {
    let cx = x0, cy = y0; let guard = 0;
    while ((Math.abs(cx - x1) > 0 || Math.abs(cy - y1) > 0) && guard++ < 400) {
      carve(cx, cy, 1.3, 2);
      if (Math.abs(cx - x1) > Math.abs(cy - y1) ? r() < 0.75 : r() < 0.25) cx += Math.sign(x1 - cx); else cy += Math.sign(y1 - cy);
    }
  };
  for (const k in regions) { const g = regions[k]; carve(g.x, g.y, g.r, 3); trail(g.x, g.y, g.x, roadY[g.x]); }
  const m = new Uint8Array(w * h), v = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    v[i] = Math.floor(r() * 4); const xx = i % w, yy = (i / w) | 0; const edge = xx === 0 || yy < 1 || xx === w - 1 || yy >= h - 1;
    if (b[i] || edge) m[i] = TL.TREE;
    else if (kind[i] === 1 || kind[i] === 2) m[i] = TL.PATH;
    else { const q = r(); m[i] = q < 0.07 ? TL.FLOWERS : q < 0.2 ? TL.TALL : TL.GRASS; if (kind[i] === 0 && q > 0.97) m[i] = r() < 0.5 ? TL.BUSH : TL.ROCK; }
  }
  for (const yy of [mid - 1, mid, mid + 1]) { m[yy * w] = TL.EXIT; m[yy * w + 1] = TL.PATH; m[yy * w + w - 1] = TL.EXIT; m[yy * w + w - 2] = TL.PATH; }
  // ponds
  for (const k of ['pond1', 'pond2']) { const g = regions[k]; for (let yy = Math.floor(g.y - g.r); yy <= g.y + g.r; yy++) for (let xx = Math.floor(g.x - g.r); xx <= g.x + g.r; xx++) {
    const d = Math.hypot(xx - g.x, yy - g.y); const i = yy * w + xx; if (d < g.r - 1.6) m[i] = r() < 0.08 ? TL.LILY : TL.DEEP; else if (d < g.r - 0.7) m[i] = TL.SHALLOW; } }
  // bandit camp
  { const g = regions.camp; m[g.y * w + g.x] = TL.CAMPFIRE; for (const [dx, dy] of [[-3, -2], [3, -2], [-2, 3]]) m[(g.y + dy) * w + g.x + dx] = TL.TENT; }
  // reachability from the road; unreachable pockets become trees
  const reach = new Uint8Array(w * h); const st = [mid * w + 2]; reach[st[0]] = 1;
  while (st.length) { const i = st.pop()!; const xx = i % w, yy = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const ni = ny * w + nx; if (reach[ni] || walkSolid(m[ni])) continue; reach[ni] = 1; st.push(ni); } }
  for (let i = 0; i < w * h; i++) if (!reach[i] && !walkSolid(m[i]) && m[i] !== TL.SHALLOW) m[i] = TL.TREE;
  // blight
  const blight: number[] = []; const isB = new Uint8Array(w * h);
  const blob = (cx: number, cy: number, rad: number) => { for (let yy = Math.floor(cy - rad); yy <= cy + rad; yy++) for (let xx = Math.floor(cx - rad); xx <= cx + rad; xx++) {
    if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue; const i = yy * w + xx; if (Math.hypot(xx - cx, yy - cy) > rad + r() * 0.8) continue;
    if (isGrassy(m[i])) { m[i] = TL.BLIGHT; if (!isB[i]) { isB[i] = 1; blight.push(i); } } else if (m[i] === TL.TREE && r() < 0.5) { m[i] = TL.DEADTREE; if (!isB[i]) { isB[i] = 1; blight.push(i); } } } };
  const hollow = regions.hollow; blob(hollow.x, hollow.y, 6.5); blob(hollow.x - 7, hollow.y + 4, 3); blob(hollow.x + 5, hollow.y + 7, 3);
  const open = openTiles(m, w, h).filter(i => reach[i]);
  for (let k = 0; k < 10; k++) { const i = open[Math.floor(r() * open.length)]; const xx = i % w, yy = (i / w) | 0; if (xx < 12 || Math.abs(yy - roadY[xx]) < 3) continue; blob(xx, yy, 1.5 + r() * 1.5); }
  const md: MapData = { id: 'forest', name: 'Brindlewood', sub: 'Corrupted forest · Lv 1–8', w, h, m, v, props: [], npcs: [], safe: false,
    entries: { w: { x: 2.5 * T, y: mid * T + 8 }, e: { x: (w - 2.5) * T, y: mid * T + 8 } }, exits: [{ side: 'w', to: 'village', from: 'e' }, { side: 'e', to: null, from: 'w' }],
    open: openTiles(m, w, h).filter(i => reach[i]), blight, regions, mid };
  return md;
}

const CACHE: Record<string, MapData> = {};
export function getMap(id: string): MapData {
  if (!CACHE[id]) CACHE[id] = id === 'home' ? buildHome() : id === 'village' ? buildVillage() : buildForest();
  return CACHE[id];
}
export const MAP_IDS = ['home', 'village', 'forest'];
