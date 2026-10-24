import { T, clamp, dist, pick, rint, R, weighted, rngFrom, fmtTime } from '../core/util';
import {
  S, calcStats, Stats, addItem, removeItem, removeAt, selected, countItem, companion, partyFams, jobFam, famStat, hasTal, giveFamXp, famName,
  DAY_START, DAY_END, saveGame, ForageNode, lifeNeed, craftNeed, newFamiliar, invFull, hasEvo, sigVal, hasFlag, comfort, Familiar,
} from '../core/state';
import { getMap, MapData, Prop, NpcDef, COTTAGE } from './maps';
import { TL, walkSolid, projSolid, isGrassy } from './tiles';
import { CROP, ING, POTION, potionTierVal } from '../data/brewing';
import { ITEMS, sellPrice } from '../data/items';
import { BPART } from '../data/gear';
import { SPECIES, EVO, ELEMENT_INFO } from '../data/familiars';
import { CRAFTS } from '../data/crafts';
import { FURN } from '../data/furniture';
import { sfx } from '../core/audio';
import { castSkill, updateCombat, spawnForMap, Enemy, Proj, Zone, Ally, hurtPlayer, throwPotion, famAbility, stunAround } from './combat';
import { questEvent, updateQuestWorld, refreshBounties, markSeen } from './quests';

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
  roll: number; rollCd: number; rollV: { x: number; y: number }; swapCd: number; potCd: number; potCdMax: number;
  shield: number; shieldT: number; bastion: number; nine: boolean; combo: number; trail: number;
}
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; grav: number }
export interface Float { x: number; y: number; txt: string; col: string; life: number }
export interface Fx { k: string; x: number; y: number; t: number; d: number; R: number; col: string; lt: string; a?: number; tx?: number; ty?: number }
export interface Pickup { k: 'item' | 'gold' | 'gear' | 'mote'; id?: string; q?: number; n: number; gear?: import('../data/gear').Gear; x: number; y: number; t: number }
export interface Corpse { id: string; x: number; y: number; t: number }
export interface Orb { a: number; t: number; dmg: number; x: number; y: number; tgt: Enemy | null; col: string }
export interface Box { x: number; y: number; hw: number; hh: number }
export interface FurnBox extends Box { uid: number; id: string }
export interface Pip { x: number; y: number; hw: number; hh: number; hp: number; max: number; face: number; walk: number; wait: boolean; inv: number }
export interface Defend { wave: number; x: number; y: number; hp: number; max: number; t: number; spawned: boolean }
export interface Deco { on: boolean; hold: { id: string; uid?: number } | null; gx: number; gy: number; ok: boolean; why: string }

export const W = {
  map: null as unknown as MapData, m: new Uint8Array(0) as Uint8Array, v: new Uint8Array(0) as Uint8Array,
  P: null as unknown as Player, F: { x: 0, y: 0, cd: 1, tx: 0, ty: 0, hits: 0, busy: 0 },
  st: null as unknown as Stats,
  enemies: [] as Enemy[], proj: [] as Proj[], zones: [] as Zone[], allies: [] as Ally[], fx: [] as Fx[], parts: [] as Particle[],
  floats: [] as Float[], pickups: [] as Pickup[], corpses: [] as Corpse[], orbs: [] as Orb[], timers: [] as { t: number; fn: () => void }[],
  furn: [] as FurnBox[], famCd: {} as Record<number, number>, famCdMax: {} as Record<number, number>,
  pip: null as Pip | null, defend: null as Defend | null,
  deco: { on: false, hold: null, gx: 0, gy: 0, ok: false, why: '' } as Deco,
  clock: 0, paused: false, shakeT: 0, shakeA: 0, spawnT: 5, wildT: 3, patrolT: 20, banditT: 30, questT: 0,
  aim: { x: 0, y: 0, mouse: false, t: 0 }, input: { x: 0, y: 0 }, minuteAcc: 0, lastSave: 0, flyWarn: 0, bossRef: null as Enemy | null,
};

// ---------- small helpers ----------
export function refresh() { const old = W.st; W.st = calcStats(); const P = W.P; if (P && old) { if (old.maxHp) P.hp = Math.min(W.st.maxHp, P.hp * W.st.maxHp / old.maxHp); P.mp = Math.min(W.st.maxMp, P.mp); } hooks.hud(); }
export function addPart(x: number, y: number, col: string, n = 6, spd = 40, life = 0.5, size = 1, grav = 0) {
  for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, s = spd * (0.4 + R() * 0.8); W.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + R() * 0.6), max: life, col, size, grav }); }
}
export function floatText(x: number, y: number, txt: string | number, col: string) { W.floats.push({ x, y, txt: String(txt), col, life: 0.9 }); }
export function shake(a: number) { W.shakeA = Math.max(W.shakeA, a); W.shakeT = 0.2; }
export function after(t: number, fn: () => void) { W.timers.push({ t, fn }); }
export const isNight = () => S.time >= 19 * 60 || S.time < 5 * 60;
export function darkness(): number {
  const t = S.time; let a = 0; if (t >= 17.5 * 60) a = t < 20 * 60 ? ((t - 17.5 * 60) / 150) * 0.78 : 0.78;
  return W.map && W.map.id === 'cottage' ? a * 0.8 : a;
}
export function lightRadius(): number {
  const L = BPART[S.broom.lantern]; const g = W.P.buffs.glimmer; return (L.light || 26) * W.st.light * (g && g.t > 0 ? 1 + g.v / 100 : 1);
}
export function revealGlimmer(): boolean { const g = W.P.buffs.glimmer; const c = companion(); return !!(BPART[S.broom.lantern].reveal || (g && g.t > 0) || (c && c.sp === 'wisplet')); }

// ---------- tiles & collision ----------
export const tileIdx = (x: number, y: number) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= W.map.w || ty >= W.map.h) return -1; return ty * W.map.w + tx; };
export function tileAt(x: number, y: number): number { const i = tileIdx(x, y); return i < 0 ? TL.STONEWALL : W.m[i]; }
export function setTile(i: number, t: number) { if (W.m[i] === t) return; W.m[i] = t; hooks.tile(i); }
export type Mode = 'walk' | 'proj' | 'fly' | 'enemy';
function solidTile(t: number, mode: Mode) { if (mode === 'fly') return t === TL.VOID || t === TL.WALL_IN; if (mode === 'proj') return projSolid(t); return walkSolid(t); }
export function boxSolid(x: number, y: number, hw: number, hh: number, mode: Mode): boolean {
  const x0 = Math.floor((x - hw) / T), x1 = Math.floor((x + hw) / T), y0 = Math.floor((y - hh) / T), y1 = Math.floor((y + hh) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (tx < 0 || ty < 0 || tx >= W.map.w || ty >= W.map.h) return true; if (solidTile(W.m[ty * W.map.w + tx], mode)) return true; }
  if (mode !== 'proj' && mode !== 'fly') { for (const p of W.map.props) if (Math.abs(x - p.x) < hw + p.hw && Math.abs(y - p.y) < hh + p.hh) return true;
    for (const f of W.furn) if (Math.abs(x - f.x) < hw + f.hw && Math.abs(y - f.y) < hh + f.hh) return true; }
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
    const cx = tx * T + 8, cy = ty * T + 10; const t = W.m[ty * W.map.w + tx]; if (!boxSolid(cx, cy, 4, 3, 'walk') && t !== TL.EXIT && t !== TL.DOOR_IN) return { x: cx, y: cy };
  }
  return null;
}

// ---------- player ----------
export function makePlayer(): Player {
  return { x: 0, y: 0, hw: 4, hh: 3, fx: 0, fy: 1, hp: 1, mp: 1, cd: [0, 0, 0, 0], cdMax: [1, 1, 1, 1], inv: 0, combat: 0, walk: 0, flying: false, stam: 100,
    dashT: 0, dashV: { x: 0, y: 0 }, air: 0, wild: 0, dead: 0, net: 0, buffs: {}, hot: 0, ucd: 0, circle: 0,
    roll: 0, rollCd: 0, rollV: { x: 0, y: 0 }, swapCd: 0, potCd: 0, potCdMax: 1, shield: 0, shieldT: 0, bastion: 0, nine: false, combo: 0, trail: 0 };
}
export function heal(h: number) {
  const P = W.P; if (hasEvo(companion(), 'puddlewog')) h *= 1.3;
  const before = P.hp; P.hp = Math.min(W.st.maxHp, P.hp + h); const d = Math.round(P.hp - before); if (d > 0) floatText(P.x, P.y - 24, '+' + d, '#a8d65a');
}
export function giveXp(x: number) {
  const c = S.crafts[S.craft]!; c.xp += Math.round(x * (S.flags.rested ? 1.1 : 1)); let up = false;
  while (c.lvl < 30 && c.xp >= craftNeed(c.lvl)) { c.xp -= craftNeed(c.lvl); c.lvl++; up = true; }
  if (up) { refresh(); W.P.hp = W.st.maxHp; W.P.mp = W.st.maxMp; hooks.banner('LEVEL UP', `${craftName()} Lv ${c.lvl} · +1 skill point (N)`); sfx('level'); addPart(W.P.x, W.P.y - 8, '#f2c14e', 24, 70, 0.9); }
  hooks.hud();
}
export const craftName = () => CRAFTS[S.craft].name;
export function giveLife(skill: 'garden' | 'forage' | 'brew', x: number) {
  const s = S.life[skill]; s.xp += x; while (s.lvl < 10 && s.xp >= lifeNeed(s.lvl)) { s.xp -= lifeNeed(s.lvl); s.lvl++; hooks.toast(`${{ garden: 'Gardening', forage: 'Foraging', brew: 'Brewing' }[skill]} reached Lv ${s.lvl}.`, 'good'); sfx('level'); }
}
/** Combat XP: the active familiar gets it all, the rest of the party learns by watching (40%). */
export function companionXp(x: number) {
  const c = companion(); if (!c) return;
  for (const f of partyFams()) {
    const before = f.lvl; for (const m of giveFamXp(f, x * S.fondness * (f === c ? 1 : 0.4))) hooks.toast(m, 'good');
    if (f.lvl !== before) { refresh(); const ev = EVO[f.stage]; if (ev && f.lvl >= ev.lvl && before < ev.lvl) hooks.toast(`${famName(f)} can evolve! Open Familiars (F).`, 'good'); }
  }
}

// ---------- party ----------
export function swapFamiliar(to?: number) {
  const P = W.P; const party = partyFams(); if (party.length < 2) { hooks.toast('Only one familiar travels with you. Add more from the Familiars menu (F).', 'dim'); return; }
  const next = to ?? (S.active + 1) % party.length; if (next === S.active) return; const nf = party[next];
  if (P.swapCd > 0 && !hasTal(nf, 'loyal')) { hooks.toast(`Swap ready in ${P.swapCd.toFixed(1)}s.`, 'dim'); return; }
  S.active = next; P.swapCd = 4; refresh(); sfx('buff');
  const el = ELEMENT_INFO[SPECIES[nf.sp].el]; addPart(W.F.x, W.F.y - 6, el.col, 16, 50, 0.5); W.F.x = P.x - P.fx * 12; W.F.y = P.y - 2;
  floatText(P.x, P.y - 30, `${famName(nf)}!`, el.col); hooks.hud();
}
export function famCdLeft(f: Familiar | undefined) { return f ? W.famCd[f.uid] || 0 : 0; }

// ---------- dodge ----------
export function dodge() {
  const P = W.P; if (P.dead > 0 || P.flying || P.roll > 0 || P.rollCd > 0 || P.net > 0 || P.air > 0 || W.deco.on) return;
  let ix = W.input.x, iy = W.input.y; const l = Math.hypot(ix, iy); if (l < 0.15) { ix = P.fx; iy = P.fy; } else { ix /= l; iy /= l; }
  P.roll = 0.3; P.rollV = { x: ix * 205, y: iy * 205 }; P.inv = Math.max(P.inv, 0.3); P.rollCd = 0.8; P.fx = ix; P.fy = iy;
  sfx('dash'); addPart(P.x, P.y, '#e9dfc7', 5, 25, 0.3);
}

// ---------- maps ----------
export function buildFurn() {
  W.furn = [];
  if (W.map.id !== 'cottage') return;
  for (const p of S.home.items) { const d = FURN[p.id]; if (!d || d.kind !== 'floor') continue;
    W.furn.push({ uid: p.uid, id: p.id, x: (p.x + d.w / 2) * T, y: (p.y + d.h / 2) * T + 2, hw: d.w * T / 2 - 2, hh: d.h * T / 2 - 3 }); }
}
function bedSpot(): { x: number; y: number } {
  const b = S.home.items.find(p => p.id === 'bed'); if (!b) return W.map.entries.door;
  for (const [dx, dy] of [[1, 1], [-1, 1], [0, 2], [1, 0], [-1, 0]]) { const x = (b.x + dx) * T + 8, y = (b.y + dy) * T + 10; if (!boxSolid(x, y, 4, 3, 'walk')) return { x, y }; }
  return nearestWalkable(b.x * T + 8, (b.y + 2) * T + 8) || W.map.entries.door;
}
export function enterMap(id: string, from?: string) {
  const map = getMap(id); S.map = id; W.map = map; W.deco.on = false; W.deco.hold = null;
  W.m = map.m.slice(); W.v = map.v;
  if (id === 'home') for (const k in S.plots) { const [x, y] = k.split(',').map(Number); W.m[y * map.w + x] = S.plots[k].wet ? TL.WET : TL.TILLED; }
  if (id === 'forest') {
    const cleanAll = !!S.flags.cleansed; const r = rngFrom(77);
    for (const i of map.blight) { const keep = cleanAll ? r() < 0.15 : true; if (!keep || S.cleansed.includes(i)) W.m[i] = map.m[i] === TL.DEADTREE ? TL.TREE : TL.GRASS; }
  }
  W.enemies = []; W.proj = []; W.zones = []; W.allies = []; W.fx = []; W.parts = []; W.floats = []; W.pickups = []; W.corpses = []; W.orbs = []; W.timers = [];
  W.pip = null; W.defend = null;
  buildFurn();
  const P = W.P; const pos = from === 'bed' && id === 'cottage' ? bedSpot() : from && map.entries[from] ? map.entries[from] : map.entries.door || map.entries.w;
  P.x = pos.x; P.y = pos.y; P.roll = 0; P.dashT = 0; P.air = 0;
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
  for (let k2 = 0; k2 < n; k2++) questEvent({ t: 'harvest', crop: c.id }); hooks.hud(); return true;
}

// ---------- interactions ----------
export function nearProp(): Prop | null { const P = W.P; for (const p of W.map.props) if (Math.abs(p.x - P.x) < p.hw + 14 && Math.abs(p.y - P.y) < p.hh + 16) return p; return null; }
export function nearFurn(): FurnBox | null { const P = W.P; let best: FurnBox | null = null, bd = 1e9; for (const f of W.furn) { const d = Math.max(Math.abs(f.x - P.x) - f.hw, Math.abs(f.y - P.y) - f.hh); if (d < 12 && d < bd && FURN[f.id].use) { bd = d; best = f; } } return best; }
export function activeNpcs(): NpcDef[] { return W.map.npcs.filter(n => !n.flag || S.flags[n.flag]); }
export function nearNpc(): NpcDef | null { for (const n of activeNpcs()) if (dist(n.x, n.y, W.P.x, W.P.y) < 22) return n; return null; }
export function interact() {
  const P = W.P; if (P.dead > 0 || W.deco.on) return;
  if (P.flying) { hooks.toast('Land first (B).', 'dim'); return; }
  const npc = nearNpc(); if (npc) { hooks.open('npc', npc); return; }
  const fb = nearFurn(); if (fb) { const u = FURN[fb.id].use; if (u === 'sleep') hooks.open('sleep'); else if (u === 'chest') hooks.open('chest'); return; }
  const prop = nearProp(); if (prop) { useProp(prop); return; }
  const fp = { x: P.x + P.fx * 8, y: P.y - 2 + P.fy * 8 };
  const node = forageNodes().filter(nodeVisible).find(n => dist(n.x, n.y, fp.x, fp.y) < 14 || dist(n.x, n.y, P.x, P.y) < 12);
  if (node) { pickForage(node); return; }
  const tt = targetTile(); if (harvest(tt.tx, tt.ty)) return;
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (harvest(Math.floor(P.x / T) + dx, Math.floor((P.y - 2) / T) + dy)) return;
  const w = W.enemies.find(e => e.wild && dist(e.x, e.y, P.x, P.y) < 30); if (w) { if (w.dazed > 0) hooks.open('bind', w); else hooks.toast(`${w.def.name} is too lively to bind. Wear it down until it is dazed.`, 'dim'); return; }
  if (W.map.id === 'forest' && S.flags.halloranActive && !S.bosses.halloran) { const h = W.map.regions.hideout; if (dist(P.x, P.y, h.x * T, h.y * T) < 40) { hooks.say([{ who: 'Ysolde', text: 'They are here! Witchfinder Halloran and his wardens. Please, drive them off!' }]); return; } }
}
function useProp(p: Prop) {
  switch (p.kind) {
    case 'door': enterMap('cottage', 'door'); sfx('open'); break;
    case 'cauldron': hooks.open('cauldron'); break;
    case 'roost': hooks.open('roost'); break;
    case 'rack': hooks.open('broom'); break;
    case 'crate': hooks.open('crate'); break;
    case 'board': if (S.flags.orders) hooks.open('board'); else hooks.toast('An empty board. Grandmother Wren will put it to use soon.', 'dim'); break;
    case 'well': hooks.toast('You peer down the well. A frog peers back.', 'dim'); break;
    case 'shrine': hooks.open('shrine', p); break;
    case 'waystone': { if (!S.flags['seen_' + p.id]) { addPart(p.x, p.y - 10, '#bcd4ff', 20, 40, 0.8, 1, -20); markSeen(p.id); }
      else hooks.toast('An old witch-road waystone, still humming.', 'dim'); break; }
  }
}
export function useSelected(aim?: { x: number; y: number }) {
  const P = W.P; if (P.dead > 0 || W.deco.on) return; const st = selected(); if (!st) { castSkill(0, aim); return; }
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
    const p = S.plots[k];
    if (p && !p.wet) { if (!useEnergy(1)) return; p.wet = true; setTile(i, TL.WET); sfx('water'); addPart(tt.tx * T + 8, tt.ty * T + 6, '#a6e4ff', 8, 25, 0.4, 1, 60); hooks.hud(); }
    else if (t === TL.DEEP || t === TL.SHALLOW) hooks.toast('Your can is always full. It is a witch\'s can.', 'dim');
    return;
  }
  if (d.kind === 'seed') {
    const p = S.plots[k]; if (!p) { hooks.toast('Plant in tilled soil. Use the Hoe on your field first.', 'dim'); return; }
    if (p.crop) { hooks.toast('Something is already growing there.', 'dim'); return; }
    p.crop = st.id.slice(5); p.age = 0; p.q = 0; removeAt(S.sel); sfx('plant'); hooks.hud(); return;
  }
  if (d.kind === 'potion') { usePotion(S.sel, aim, tt); return; }
  if (d.kind === 'ingredient') { hooks.toast('Ingredients go in your cauldron, or on a shrine at night.', 'dim'); return; }
  if (st.id.startsWith('charm')) { hooks.toast('Stand beside a dazed wild familiar and press E.', 'dim'); return; }
  if (d.kind === 'essence') { hooks.toast('Essence evolves familiars. Open Familiars (F).', 'dim'); return; }
}
export function usePotion(slot: number, aim?: { x: number; y: number }, tt?: { tx: number; ty: number }) {
  const P = W.P; const st = S.inv[slot]; if (!st) return; const pid = st.id.slice(2); const pd = POTION[pid]; const tier = st.q;
  const herb = S.craft === 'herbal' ? 1.4 : 1; const v = (a: number[]) => potionTierVal(a, tier);
  const T4 = tt ?? targetTile();
  switch (pd.use) {
    case 'drink': {
      if (P.potCd > 0) { hooks.toast(`Your stomach needs a moment (${P.potCd.toFixed(1)}s).`, 'dim'); return; }
      switch (pid) {
        case 'healing': if (P.hp >= W.st.maxHp) { hooks.toast('HP is already full.', 'dim'); return; } heal(W.st.maxHp * v([0.25, 0.4, 0.55, 0.75]) * herb); break;
        case 'mana': P.mp = Math.min(W.st.maxMp, P.mp + W.st.maxMp * v([0.3, 0.5, 0.7, 1]) * herb); floatText(P.x, P.y - 24, '+MP', '#4fb3d9'); break;
        case 'clarity': heal(W.st.maxHp * v([0.2, 0.3, 0.4, 0.55]) * herb); P.mp = Math.min(W.st.maxMp, P.mp + W.st.maxMp * v([0.2, 0.3, 0.4, 0.55]) * herb); break;
        case 'stoneheart': P.buffs.hot = { t: 10, v: W.st.maxHp * v([0.3, 0.45, 0.6, 0.8]) * herb / 10 }; P.buffs.ward = { t: 10, v: 20 }; break;
        case 'quickstep': P.buffs.quick = { t: 120, v: v([15, 25, 35, 50]) * herb }; break;
        case 'wardskin': P.buffs.ward = { t: 90, v: Math.min(70, v([15, 25, 35, 45]) * herb) }; break;
        case 'glimmer': P.buffs.glimmer = { t: 180, v: v([30, 50, 70, 100]) * herb }; break;
        case 'haste': P.buffs.haste = { t: 90, v: Math.min(60, v([15, 22, 30, 40]) * herb) }; break;
        case 'thornmail': P.buffs.thorn = { t: 90, v: v([20, 30, 40, 55]) * herb }; break;
        case 'fondness': S.fondness = Math.max(S.fondness, v([1.5, 2, 2.5, 3])); hooks.toast('Your familiars glow with affection. Bonus XP until you sleep.', 'good'); break;
      }
      P.potCdMax = P.potCd = 8 * (hasFlag('potion_cd') ? 0.6 : 1);
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
  const P = W.P; if (P.dead > 0 || W.deco.on) return;
  if (W.map.id === 'cottage') { hooks.toast('Not indoors!', 'dim'); return; }
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
  let m = BPART[S.broom.bristle].spd || 1.7; const party = partyFams();
  const wing = party.length ? Math.max(...party.map(f => famStat(f, 'wing'))) : 0; m *= 1 + wing / 250;
  if (party.some(f => hasTal(f, 'tailwind'))) m *= 1.12;
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
export function sleep(exhausted = false) {
  const lines: string[] = [];
  if (S.ship.length) { let g = 0; for (const s of S.ship) g += sellPrice(s.id, s.q) * s.n; S.gold += g; lines.push(`Shipped goods sold for ${g} gold.`); S.ship = []; }
  for (const k in S.plots) { const p = S.plots[k]; if (p.crop && p.wet) p.age = Math.min(CROP[p.crop].days, p.age + 1); p.wet = false; }
  S.day++; S.time = DAY_START; S.rain = R() < 0.15; S.fondness = 1;
  const cf = comfort(); S.maxEnergy = 100 + Math.min(50, cf); S.energy = exhausted ? Math.round(S.maxEnergy * 0.6) : S.maxEnergy; S.flags.rested = !exhausted && cf >= 25;
  if (cf > 0) lines.push(`Home comfort ${cf}: ${S.maxEnergy} energy today${S.flags.rested ? ', and you feel well rested (+10% Craft XP)' : ''}.`);
  if (S.rain) { for (const k in S.plots) S.plots[k].wet = true; lines.push('It is raining. The garden is watered.'); }
  const gf = jobFam('garden');
  if (gf) { const nur = famStat(gf, 'nurture'); let n = 3 + Math.floor(nur / 8) + (hasTal(gf, 'rainmaker') ? 2 : 0); let watered = 0;
    for (const k in S.plots) { const p = S.plots[k]; if (p.crop) { p.q += nur / 500 + (hasTal(gf, 'greenpaw') ? 0.06 : 0); if (!p.wet && n > 0) { p.wet = true; n--; watered++; } } }
    if (watered) lines.push(`${famName(gf)} watered ${watered} plot${watered > 1 ? 's' : ''}.`); }
  const ff = jobFam('forage');
  if (ff) { const ins = famStat(ff, 'instinct'); const n = 1 + Math.floor(ins / 22) + (hasTal(ff, 'packrat') ? 1 : 0); const got: Record<string, number> = {};
    for (let k = 0; k < n; k++) { const rare = R() < ins / 400 + (hasTal(ff, 'truffle') ? 0.12 : 0); const id = rare ? pick(['glowmoss', 'glowmoss', 'starbloom', 'familiardown']) : weighted(FORAGE_TABLE.forest); const q = R() < ins / 150 ? 2 : 1; if (addItem(id, q, 1) === 0) got[id] = (got[id] || 0) + 1; }
    const parts = Object.entries(got).map(([id, n]) => `${n} ${ING[id].name}`); if (parts.length) lines.push(`${famName(ff)} foraged ${parts.join(', ')}.`); }
  const cushion = S.home.items.some(p => p.id === 'petbed');
  for (const f of S.fams) {
    if (f.rest > 0) f.rest--;
    if (f.job === 'garden' || f.job === 'forage' || f.job === 'cauldron') giveFamXp(f, 18 + f.lvl * 2); else if (f.job === 'rest') giveFamXp(f, cushion ? 10 + f.lvl : 4);
    if (f.job !== 'party' && R() < 0.08) { if (addItem('familiardown', 1, 1) === 0) lines.push(`${famName(f)} left some Familiar Down in the roost.`); }
  }
  if (S.egg && S.egg.due <= S.day) lines.push(hatchEgg());
  if (S.flags.orders) { refreshOrders(); refreshBounties(); }
  if (exhausted) lines.push('You overslept and feel sluggish.');
  ensureForage();
  enterMap('cottage', 'bed');
  W.P.hp = W.st.maxHp; W.P.mp = W.st.maxMp; W.P.stam = broomStamMax(); W.P.flying = false; W.P.buffs = {}; W.P.nine = false; W.famCd = {};
  saveNow();
  hooks.open('morning', { lines });
}

import { breedChild } from './breed';
function hatchEgg(): string {
  const egg = S.egg!; S.egg = undefined;
  const a = S.fams.find(f => f.uid === egg.a), b = S.fams.find(f => f.uid === egg.b);
  if (!a || !b) return 'The egg did not hatch.';
  const child = breedChild(a, b, egg.tier); S.fams.push(child); S.breeds++; questEvent({ t: 'breed', child });
  return `The egg hatched: a ${SPECIES[child.sp].names[0]}! Visit the roost to meet it.`;
}
export function refreshOrders() {
  if (S.ordersDay === S.day) return; S.ordersDay = S.day;
  const known = Object.keys(S.recipes).filter(p => p !== 'murky'); const pool = Array.from(new Set(['healing', 'healing', 'mana', 'baneflask', ...known]));
  const r = rngFrom(S.day * 77 + 5); S.orders = [];
  for (let k = 0; k < 3; k++) { const potion = pool[Math.floor(r() * pool.length)]; const minTier = 1 + Math.floor(r() * Math.min(3, 1 + S.day / 6)); const n = 1 + Math.floor(r() * 2);
    S.orders.push({ potion, minTier, n, reward: Math.round(POTION[potion].price * n * (0.9 + minTier * 0.45)) }); }
}

// ---------- main update ----------
export function update(dt: number) {
  const P = W.P; W.clock += dt; S.playTime += dt;
  if (W.deco.on) { updateFxOnly(dt); return; }
  advanceTime(dt);
  for (const tm of W.timers.slice()) { tm.t -= dt; if (tm.t <= 0) { W.timers.splice(W.timers.indexOf(tm), 1); tm.fn(); } }
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) faintRecover(); updateFxOnly(dt); return; }
  const st = W.st;
  for (const k in P.buffs) { P.buffs[k].t -= dt; if (P.buffs[k].t <= 0) delete P.buffs[k]; }
  if (P.buffs.hot) heal(P.buffs.hot.v * dt);
  // movement
  let ix = W.input.x, iy = W.input.y; const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
  let spd = st.spd * (P.buffs.quick ? 1 + P.buffs.quick.v / 100 : 1) * (P.wild > 0 ? 1.25 : 1);
  const t0 = tileAt(P.x, P.y);
  if (!P.flying && t0 === TL.SHALLOW) spd *= 0.7; if (!P.flying && t0 === TL.BLIGHT) spd *= 0.85;
  if (P.net > 0) { P.net -= dt; spd = 0; }
  if (P.flying) {
    spd *= broomSpeed(); const party = partyFams(); P.stam -= dt * 7 * (party.some(f => hasTal(f, 'featherweight')) ? 0.75 : 1);
    if (P.stam <= 0) { P.stam = 0; hooks.toast('Your broom is spent. You glide down.', 'dim'); const n = boxSolid(P.x, P.y, P.hw, P.hh, 'walk') ? nearestWalkable(P.x, P.y) : { x: P.x, y: P.y }; if (n) { P.x = n.x; P.y = n.y; } P.flying = false; }
  } else P.stam = Math.min(broomStamMax(), P.stam + dt * (BPART[S.broom.handle].regen || 8));
  if (P.roll > 0) {
    P.roll -= dt; moveBody(P, P.rollV.x * dt, P.rollV.y * dt, 'walk'); P.walk += dt * 2;
    if (P.roll <= 0 && hasEvo(companion(), 'dirtnib')) stunAround(P.x, P.y, 30, 1);
  } else if (P.dashT > 0) { P.dashT -= dt; moveBody(P, P.dashV.x * dt, P.dashV.y * dt, P.air > 0 ? 'fly' : 'walk'); if (P.dashT <= 0 && P.air > 0) { P.air = 0; if (boxSolid(P.x, P.y, P.hw, P.hh, 'walk')) { const n = nearestWalkable(P.x, P.y); if (n) { P.x = n.x; P.y = n.y; } } } }
  else if (il > 0.15 && spd > 0) { moveBody(P, ix * spd * dt, iy * spd * dt, P.flying ? 'fly' : 'walk'); P.fx = ix / Math.hypot(ix, iy); P.fy = iy / Math.hypot(ix, iy); P.walk += dt; }
  else P.walk = 0;
  // timers
  const hz = P.buffs.haste ? 1 + P.buffs.haste.v / 100 : 1;
  for (let i = 0; i < 4; i++) P.cd[i] = Math.max(0, P.cd[i] - dt * hz);
  for (const k in W.famCd) W.famCd[k] = Math.max(0, W.famCd[k] - dt);
  P.inv = Math.max(0, P.inv - dt); P.combat = Math.max(0, P.combat - dt); P.ucd = Math.max(0, P.ucd - dt); P.rollCd = Math.max(0, P.rollCd - dt);
  P.swapCd = Math.max(0, P.swapCd - dt); P.potCd = Math.max(0, P.potCd - dt); P.bastion = Math.max(0, P.bastion - dt);
  if (P.shieldT > 0) { P.shieldT -= dt; if (P.shieldT <= 0) P.shield = 0; }
  if (P.wild > 0) { P.wild -= dt; if (P.wild <= 0) { hooks.toast('You return to your own shape.', 'dim'); addPart(P.x, P.y - 8, '#e9dfc7', 14, 40, 0.5); } }
  P.mp = Math.min(st.maxMp, P.mp + dt * (1.4 + st.maxMp * 0.015));
  if (P.combat <= 0) P.hp = Math.min(st.maxHp, P.hp + dt * st.maxHp * 0.006);
  const c = companion(); if (c && c.sp === 'puddlewog') P.hp = Math.min(st.maxHp, P.hp + dt * st.maxHp * (sigVal(c) / 100));
  // follower
  if (W.F.busy > 0) { W.F.busy -= dt; W.F.x += (W.F.tx - W.F.x) * Math.min(1, dt * 12); W.F.y += (W.F.ty - W.F.y) * Math.min(1, dt * 12); }
  else { const fxT = P.x - P.fx * 14, fyT = P.y - P.fy * 8 - 2; W.F.x += (fxT - W.F.x) * Math.min(1, dt * 6); W.F.y += (fyT - W.F.y) * Math.min(1, dt * 6); }
  updateCombat(dt);
  updatePickups(dt);
  updateFxOnly(dt);
  W.questT -= dt; if (W.questT <= 0) { W.questT = 0.5; updateQuestWorld(); }
  updateQuestEntities(dt);
  // exits & doors
  const t = tileAt(P.x, P.y);
  if (t === TL.EXIT && P.dashT <= 0) {
    const side = P.x < W.map.w * T / 2 ? 'w' : 'e'; const ex = W.map.exits.find(e => e.side === side);
    if (ex) { if (ex.to) enterMap(ex.to, ex.from); else { P.x -= 18; hooks.toast("The King's Road runs on to Saltmarsh. That land isn't open yet.", 'dim'); } return; }
  }
  if (t === TL.DOOR_IN) { enterMap('home', 'door'); sfx('open'); return; }
  if (W.map.id === 'home' && !P.flying && iy < -0.5 && tileAt(P.x, P.y - P.hh - 2) === TL.DOOR) { enterMap('cottage', 'door'); sfx('open'); return; }
  if (W.clock - W.lastSave > 20) { W.lastSave = W.clock; saveNow(); }
}
function updateQuestEntities(dt: number) {
  const pip = W.pip; const P = W.P;
  if (pip) {
    pip.inv = Math.max(0, pip.inv - dt); const d = dist(pip.x, pip.y, P.x, P.y); pip.wait = d > 150;
    if (!pip.wait && d > 22) { const a = Math.atan2(P.y - pip.y, P.x - pip.x); moveBody(pip, Math.cos(a) * 64 * dt, Math.sin(a) * 64 * dt, 'walk'); pip.face = Math.sign(P.x - pip.x) || 1; pip.walk += dt; } else pip.walk = 0;
    if (pip.x < 6 * T) { W.pip = null; questEvent({ t: 'escort' }); hooks.say([{ who: 'Pip', text: 'The road! I can find my way to Hollowmere from here. Thank you, witch!' }]); }
  }
}
export function hurtPip(d: number) { const pip = W.pip; if (!pip || pip.inv > 0) return; pip.hp -= d; pip.inv = 0.5; floatText(pip.x, pip.y - 22, Math.round(d), '#ff9a9a');
  if (pip.hp <= 0) { W.pip = null; addPart(pip.x, pip.y - 8, '#e9dfc7', 14, 40); hooks.toast('Pip panics and flees back to the hideout! Find him there again.', 'bad'); } }
function faintRecover() {
  const P = W.P; const lost = Math.min(150, Math.floor(S.gold * 0.1)); S.gold -= lost;
  P.hp = W.st.maxHp; P.mp = W.st.maxMp; P.inv = 1; P.flying = false; P.buffs = {}; P.net = 0; P.wild = 0;
  S.time = Math.min(DAY_END - 30, S.time + 180); enterMap('cottage', 'bed');
  hooks.say([{ who: '', text: `You wake in your own bed, bruised. Ysolde's crows must have carried you home${lost ? `. Your purse is ${lost} gold lighter` : ''}. It is ${fmtTime(S.time)}.` }]);
}
function updatePickups(dt: number) {
  const P = W.P;
  for (const p of W.pickups.slice()) {
    p.t += dt; const d = dist(p.x, p.y, P.x, P.y);
    if (d < 40 && p.t > 0.35) { p.x += (P.x - p.x) * dt * 7; p.y += (P.y - p.y) * dt * 7; }
    if (p.k === 'mote' && p.t > 8) { W.pickups.splice(W.pickups.indexOf(p), 1); continue; }
    if (d < 10 && p.t > 0.35) {
      if (p.k === 'gold') { S.gold += p.n; floatText(P.x, P.y - 22, `+${p.n}g`, '#f2c14e'); sfx('coin'); }
      else if (p.k === 'mote') { heal(W.st.maxHp * 0.03); P.mp = Math.min(W.st.maxMp, P.mp + W.st.maxMp * 0.03); sfx('pick'); }
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

// ---------- decorating ----------
export function furnFits(id: string, gx: number, gy: number, ignoreUid?: number): string | null {
  const d = FURN[id]; const C = COTTAGE;
  if (d.kind === 'wall') { if (gy !== C.wallY || gx < C.x0 || gx > C.x1) return 'Hang it on the back wall.';
    if (S.home.items.some(p => p.uid !== ignoreUid && FURN[p.id].kind === 'wall' && p.x === gx)) return 'Something already hangs there.'; return null; }
  if (gx < C.x0 || gy < C.y0 || gx + d.w - 1 > C.x1 || gy + d.h - 1 > C.y1) return 'It has to fit on the floor.';
  if (id === 'fireplace' && gy !== C.y0) return 'The hearth must stand against the back wall.';
  for (let y = gy; y < gy + d.h; y++) for (let x = gx; x < gx + d.w; x++) { if (x === C.doorX && y >= C.doorY - 1) return 'Keep the doorway clear.'; }
  for (const p of S.home.items) { if (p.uid === ignoreUid) continue; const o = FURN[p.id]; if (o.kind === 'wall') continue; if ((o.kind === 'rug') !== (d.kind === 'rug')) continue;
    if (gx < p.x + o.w && gx + d.w > p.x && gy < p.y + o.h && gy + d.h > p.y) return 'Something is already there.'; }
  if (d.kind === 'floor') { const P = W.P; if (P.x + P.hw > gx * T && P.x - P.hw < (gx + d.w) * T && P.y + P.hh > gy * T && P.y - P.hh < (gy + d.h) * T) return 'You are standing there.'; }
  return null;
}
export function setDeco(on: boolean) {
  if (on && W.map.id !== 'cottage') { hooks.toast('You can only decorate inside your cottage.', 'dim'); return; }
  W.deco.on = on; W.deco.hold = null; hooks.hud(); if (!on) { buildFurn(); questEvent({ t: 'comfort' }); saveNow(); }
}
export function decoClick(wx: number, wy: number) {
  const D = W.deco; const gx = Math.floor(wx / T), gy = Math.floor(wy / T);
  if (D.hold) {
    const why = furnFits(D.hold.id, gx, gy, D.hold.uid); if (why) { hooks.toast(why, 'dim'); sfx('fail'); return; }
    if (D.hold.uid) { const p = S.home.items.find(x => x.uid === D.hold!.uid); if (p) { p.x = gx; p.y = gy; } }
    else { S.home.items.push({ uid: S.uid++, id: D.hold.id, x: gx, y: gy }); S.home.owned[D.hold.id] = (S.home.owned[D.hold.id] || 0) - 1; }
    sfx('plant'); addPart((gx + 0.5) * T, (gy + 0.5) * T, '#e9dfc7', 10, 30, 0.4); D.hold = null; buildFurn(); questEvent({ t: 'comfort' }); hooks.hud(); return;
  }
  const hit = S.home.items.slice().reverse().find(p => { const d = FURN[p.id]; const h = d.kind === 'wall' ? 1 : d.h; return gx >= p.x && gx < p.x + d.w && gy >= p.y - (d.kind === 'wall' ? 1 : 0) && gy < p.y + h; });
  if (hit) { D.hold = { id: hit.id, uid: hit.uid }; sfx('equip'); hooks.hud(); }
}
export function decoStore() {
  const D = W.deco; if (!D.hold) return;
  if (D.hold.uid) { if (D.hold.id === 'bed') { hooks.toast('Your bed stays. You can move it, though.', 'dim'); return; }
    const i = S.home.items.findIndex(p => p.uid === D.hold!.uid); if (i >= 0) { S.home.items.splice(i, 1); S.home.owned[D.hold.id] = (S.home.owned[D.hold.id] || 0) + 1; } }
  D.hold = null; buildFurn(); questEvent({ t: 'comfort' }); sfx('equip'); hooks.hud();
}

export { hurtPlayer, countItem, removeItem, newFamiliar, isGrassy, rint, famAbility, walkSolid };
