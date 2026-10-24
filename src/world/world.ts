import { T, clamp, dist, pick, rint, R, weighted, rngFrom, fmtTime } from '../core/util';
import {
  S, calcStats, Stats, addItem, removeItem, removeAt, selected, countItem, companion, jobFam, famStat, hasTal, giveFamXp, famName,
  DAY_START, DAY_END, saveGame, ForageNode, lifeNeed, newFamiliar, invFull,
} from '../core/state';
import { getMap, MapData, Prop, NpcDef } from './maps';
import { TL, walkSolid, projSolid, isGrassy } from './tiles';
import { CROP, ING, POTION, potionTierVal } from '../data/brewing';
import { ITEMS, sellPrice } from '../data/items';
import { BPART } from '../data/gear';
import { SPECIES, EVO } from '../data/familiars';
import { QUESTS } from '../data/quests';
import { sfx } from '../core/audio';
import { castSkill, updateCombat, spawnForMap, tryBind, Enemy, Proj, Zone, Ally, hurtPlayer, throwPotion } from './combat';

export interface Line { who: string; text: string }
export const hooks = {
  toast: (_m: string, _c?: string) => { /* set by UI */ },
  banner: (_a: string, _b?: string) => { /* set by UI */ },
  say: (_lines: Line[], _cb?: () => void) => { /* set by UI */ },
  open: (_kind: string, _arg?: unknown) => { /* set by UI */ },
  hud: () => { /* set by UI */ },
  tile: (_i: number) => { /* set by renderer */ },
  mapChanged: () => { /* set by renderer */ },
};

export interface Buff { t: number; v: number }
export interface Player {
  x: number; y: number; hw: number; hh: number; fx: number; fy: number; hp: number; mp: number;
  cd: number[]; cdMax: number[]; inv: number; combat: number; walk: number; flying: boolean; stam: number;
  dashT: number; dashV: { x: number; y: number }; air: number; wild: number; dead: number; net: number;
  buffs: Record<string, Buff>; hot: number; ucd: number; circle: number;
}
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; grav: number }
export interface Float { x: number; y: number; txt: string; col: string; life: number }
export interface Fx { k: string; x: number; y: number; t: number; d: number; R: number; col: string; lt: string; a?: number; tx?: number; ty?: number }
export interface Pickup { k: 'item' | 'gold' | 'gear'; id?: string; q?: number; n: number; gear?: import('../data/gear').Gear; x: number; y: number; t: number }
export interface Corpse { id: string; x: number; y: number; t: number }

export const W = {
  map: null as unknown as MapData, m: new Uint8Array(0) as Uint8Array, v: new Uint8Array(0) as Uint8Array,
  P: null as unknown as Player, F: { x: 0, y: 0, cd: 1, tx: 0, ty: 0, hits: 0 },
  st: null as unknown as Stats,
  enemies: [] as Enemy[], proj: [] as Proj[], zones: [] as Zone[], allies: [] as Ally[], fx: [] as Fx[], parts: [] as Particle[],
  floats: [] as Float[], pickups: [] as Pickup[], corpses: [] as Corpse[],
  clock: 0, paused: false, shakeT: 0, shakeA: 0, spawnT: 5, wildT: 3, patrolT: 20, banditT: 30,
  aim: { x: 0, y: 0, mouse: false, t: 0 }, input: { x: 0, y: 0 }, minuteAcc: 0, lastSave: 0, flyWarn: 0, bossRef: null as Enemy | null,
};

// ---------- small helpers ----------
export function refresh() { const old = W.st; W.st = calcStats(); const P = W.P; if (P && old) { if (old.maxHp) P.hp = Math.min(W.st.maxHp, P.hp * W.st.maxHp / old.maxHp); P.mp = Math.min(W.st.maxMp, P.mp); } hooks.hud(); }
export function addPart(x: number, y: number, col: string, n = 6, spd = 40, life = 0.5, size = 1, grav = 0) {
  for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, s = spd * (0.4 + R() * 0.8); W.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + R() * 0.6), max: life, col, size, grav }); }
}
export function floatText(x: number, y: number, txt: string | number, col: string) { W.floats.push({ x, y, txt: String(txt), col, life: 0.9 }); }
export function shake(a: number) { W.shakeA = Math.max(W.shakeA, a); W.shakeT = 0.2; }
export const isNight = () => S.time >= 19 * 60 || S.time < 5 * 60;
export function darkness(): number {
  const t = S.time; if (t < 17.5 * 60) return 0; if (t < 20 * 60) return ((t - 17.5 * 60) / 150) * 0.78; return 0.78;
}
export function lightRadius(): number {
  const L = BPART[S.broom.lantern]; const g = W.P.buffs.glimmer; return (L.light || 26) * W.st.light * (g && g.t > 0 ? 1 + g.v / 100 : 1);
}
export function revealGlimmer(): boolean { const g = W.P.buffs.glimmer; return !!(BPART[S.broom.lantern].reveal || (g && g.t > 0)); }

// ---------- tiles & collision ----------
export const tileIdx = (x: number, y: number) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= W.map.w || ty >= W.map.h) return -1; return ty * W.map.w + tx; };
export function tileAt(x: number, y: number): number { const i = tileIdx(x, y); return i < 0 ? TL.STONEWALL : W.m[i]; }
export function setTile(i: number, t: number) { if (W.m[i] === t) return; W.m[i] = t; hooks.tile(i); }
export type Mode = 'walk' | 'proj' | 'fly' | 'enemy';
function solidTile(t: number, mode: Mode) { if (mode === 'fly') return false; if (mode === 'proj') return projSolid(t); return walkSolid(t); }
export function boxSolid(x: number, y: number, hw: number, hh: number, mode: Mode): boolean {
  const x0 = Math.floor((x - hw) / T), x1 = Math.floor((x + hw) / T), y0 = Math.floor((y - hh) / T), y1 = Math.floor((y + hh) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (tx < 0 || ty < 0 || tx >= W.map.w || ty >= W.map.h) return true; if (solidTile(W.m[ty * W.map.w + tx], mode)) return true; }
  if (mode !== 'proj' && mode !== 'fly') for (const p of W.map.props) if (Math.abs(x - p.x) < hw + p.hw && Math.abs(y - p.y) < hh + p.hh) return true;
  return false;
}
export function moveBody(b: { x: number; y: number; hw: number; hh: number }, dx: number, dy: number, mode: Mode) {
  if (dx) { const nx = b.x + dx; if (!boxSolid(nx, b.y, b.hw, b.hh, mode)) b.x = nx; else if (Math.abs(dy) < 0.01) { for (const s of [3, -3]) { if (!boxSolid(nx, b.y + s, b.hw, b.hh, mode) && !boxSolid(b.x, b.y + s, b.hw, b.hh, mode)) { b.y += Math.sign(s) * Math.min(Math.abs(dx), 1); break; } } } }
  if (dy) { const ny = b.y + dy; if (!boxSolid(b.x, ny, b.hw, b.hh, mode)) b.y = ny; else if (Math.abs(dx) < 0.01) { for (const s of [3, -3]) { if (!boxSolid(b.x + s, ny, b.hw, b.hh, mode) && !boxSolid(b.x + s, b.y, b.hw, b.hh, mode)) { b.x += Math.sign(s) * Math.min(Math.abs(dy), 1); break; } } } }
  b.x = clamp(b.x, b.hw + 1, W.map.w * T - b.hw - 1); b.y = clamp(b.y, b.hh + 1, W.map.h * T - b.hh - 1);
}
export function nearestWalkable(x: number, y: number): { x: number; y: number } | null {
  const tx0 = Math.floor(x / T), ty0 = Math.floor(y / T);
  for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const tx = tx0 + dx, ty = ty0 + dy;
    const cx = tx * T + 8, cy = ty * T + 10; if (!boxSolid(cx, cy, 4, 3, 'walk') && W.m[ty * W.map.w + tx] !== TL.EXIT) return { x: cx, y: cy };
  }
  return null;
}

// ---------- player ----------
export function makePlayer(): Player {
  return { x: 0, y: 0, hw: 4, hh: 3, fx: 0, fy: 1, hp: 1, mp: 1, cd: [0, 0, 0], cdMax: [1, 1, 1], inv: 0, combat: 0, walk: 0, flying: false, stam: 100,
    dashT: 0, dashV: { x: 0, y: 0 }, air: 0, wild: 0, dead: 0, net: 0, buffs: {}, hot: 0, ucd: 0, circle: 0 };
}
export function heal(h: number) { const P = W.P; const before = P.hp; P.hp = Math.min(W.st.maxHp, P.hp + h); const d = Math.round(P.hp - before); if (d > 0) floatText(P.x, P.y - 22, '+' + d, '#a8d65a'); }
export function giveXp(x: number) {
  const c = S.crafts[S.craft]!; c.xp += Math.round(x); let up = false;
  while (c.lvl < 30 && c.xp >= Math.floor(20 * Math.pow(c.lvl, 1.5))) { c.xp -= Math.floor(20 * Math.pow(c.lvl, 1.5)); c.lvl++; up = true; }
  if (up) { refresh(); W.P.hp = W.st.maxHp; W.P.mp = W.st.maxMp; hooks.banner('LEVEL UP', `${craftName()} Lv ${c.lvl}`); sfx('level'); addPart(W.P.x, W.P.y - 8, '#f2c14e', 24, 70, 0.9); }
  hooks.hud();
}
import { CRAFTS } from '../data/crafts';
export const craftName = () => CRAFTS[S.craft].name;
export function giveLife(skill: 'garden' | 'forage' | 'brew', x: number) {
  const s = S.life[skill]; s.xp += x; while (s.lvl < 10 && s.xp >= lifeNeed(s.lvl)) { s.xp -= lifeNeed(s.lvl); s.lvl++; hooks.toast(`${{ garden: 'Gardening', forage: 'Foraging', brew: 'Brewing' }[skill]} reached Lv ${s.lvl}.`, 'good'); sfx('level'); }
}
export function companionXp(x: number) {
  const c = companion(); if (!c) return; const before = c.lvl;
  for (const m of giveFamXp(c, x * S.fondness)) hooks.toast(m, 'good');
  if (c.lvl !== before) { refresh(); const ev = EVO[c.stage]; if (ev && c.lvl >= ev.lvl && before < ev.lvl) hooks.toast(`${famName(c)} can evolve! Open Familiars (F).`, 'good'); }
}

// ---------- maps ----------
export function enterMap(id: string, from?: string) {
  const map = getMap(id); S.map = id; W.map = map;
  W.m = map.m.slice(); W.v = map.v;
  if (id === 'home') for (const k in S.plots) { const [x, y] = k.split(',').map(Number); W.m[y * map.w + x] = S.plots[k].wet ? TL.WET : TL.TILLED; }
  if (id === 'forest') {
    const cleanAll = !!S.flags.cleansed; const r = rngFrom(77);
    for (const i of map.blight) { const keep = cleanAll ? r() < 0.15 : true; if (!keep || S.cleansed.includes(i)) W.m[i] = map.m[i] === TL.DEADTREE ? TL.TREE : TL.GRASS; }
  }
  W.enemies = []; W.proj = []; W.zones = []; W.allies = []; W.fx = []; W.parts = []; W.floats = []; W.pickups = []; W.corpses = [];
  const P = W.P; let pos = from && map.entries[from] ? map.entries[from] : map.entries.bed || map.entries.w;
  P.x = pos.x; P.y = pos.y; if (P.flying && boxSolid(P.x, P.y, P.hw, P.hh, 'walk')) { /* stay flying */ }
  W.F.x = P.x - 12; W.F.y = P.y; W.spawnT = 5; W.wildT = 2; W.patrolT = 15; W.banditT = 25;
  ensureForage();
  spawnForMap();
  hooks.banner(map.name, map.sub);
  hooks.mapChanged(); hooks.hud();
  saveNow();
}
export function saveNow() { if (!W.P) return; saveGame({ x: W.P.x, y: W.P.y, hp: W.P.hp, mp: W.P.mp }); }

// ---------- forage ----------
const FORAGE_TABLE: Record<string, [string, number][]> = {
  home: [['wildsage', 3], ['dewcap', 2], ['kindleberry', 2], ['featherfern', 1]],
  forest: [['wildsage', 3], ['dewcap', 3], ['featherfern', 2], ['kindleberry', 2], ['wolfsbell', 3]],
};
export function ensureForage() {
  if (S.forageDay === S.day && S.forage.home) return;
  S.forageDay = S.day; S.forage = {};
  for (const id of ['home', 'forest']) {
    const map = getMap(id); const r = rngFrom(S.day * 1009 + id.length * 31 + 7); const nodes: ForageNode[] = [];
    const n = id === 'home' ? 5 : 18, g = id === 'home' ? 2 : 7;
    const used = new Set<number>();
    const ok = (i: number) => { if (used.has(i)) return false; const x = i % map.w, y = (i / map.w) | 0; if (id === 'home' && map.field && x >= map.field.x0 - 1 && x <= map.field.x1 + 1 && y >= map.field.y0 - 1 && y <= map.field.y1 + 1) return false; if (x < 4 && id === 'forest') return false; return true; };
    let tries = 0;
    while (nodes.length < n + g && tries++ < 600) {
      const i = map.open[Math.floor(r() * map.open.length)]; if (!ok(i)) continue; used.add(i);
      const glimmer = nodes.length >= n; const item = glimmer ? 'glowmoss' : weighted(FORAGE_TABLE[id], r);
      nodes.push({ x: (i % map.w) * T + 8, y: ((i / map.w) | 0) * T + 10, id: item, glimmer });
    }
    if (id === 'forest') { const cl = S.cleansed.slice(); const extra = Math.min(3, Math.floor(cl.length / 4) + (S.flags.cleansed ? 3 : 0));
      const pool = S.flags.cleansed ? map.blight.slice() : cl; for (let k = 0; k < extra && pool.length; k++) { const i = pool[Math.floor(r() * pool.length)]; if (map.m[i] === TL.DEADTREE) continue; nodes.push({ x: (i % map.w) * T + 8, y: ((i / map.w) | 0) * T + 10, id: 'starbloom', glimmer: true }); } }
    S.forage[id] = nodes;
  }
}
export function forageNodes(): ForageNode[] { return S.forage[S.map] || []; }
export function nodeVisible(n: ForageNode): boolean {
  if (W.map.id === 'forest' && W.m[tileIdx(n.x, n.y)] === TL.BLIGHT) return false;
  if (!n.glimmer) return true; if (!isNight()) return false;
  return revealGlimmer() ? dist(n.x, n.y, W.P.x, W.P.y) < lightRadius() * 1.6 : dist(n.x, n.y, W.P.x, W.P.y) < lightRadius() * 0.8;
}
function pickForage(n: ForageNode) {
  const list = forageNodes(); list.splice(list.indexOf(n), 1);
  const lv = S.life.forage.lvl; const roll = R() + lv * 0.03; const q = roll > 0.95 ? 3 : roll > 0.7 ? 2 : 1;
  let count = 1; if (R() < lv * 0.04 + W.st.forage / 100) count = 2;
  const left = addItem(n.id, q, count); if (left > 0) { hooks.toast('Your bag is full.', 'bad'); list.push(n); return; }
  sfx('pick'); addPart(n.x, n.y - 4, ING[n.id].a, 8, 30, 0.4);
  floatText(n.x, n.y - 12, `+${count} ${ING[n.id].name}`, '#e9dfc7');
  giveLife('forage', n.glimmer ? 8 : 3); hooks.hud();
}

// ---------- garden ----------
export const plotKey = (tx: number, ty: number) => `${tx},${ty}`;
export function inField(tx: number, ty: number) { const f = W.map.field; return !!f && W.map.id === 'home' && tx >= f.x0 && tx <= f.x1 && ty >= f.y0 && ty <= f.y1; }
export function cropStage(p: { crop?: string; age: number }): number { if (!p.crop) return -1; const d = CROP[p.crop].days; if (p.age >= d) return 3; if (p.age === 0) return 0; return p.age / d < 0.5 ? 1 : 2; }
function useEnergy(n: number): boolean { if (S.energy < n) { hooks.toast('Too tired. Sleep to restore energy.', 'bad'); return false; } S.energy -= n; return true; }
export function targetTile(): { tx: number; ty: number } {
  const P = W.P;
  if (W.aim.mouse && dist(W.aim.x, W.aim.y, P.x, P.y - 4) < 30) return { tx: Math.floor(W.aim.x / T), ty: Math.floor(W.aim.y / T) };
  return { tx: Math.floor((P.x + P.fx * 12) / T), ty: Math.floor((P.y - 2 + P.fy * 12) / T) };
}
function harvest(tx: number, ty: number): boolean {
  const k = plotKey(tx, ty); const p = S.plots[k]; if (!p || !p.crop || cropStage(p) < 3) return false;
  const c = CROP[p.crop]; const lv = S.life.garden.lvl; const roll = R() + p.q + lv * 0.03 + W.st.garden / 100;
  const q = roll > 1.05 ? 3 : roll > 0.75 ? 2 : 1; const n = 1 + (R() < lv * 0.05 ? 1 : 0);
  if (addItem(c.ing, q, n) > 0) { hooks.toast('Your bag is full.', 'bad'); return true; }
  S.harvested[c.id] = (S.harvested[c.id] || 0) + n; giveLife('garden', 6);
  floatText(tx * T + 8, ty * T, `+${n} ${ING[c.ing].name}`, '#e9dfc7'); sfx('pick'); addPart(tx * T + 8, ty * T + 8, c.fruit, 10, 40, 0.5);
  if (c.regrow) { p.age = c.days - c.regrow; } else { p.crop = undefined; p.age = 0; p.q = 0; }
  checkQuest(); hooks.hud(); return true;
}

// ---------- interactions ----------
export function nearProp(): Prop | null { const P = W.P; for (const p of W.map.props) if (Math.abs(p.x - P.x) < p.hw + 14 && Math.abs(p.y - P.y) < p.hh + 16) return p; return null; }
export function activeNpcs(): NpcDef[] { return W.map.npcs.filter(n => !n.flag || S.flags[n.flag]); }
export function nearNpc(): NpcDef | null { for (const n of activeNpcs()) if (dist(n.x, n.y, W.P.x, W.P.y) < 22) return n; return null; }
export function interact() {
  const P = W.P; if (P.dead > 0) return;
  if (P.flying) { hooks.toast('Land first (B).', 'dim'); return; }
  const npc = nearNpc(); if (npc) { hooks.open('npc', npc); return; }
  const prop = nearProp(); if (prop) { useProp(prop); return; }
  const fp = { x: P.x + P.fx * 8, y: P.y - 2 + P.fy * 8 };
  const node = forageNodes().filter(nodeVisible).find(n => dist(n.x, n.y, fp.x, fp.y) < 14 || dist(n.x, n.y, P.x, P.y) < 12);
  if (node) { pickForage(node); return; }
  const tt = targetTile(); if (harvest(tt.tx, tt.ty)) return;
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (harvest(Math.floor(P.x / T) + dx, Math.floor((P.y - 2) / T) + dy)) return;
  const w = W.enemies.find(e => e.wild && dist(e.x, e.y, P.x, P.y) < 30); if (w) { tryBind(w); return; }
  if (W.map.id === 'forest' && S.flags.halloranActive && !S.bosses.halloran) { const h = W.map.regions.hideout; if (dist(P.x, P.y, h.x * T, h.y * T) < 40) { hooks.say([{ who: 'Ysolde', text: 'They are here! Witchfinder Halloran and his wardens. Please, drive them off!' }]); return; } }
}
function useProp(p: Prop) {
  switch (p.kind) {
    case 'bed': hooks.open('sleep'); break;
    case 'cauldron': hooks.open('cauldron'); break;
    case 'roost': hooks.open('roost'); break;
    case 'rack': hooks.open('broom'); break;
    case 'crate': hooks.open('crate'); break;
    case 'board': if (S.flags.orders) hooks.open('board'); else hooks.toast('An empty board. Grandmother Wren will put it to use soon.', 'dim'); break;
    case 'well': hooks.toast('You peer down the well. A frog peers back.', 'dim'); break;
    default: break;
  }
}
export function useSelected(aim?: { x: number; y: number }) {
  const P = W.P; if (P.dead > 0) return; const st = selected(); if (!st) { castSkill(0, aim); return; }
  const d = ITEMS[st.id]; const tt = aim && dist(aim.x, aim.y, P.x, P.y - 4) < 30 ? { tx: Math.floor(aim.x / T), ty: Math.floor(aim.y / T) } : targetTile();
  if (st.id === 'wand') { castSkill(0, aim); return; }
  if (P.flying) { hooks.toast('Land first (B).', 'dim'); return; }
  const i = tt.ty * W.map.w + tt.tx; const t = W.m[i]; const k = plotKey(tt.tx, tt.ty);
  if (st.id === 'hoe') {
    if (!inField(tt.tx, tt.ty)) { hooks.toast('Only your garden field can be tilled.', 'dim'); return; }
    if (t === TL.SOIL) { if (!useEnergy(2)) return; S.plots[k] = { age: 0, wet: S.rain, q: 0 }; setTile(i, S.rain ? TL.WET : TL.TILLED); sfx('till'); addPart(tt.tx * T + 8, tt.ty * T + 10, '#6a4428', 6, 30, 0.3); hooks.hud(); }
    else if ((t === TL.TILLED || t === TL.WET) && S.plots[k] && !S.plots[k].crop) { delete S.plots[k]; setTile(i, TL.SOIL); sfx('till'); }
    return;
  }
  if (st.id === 'can') {
    const targets = [i]; let did = false;
    for (const j of targets) { const kk = plotKey(j % W.map.w, (j / W.map.w) | 0); const p = S.plots[kk]; if (p && !p.wet) { if (!useEnergy(1)) return; p.wet = true; setTile(j, TL.WET); did = true; } }
    if (did) { sfx('water'); addPart(tt.tx * T + 8, tt.ty * T + 6, '#a6e4ff', 8, 25, 0.4, 1, 60); hooks.hud(); }
    else if (t === TL.DEEP || t === TL.SHALLOW) hooks.toast('Your can is always full. It is a witch\'s can.', 'dim');
    return;
  }
  if (d.kind === 'seed') {
    const p = S.plots[k]; if (!p) { hooks.toast('Plant in tilled soil. Use the Hoe on your field first.', 'dim'); return; }
    if (p.crop) { hooks.toast('Something is already growing there.', 'dim'); return; }
    p.crop = st.id.slice(5); p.age = 0; p.q = 0; removeAt(S.sel); sfx('plant'); hooks.hud(); return;
  }
  if (d.kind === 'potion') { usePotion(S.sel, aim, tt); return; }
  if (d.kind === 'ingredient') { hooks.toast('Ingredients go in your cauldron.', 'dim'); return; }
  if (st.id === 'charm') { hooks.toast('Stand beside a dazed wild familiar and press E.', 'dim'); return; }
  if (d.kind === 'essence') { hooks.toast('Essence evolves familiars. Open Familiars (F).', 'dim'); return; }
}
export function usePotion(slot: number, aim?: { x: number; y: number }, tt?: { tx: number; ty: number }) {
  const P = W.P; const st = S.inv[slot]; if (!st) return; const pid = st.id.slice(2); const pd = POTION[pid]; const tier = st.q;
  const herb = S.craft === 'herbal' ? 1.4 : 1; const v = (a: number[]) => potionTierVal(a, tier);
  const T4 = tt ?? targetTile();
  switch (pd.use) {
    case 'drink': {
      switch (pid) {
        case 'healing': if (P.hp >= W.st.maxHp) { hooks.toast('HP is already full.', 'dim'); return; } heal(W.st.maxHp * v([0.25, 0.4, 0.55, 0.75]) * herb); break;
        case 'mana': P.mp = Math.min(W.st.maxMp, P.mp + W.st.maxMp * v([0.3, 0.5, 0.7, 1]) * herb); floatText(P.x, P.y - 22, '+MP', '#4fb3d9'); break;
        case 'clarity': heal(W.st.maxHp * v([0.2, 0.3, 0.4, 0.55]) * herb); P.mp = Math.min(W.st.maxMp, P.mp + W.st.maxMp * v([0.2, 0.3, 0.4, 0.55]) * herb); break;
        case 'stoneheart': P.buffs.hot = { t: 10, v: W.st.maxHp * v([0.3, 0.45, 0.6, 0.8]) * herb / 10 }; P.buffs.ward = { t: 10, v: 20 }; break;
        case 'quickstep': P.buffs.quick = { t: 120, v: v([15, 25, 35, 50]) * herb }; break;
        case 'wardskin': P.buffs.ward = { t: 90, v: Math.min(70, v([15, 25, 35, 45]) * herb) }; break;
        case 'glimmer': P.buffs.glimmer = { t: 180, v: v([30, 50, 70, 100]) * herb }; break;
        case 'haste': P.buffs.haste = { t: 90, v: Math.min(60, v([15, 22, 30, 40]) * herb) }; break;
        case 'thornmail': P.buffs.thorn = { t: 90, v: v([20, 30, 40, 55]) * herb }; break;
        case 'fondness': S.fondness = Math.max(S.fondness, v([1.5, 2, 2.5, 3])); hooks.toast('Your companion glows with affection. Double XP until you sleep.', 'good'); break;
      }
      sfx('heal'); addPart(P.x, P.y - 8, pd.col, 14, 40, 0.6, 1, -30); removeAt(slot); hooks.hud(); return;
    }
    case 'throw': {
      const a = aim ?? { x: P.x + P.fx * 60, y: P.y - 6 + P.fy * 60 };
      throwPotion(pid, tier, a); removeAt(slot); hooks.hud(); return;
    }
    case 'crop': {
      if (W.map.id !== 'home') { hooks.toast('Use this on your crops at home.', 'dim'); return; }
      const cells = pid === 'bloomwater' ? [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => [T4.tx + dx, T4.ty + dy])) : [[T4.tx, T4.ty]];
      let any = false;
      for (const [x, y] of cells) { const p = S.plots[plotKey(x, y)]; if (!p) continue; if (pid === 'bloomwater') { p.wet = true; setTile(y * W.map.w + x, TL.WET); }
        if (p.crop && cropStage(p) < 3) { p.age = Math.min(CROP[p.crop].days, p.age + (pid === 'growth' ? v([1, 1, 2, 2]) : 1)); if (tier >= 3) p.q += 0.3; any = true; } else if (pid === 'bloomwater') any = true; }
      if (!any) { hooks.toast('Use it on a growing crop.', 'dim'); return; }
      sfx('heal'); addPart(T4.tx * T + 8, T4.ty * T + 6, pd.col, 16, 40, 0.6, 1, -20); removeAt(slot); hooks.hud(); return;
    }
    case 'cleanse': {
      if (W.map.id !== 'forest') { hooks.toast('Use it on blighted ground.', 'dim'); return; }
      const rad = v([1, 2, 2, 3]); const cx = T4.tx, cy = T4.ty; let n = 0;
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { if (dx * dx + dy * dy > rad * rad + 1) continue; const i = (cy + dy) * W.map.w + cx + dx; if (W.m[i] === TL.BLIGHT || W.m[i] === TL.DEADTREE) { setTile(i, W.m[i] === TL.DEADTREE ? TL.TREE : TL.GRASS); if (!S.cleansed.includes(i)) S.cleansed.push(i); n++; } }
      if (!n) { hooks.toast('No blight there. Aim at the purple ground.', 'dim'); return; }
      sfx('heal'); addPart(cx * T + 8, cy * T + 8, '#fff6c0', 30, 70, 0.9, 1, -20); hooks.toast(`The blight lifts from ${n} tiles. Something may grow here at night.`, 'good');
      removeAt(slot); hooks.hud(); return;
    }
    case 'breed': hooks.toast('Use the nest at your familiar roost to breed.', 'dim'); return;
    default: hooks.toast('This brew is useless. Sell it, or pour it out.', 'dim');
  }
}

// ---------- broom ----------
export function toggleBroom() {
  const P = W.P; if (P.dead > 0) return;
  if (P.net > 0) { hooks.toast('You are tangled in a net!', 'bad'); return; }
  if (P.flying) {
    if (boxSolid(P.x, P.y, P.hw, P.hh, 'walk')) { const n = nearestWalkable(P.x, P.y); if (!n) { hooks.toast('Nowhere to land here.', 'dim'); return; } P.x = n.x; P.y = n.y; }
    P.flying = false; sfx('dash'); addPart(P.x, P.y, '#e9dfc7', 8, 30, 0.3); return;
  }
  if (P.stam < 15) { hooks.toast('Your broom needs to rest.', 'dim'); return; }
  if (P.wild > 0) { hooks.toast('You cannot ride in beast form.', 'dim'); return; }
  P.flying = true; sfx('broom'); addPart(P.x, P.y, '#e9dfc7', 10, 40, 0.4);
}
export function broomSpeed(): number {
  const c = companion(); let m = BPART[S.broom.bristle].spd || 1.7;
  if (c) { m *= 1 + famStat(c, 'wing') / 250; if (hasTal(c, 'tailwind')) m *= 1.12; }
  return m;
}
export function broomStamMax(): number { return BPART[S.broom.handle].stam || 100; }

// ---------- time & day ----------
export function advanceTime(dt: number) {
  W.minuteAcc += dt / 0.75;
  while (W.minuteAcc >= 1) { W.minuteAcc -= 1; S.time++; if (S.time % 10 === 0) hooks.hud(); if (S.time === 22 * 60) hooks.toast("It's getting late. Head home to sleep before 2am.", 'dim'); }
  if (S.time >= DAY_END) passOut();
}
function passOut() {
  const lost = W.map.safe ? 0 : Math.min(150, Math.floor(S.gold * 0.1)); S.gold -= lost;
  hooks.say([{ who: '', text: `You collapse from exhaustion.${lost ? ` Someone carries you home… and helps themselves to ${lost} gold.` : ''}` }], () => sleep(true));
}
export interface MorningReport { lines: string[] }
export function sleep(exhausted = false): MorningReport {
  const lines: string[] = [];
  // shipping
  if (S.ship.length) { let g = 0; for (const s of S.ship) g += sellPrice(s.id, s.q) * s.n; S.gold += g; lines.push(`Shipped goods sold for ${g} gold.`); S.ship = []; }
  // crops grow
  for (const k in S.plots) { const p = S.plots[k]; if (p.crop && p.wet) p.age = Math.min(CROP[p.crop].days, p.age + 1); p.wet = false; }
  S.day++; S.time = DAY_START; S.rain = R() < 0.15; S.energy = exhausted ? 60 : 100; S.fondness = 1;
  if (S.rain) { for (const k in S.plots) S.plots[k].wet = true; lines.push('It is raining. The garden is watered.'); }
  // garden familiar
  const gf = jobFam('garden');
  if (gf) { const nur = famStat(gf, 'nurture'); let n = 3 + Math.floor(nur / 8) + (hasTal(gf, 'rainmaker') ? 2 : 0); let watered = 0;
    for (const k in S.plots) { const p = S.plots[k]; if (p.crop) { p.q += nur / 500 + (hasTal(gf, 'greenpaw') ? 0.06 : 0); if (!p.wet && n > 0) { p.wet = true; n--; watered++; } } }
    if (watered) lines.push(`${famName(gf)} watered ${watered} plot${watered > 1 ? 's' : ''}.`); }
  // forage familiar
  const ff = jobFam('forage');
  if (ff) { const ins = famStat(ff, 'instinct'); const n = 1 + Math.floor(ins / 22) + (hasTal(ff, 'packrat') ? 1 : 0); const got: Record<string, number> = {};
    for (let k = 0; k < n; k++) { const rare = R() < ins / 400 + (hasTal(ff, 'truffle') ? 0.12 : 0); const id = rare ? pick(['glowmoss', 'glowmoss', 'starbloom', 'familiardown']) : weighted(FORAGE_TABLE.forest); const q = R() < ins / 150 ? 2 : 1; if (addItem(id, q, 1) === 0) got[id] = (got[id] || 0) + 1; }
    const parts = Object.entries(got).map(([id, n]) => `${n} ${ING[id].name}`); if (parts.length) lines.push(`${famName(ff)} foraged ${parts.join(', ')}.`); }
  // familiars: xp, down, rest
  for (const f of S.fams) {
    if (f.rest > 0) f.rest--;
    if (f.job === 'garden' || f.job === 'forage' || f.job === 'cauldron') giveFamXp(f, 18 + f.lvl * 2); else if (f.job === 'rest') giveFamXp(f, 4);
    if (f.job !== 'companion' && R() < 0.08) { if (addItem('familiardown', 1, 1) === 0) lines.push(`${famName(f)} left some Familiar Down in the roost.`); }
  }
  // egg
  if (S.egg && S.egg.due <= S.day) lines.push(hatchEgg());
  // orders
  if (S.flags.orders) refreshOrders();
  if (exhausted) lines.push('You overslept and feel sluggish (60% energy).');
  ensureForage();
  enterMapAtBed();
  W.P.hp = W.st.maxHp; W.P.mp = W.st.maxMp; W.P.stam = broomStamMax(); W.P.flying = false; W.P.buffs = {};
  saveNow();
  hooks.open('morning', { lines });
  return { lines };
}
function enterMapAtBed() { enterMap('home', 'bed'); }

import { breedChild } from './breed';
function hatchEgg(): string {
  const egg = S.egg!; S.egg = undefined;
  const a = S.fams.find(f => f.uid === egg.a), b = S.fams.find(f => f.uid === egg.b);
  if (!a || !b) return 'The egg did not hatch.';
  const child = breedChild(a, b, egg.tier); S.fams.push(child); S.breeds++; checkQuest();
  return `The egg hatched: a ${SPECIES[child.sp].names[0]}! Visit the roost to meet it.`;
}
export function refreshOrders() {
  if (S.ordersDay === S.day) return; S.ordersDay = S.day;
  const known = Object.keys(S.recipes).filter(p => p !== 'murky'); const pool = Array.from(new Set(['healing', 'healing', 'mana', 'baneflask', ...known]));
  const r = rngFrom(S.day * 77 + 5); S.orders = [];
  for (let k = 0; k < 3; k++) { const potion = pool[Math.floor(r() * pool.length)]; const minTier = 1 + Math.floor(r() * Math.min(3, 1 + S.day / 6)); const n = 1 + Math.floor(r() * 2);
    S.orders.push({ potion, minTier, n, reward: Math.round(POTION[potion].price * n * (0.9 + minTier * 0.45)) }); }
}

// ---------- quests ----------
export function questProgress(): { have: number; need: number; done: boolean } | null {
  const q = QUESTS[S.q.i]; if (!q) return null; const g = q.goal; let have = 0, need = 1;
  switch (g.type) {
    case 'harvest': have = Object.values(S.harvested).reduce((a, b) => a + b, 0) - S.q.base; need = g.n; break;
    case 'kill': have = (S.factionKills[g.faction] || 0) - S.q.base; need = g.n; break;
    case 'brew': have = (S.brewed[g.potion] || 0) - S.q.base; need = g.n; break;
    case 'bind': have = S.binds - S.q.base; need = g.n; break;
    case 'breed': have = S.breeds - S.q.base; need = g.n; break;
    case 'boss': have = S.bosses[g.id] ? 1 : 0; break;
  }
  have = clamp(have, 0, need); return { have, need, done: have >= need };
}
export function questBase(): number {
  const q = QUESTS[S.q.i]; if (!q) return 0; const g = q.goal;
  switch (g.type) { case 'harvest': return Object.values(S.harvested).reduce((a, b) => a + b, 0); case 'kill': return S.factionKills[g.faction] || 0; case 'brew': return S.brewed[g.potion] || 0; case 'bind': return S.binds; case 'breed': return S.breeds; default: return 0; }
}
export function startQuest() { S.q.base = questBase(); S.q.ready = false; const q = QUESTS[S.q.i]; if (q?.onStart) for (const f of q.onStart) S.flags[f + 'Active'] = true; checkQuest(); }
export function checkQuest() { const p = questProgress(); if (p && p.done && !S.q.ready) { S.q.ready = true; hooks.toast(`Quest complete: <b>${QUESTS[S.q.i].title}</b>. Return to Grandmother Wren.`, 'good'); sfx('level'); } hooks.hud(); }

// ---------- main update ----------
export function update(dt: number) {
  const P = W.P; W.clock += dt; S.playTime += dt;
  advanceTime(dt);
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) faintRecover(); updateFxOnly(dt); return; }
  const st = W.st;
  // buffs
  for (const k in P.buffs) { P.buffs[k].t -= dt; if (P.buffs[k].t <= 0) delete P.buffs[k]; }
  if (P.buffs.hot) heal(P.buffs.hot.v * dt);
  // movement
  let ix = W.input.x, iy = W.input.y; const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
  let spd = st.spd * (P.buffs.quick ? 1 + P.buffs.quick.v / 100 : 1) * (P.wild > 0 ? 1.25 : 1);
  const t0 = tileAt(P.x, P.y);
  if (!P.flying && t0 === TL.SHALLOW) spd *= 0.7; if (!P.flying && t0 === TL.BLIGHT) spd *= 0.85;
  if (P.net > 0) { P.net -= dt; spd = 0; }
  if (P.flying) {
    spd *= broomSpeed(); const c = companion(); P.stam -= dt * 7 * (c && hasTal(c, 'featherweight') ? 0.75 : 1);
    if (P.stam <= 0) { P.stam = 0; hooks.toast('Your broom is spent. You glide down.', 'dim'); const n = boxSolid(P.x, P.y, P.hw, P.hh, 'walk') ? nearestWalkable(P.x, P.y) : { x: P.x, y: P.y }; if (n) { P.x = n.x; P.y = n.y; } P.flying = false; }
  } else P.stam = Math.min(broomStamMax(), P.stam + dt * (BPART[S.broom.handle].regen || 8));
  if (P.dashT > 0) { P.dashT -= dt; moveBody(P, P.dashV.x * dt, P.dashV.y * dt, P.air > 0 ? 'fly' : 'walk'); if (P.dashT <= 0 && P.air > 0) { P.air = 0; if (boxSolid(P.x, P.y, P.hw, P.hh, 'walk')) { const n = nearestWalkable(P.x, P.y); if (n) { P.x = n.x; P.y = n.y; } } } }
  else if (il > 0.15 && spd > 0) { moveBody(P, ix * spd * dt, iy * spd * dt, P.flying ? 'fly' : 'walk'); P.fx = ix / Math.hypot(ix, iy); P.fy = iy / Math.hypot(ix, iy); P.walk += dt; }
  else P.walk = 0;
  // timers
  for (let i = 0; i < 3; i++) P.cd[i] = Math.max(0, P.cd[i] - dt * (P.buffs.haste ? 1 + P.buffs.haste.v / 100 : 1));
  P.inv = Math.max(0, P.inv - dt); P.combat = Math.max(0, P.combat - dt); P.ucd = Math.max(0, P.ucd - dt); if (P.wild > 0) { P.wild -= dt; if (P.wild <= 0) { hooks.toast('You return to your own shape.', 'dim'); addPart(P.x, P.y - 8, '#e9dfc7', 14, 40, 0.5); } }
  P.mp = Math.min(st.maxMp, P.mp + dt * (1.4 + st.maxMp * 0.015));
  if (P.combat <= 0) P.hp = Math.min(st.maxHp, P.hp + dt * st.maxHp * 0.012);
  const c = companion(); if (c && c.sp === 'puddlewog') P.hp = Math.min(st.maxHp, P.hp + dt * st.maxHp * (SPECIES.puddlewog.sig.vals[c.stage - 1] / 100));
  // follower
  const fxT = P.x - P.fx * 14, fyT = P.y - P.fy * 8 - 2; W.F.x += (fxT - W.F.x) * Math.min(1, dt * 6); W.F.y += (fyT - W.F.y) * Math.min(1, dt * 6);
  updateCombat(dt);
  updatePickups(dt);
  updateFxOnly(dt);
  // exits
  const t = tileAt(P.x, P.y);
  if (t === TL.EXIT && P.dashT <= 0) {
    const side = P.x < W.map.w * T / 2 ? 'w' : 'e'; const ex = W.map.exits.find(e => e.side === side);
    if (ex) { if (ex.to) enterMap(ex.to, ex.from); else { P.x -= 18; hooks.toast("The King's Road runs on to Saltmarsh. That land isn't open yet.", 'dim'); } }
  }
  if (W.clock - W.lastSave > 20) { W.lastSave = W.clock; saveNow(); }
}
function faintRecover() {
  const P = W.P; const lost = Math.min(150, Math.floor(S.gold * 0.1)); S.gold -= lost;
  P.hp = W.st.maxHp; P.mp = W.st.maxMp; P.inv = 1; P.flying = false; P.buffs = {}; P.net = 0; P.wild = 0;
  S.time = Math.min(DAY_END - 30, S.time + 180); enterMap('home', 'bed');
  hooks.say([{ who: '', text: `You wake in your own bed, bruised. Ysolde's crows must have carried you home${lost ? `. Your purse is ${lost} gold lighter` : ''}. It is ${fmtTime(S.time)}.` }]);
}
function updatePickups(dt: number) {
  const P = W.P;
  for (const p of W.pickups.slice()) {
    p.t += dt; const d = dist(p.x, p.y, P.x, P.y);
    if (d < 40 && p.t > 0.35) { p.x += (P.x - p.x) * dt * 7; p.y += (P.y - p.y) * dt * 7; }
    if (d < 10 && p.t > 0.35) {
      if (p.k === 'gold') { S.gold += p.n; floatText(P.x, P.y - 20, `+${p.n}g`, '#f2c14e'); sfx('coin'); }
      else if (p.k === 'item') { if (addItem(p.id!, p.q || 0, p.n) > 0) { if (p.t > 0.5 && invFull()) { p.t = -2; hooks.toast('Your bag is full.', 'bad'); } continue; } hooks.toast(`+${p.n} ${ITEMS[p.id!].name}`, ''); sfx('pick'); }
      else if (p.k === 'gear' && p.gear) { if (S.bag.length >= 40) { S.gold += Math.round(p.gear.price * 0.4); hooks.toast('Gear bag full. Sold it on the spot.', 'dim'); } else { S.bag.push(p.gear); hooks.toast(`Found <span style="color:${['#cfc6b6', '#7fd1a0', '#f2c14e'][p.gear.rar]}">${p.gear.name}</span> (Lv ${p.gear.lvl})`, ''); sfx('equip'); } }
      W.pickups.splice(W.pickups.indexOf(p), 1); hooks.hud();
    }
  }
}
export function updateFxOnly(dt: number) {
  for (const f of W.fx.slice()) { f.t += dt; if (f.t >= f.d) W.fx.splice(W.fx.indexOf(f), 1); }
  for (const p of W.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.94; if (!p.grav) p.vy *= 0.94; }
  W.parts = W.parts.filter(p => p.life > 0); if (W.parts.length > 600) W.parts.splice(0, W.parts.length - 600);
  for (const f of W.floats) { f.life -= dt; f.y -= dt * 22; } W.floats = W.floats.filter(f => f.life > 0);
  for (const c of W.corpses) c.t -= dt; W.corpses = W.corpses.filter(c => c.t > 0);
  if (W.shakeT > 0) W.shakeT -= dt; else W.shakeA = 0;
}
export { hurtPlayer, countItem, removeItem, newFamiliar, isGrassy, rint };
