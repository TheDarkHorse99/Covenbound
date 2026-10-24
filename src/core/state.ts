import { CRAFTS, CraftId, RACES, TreeNode } from '../data/crafts';
import { SPECIES, FStat, FSTATS, Job, TALENTS, ELEMENT_INFO, PARTY_MAX, Element } from '../data/familiars';
import { Gear, Slot, SLOTS, makeGear, setGearUid, StatKey, Affix } from '../data/gear';
import { ITEMS } from '../data/items';
import { ING } from '../data/brewing';
import { FURN } from '../data/furniture';
import { R, Rng, rint, pick, clamp } from './util';

export interface Stack { id: string; q: number; n: number }
export interface Familiar { uid: number; sp: string; lvl: number; xp: number; stage: number; pot: Record<FStat, number>; tal: string[]; job: Job; rest: number; nick?: string }
export interface Plot { crop?: string; age: number; wet: boolean; q: number; ready?: boolean; regrow?: boolean }
export interface ForageNode { x: number; y: number; id: string; glimmer: boolean }
export interface PotionOrder { potion: string; minTier: number; n: number; reward: number; done?: boolean }
export interface LevelXp { lvl: number; xp: number }
export interface CraftProg extends LevelXp { nodes: string[]; adv: number }
export interface ActiveQuest { id: string; step: number; prog: number; data?: Record<string, number> }
export interface Placed { uid: number; id: string; x: number; y: number }
export interface GameState {
  v: number; name: string; race: string; skin: string; hair: string; robe: string;
  craft: CraftId; crafts: Partial<Record<CraftId, CraftProg>>;
  life: { garden: LevelXp; forage: LevelXp; brew: LevelXp };
  gold: number; day: number; time: number; energy: number; maxEnergy: number; rain: boolean;
  inv: (Stack | null)[]; sel: number;
  bag: Gear[]; eq: Partial<Record<Slot, Gear>>;
  fams: Familiar[]; famUid: number; party: number[]; active: number; egg?: { a: number; b: number; tier: number; due: number };
  broom: { handle: string; bristle: string; lantern: string; dye: number; owned: string[] };
  plots: Record<string, Plot>;
  map: string; x: number; y: number; hp: number; mp: number;
  known: Record<string, number>; recipes: Record<string, number>;
  quests: ActiveQuest[]; qdone: string[]; track: string | null; bounty: { day: number; list: { tpl: number; id: string; taken: boolean }[] };
  kills: Record<string, number>; factionKills: Record<string, number>; binds: number; breeds: number; bosses: Record<string, number>;
  harvested: Record<string, number>; brewed: Record<string, number>;
  ship: Stack[]; orders: PotionOrder[]; ordersDay: number;
  forage: Record<string, ForageNode[]>; forageDay: number;
  home: { wall: number; floor: number; items: Placed[]; owned: Record<string, number>; chest: (Stack | null)[]; walls: number[]; floors: number[] };
  cleansed: number[]; flags: Record<string, boolean>; fondness: number; uid: number; playTime: number;
}

export let S: GameState = null as unknown as GameState;
export function setState(s: GameState | null) { S = s as GameState; if (s) setGearUid(s.uid); }

export const HOTBAR = 10;
export const INV_SIZE = 30;
export const DAY_START = 6 * 60, DAY_END = 26 * 60;
export const SAVE_VERSION = 3;

export function newGame(o: { name: string; race: string; skin: string; hair: string; robe: string; craft: CraftId; fam: string }): GameState {
  const s: GameState = {
    v: SAVE_VERSION, name: o.name, race: o.race, skin: o.skin, hair: o.hair, robe: o.robe,
    craft: o.craft, crafts: { [o.craft]: { lvl: 1, xp: 0, nodes: [], adv: -1 } },
    life: { garden: { lvl: 1, xp: 0 }, forage: { lvl: 1, xp: 0 }, brew: { lvl: 1, xp: 0 } },
    gold: 80, day: 1, time: DAY_START, energy: 100, maxEnergy: 100, rain: false,
    inv: new Array(INV_SIZE).fill(null), sel: 0,
    bag: [], eq: {},
    fams: [], famUid: 1, party: [], active: 0,
    broom: { handle: 'ash', bristle: 'straw', lantern: 'none', dye: 0, owned: ['ash', 'straw', 'none'] },
    plots: {}, map: 'home', x: 0, y: 0, hp: -1, mp: -1,
    known: {}, recipes: {},
    quests: [], qdone: [], track: null, bounty: { day: 0, list: [] },
    kills: {}, factionKills: {}, binds: 0, breeds: 0, bosses: {}, harvested: {}, brewed: {},
    ship: [], orders: [], ordersDay: 0, forage: {}, forageDay: 0,
    home: { wall: 0, floor: 0, items: [{ uid: 1, id: 'bed', x: 2, y: 3 }, { uid: 2, id: 'chest', x: 9, y: 3 }], owned: {}, chest: new Array(30).fill(null), walls: [0], floors: [0] },
    cleansed: [], flags: {}, fondness: 1, uid: 1000, playTime: 0,
  };
  setState(s);
  s.eq.hat = makeGear('hat', 1, 0, R, null, 'Pointed Hat');
  s.eq.robe = makeGear('robe', 1, 0, R, null);
  s.eq.weapon = makeGear('weapon', 1, 0, R, null, 'Birch Wand');
  s.eq.boots = makeGear('boots', 1, 0, R, null);
  s.inv[0] = { id: 'wand', q: 0, n: 1 };
  s.inv[1] = { id: 'hoe', q: 0, n: 1 };
  s.inv[2] = { id: 'can', q: 0, n: 1 };
  s.inv[3] = { id: 'seed_mandrake', q: 0, n: 6 };
  s.inv[4] = { id: 'seed_bitterleaf', q: 0, n: 4 };
  s.inv[5] = { id: 'p_healing', q: 2, n: 3 };
  s.inv[6] = { id: 'charm', q: 0, n: 2 };
  const starter = newFamiliar(o.fam, R, 'starter'); starter.job = 'party'; s.fams.push(starter); s.party = [starter.uid];
  learn('mandrake'); learn('bitterleaf');
  s.uid = Math.max(s.uid, 1100);
  return s;
}

// ---------- inventory ----------
export function addItem(id: string, q: number, n: number, inv: (Stack | null)[] = S.inv): number {
  if (!ITEMS[id]) return n;
  const stackable = ITEMS[id].stack;
  if (stackable) for (const st of inv) if (st && st.id === id && st.q === q) { st.n += n; onAcquire(id); return 0; }
  for (let i = 0; i < inv.length; i++) if (!inv[i]) { inv[i] = { id, q, n: stackable ? n : 1 }; onAcquire(id); return stackable ? 0 : n - 1; }
  return n;
}
function onAcquire(id: string) { if (ING[id]) learn(id); }
export function learn(id: string) { if (ING[id] && !S.known[id]) S.known[id] = 1; }
export function countItem(id: string, minQ = 0): number { let c = 0; for (const st of S.inv) if (st && st.id === id && st.q >= minQ) c += st.n; return c; }
export function removeItem(id: string, n: number, minQ = 0, exactQ?: number): boolean {
  if (countItem(id, minQ) < n) return false;
  const stacks = S.inv.map((s, i) => ({ s, i })).filter(o => o.s && o.s.id === id && o.s.q >= minQ && (exactQ === undefined || o.s.q === exactQ)).sort((a, b) => a.s!.q - b.s!.q);
  for (const { s, i } of stacks) { const take = Math.min(n, s!.n); s!.n -= take; n -= take; if (s!.n <= 0) S.inv[i] = null; if (n <= 0) break; }
  return n <= 0;
}
export function removeAt(i: number, n = 1) { const st = S.inv[i]; if (!st) return; st.n -= n; if (st.n <= 0) S.inv[i] = null; }
export function selected(): Stack | null { return S.inv[S.sel] ?? null; }
export function invFull(): boolean { return !S.inv.some(s => !s); }

// ---------- familiars ----------
export function newFamiliar(sp: string, r: Rng = R, origin: 'wild' | 'starter' | 'bred' = 'wild', bonus = 0): Familiar {
  const pot = {} as Record<FStat, number>;
  for (const k of FSTATS) {
    let v = origin === 'starter' ? rint(40, 65, r) : rint(20, 70, r) + bonus;
    if (origin === 'wild' && r() < 0.06) v = rint(75, 92, r);
    pot[k] = clamp(v, 5, 100);
  }
  const tal: string[] = [];
  const pool = TALENTS.map(t => t.id);
  const want = origin === 'wild' && r() < 0.5 ? 1 : 2;
  while (tal.length < want) { const t = pick(pool, r); if (!tal.includes(t)) tal.push(t); }
  return { uid: S ? S.famUid++ : 1, sp, lvl: 1, xp: 0, stage: 1, pot, tal, job: 'rest', rest: 0 };
}
export function famStat(f: Familiar, k: FStat): number {
  const cap = SPECIES[f.sp].caps[k];
  return Math.max(1, Math.round(cap * (f.pot[k] / 100) * (0.35 + 0.65 * Math.min(f.lvl, 30) / 30) * (1 + 0.15 * (f.stage - 1))));
}
export const famNeed = (l: number) => Math.floor(14 * Math.pow(l, 1.45));
export const famName = (f: Familiar) => f.nick || SPECIES[f.sp].names[f.stage - 1];
export const hasTal = (f: Familiar | undefined, id: string) => !!f && f.tal.includes(id);
export function partyFams(): Familiar[] { return S.party.map(u => S.fams.find(f => f.uid === u)).filter(Boolean) as Familiar[]; }
export function companion(): Familiar | undefined { const p = partyFams(); if (!p.length) return undefined; if (S.active >= p.length) S.active = 0; return p[S.active]; }
export function companionEl(): Element | undefined { const c = companion(); return c ? SPECIES[c.sp].el : undefined; }
export function jobFam(job: Job): Familiar | undefined { return S.fams.find(f => f.job === job); }
export function sigVal(f: Familiar): number { return SPECIES[f.sp].sig.vals[f.stage - 1]; }
export function hasEvo(f: Familiar | undefined, sp: string): boolean { return !!f && f.sp === sp && f.stage >= 3; }
export function setJob(f: Familiar, j: Job): string | null {
  if (j === 'party') {
    if (S.party.includes(f.uid)) return null;
    if (S.party.length >= PARTY_MAX) return `Your party is full (${PARTY_MAX}). Send one home first.`;
    S.party.push(f.uid); f.job = 'party'; return null;
  }
  if (f.job === 'party') { if (S.party.length <= 1) return 'At least one familiar must travel with you.'; S.party = S.party.filter(u => u !== f.uid); if (S.active >= S.party.length) S.active = 0; }
  if (j !== 'rest') for (const o of S.fams) if (o.job === j && o !== f) o.job = 'rest';
  f.job = j; return null;
}
export function giveFamXp(f: Familiar, x: number): string[] {
  const msgs: string[] = []; if (hasTal(f, 'quickstudy')) x *= 1.3;
  f.xp += Math.round(x);
  while (f.lvl < 30 && f.xp >= famNeed(f.lvl)) { f.xp -= famNeed(f.lvl); f.lvl++; msgs.push(`${famName(f)} reached Lv ${f.lvl}.`); }
  return msgs;
}

// ---------- crafts / levels / trees ----------
export const craftNeed = (l: number) => Math.floor(22 * Math.pow(l, 1.55));
export const lifeNeed = (l: number) => Math.floor(30 * Math.pow(l, 1.4));
export function craftProg(): CraftProg { return S.crafts[S.craft]!; }
export function craftLv(): number { return S.crafts[S.craft]?.lvl ?? 1; }
export function witchLv(): number { return Math.max(...Object.values(S.crafts).map(c => c!.lvl)); }
export function raceDef() { return RACES.find(r => r.id === S.race)!; }
export function treePoints(c: CraftProg = craftProg()): number { return Math.max(0, c.lvl - 1) - c.nodes.length; }
export function activeNodes(): TreeNode[] { const cp = craftProg(); return CRAFTS[S.craft].tree.filter(n => cp.nodes.includes(n.id)); }
export function hasFlag(f: string): boolean { return activeNodes().some(n => n.fx.some(x => x.k === 'flag' && x.f === f)); }
export function skillMod(slot: number): { dmg: number; cd: number; mp: number } {
  const m = { dmg: 0, cd: 0, mp: 0 }; for (const n of activeNodes()) for (const x of n.fx) if (x.k === 'skill' && x.s === slot) { m.dmg += x.dmg || 0; m.cd += x.cd || 0; m.mp += x.mp || 0; } return m;
}
export function unlockedAdv(): number[] { const out: number[] = []; for (const n of activeNodes()) for (const x of n.fx) if (x.k === 'unlock') out.push(x.adv); return out; }
export function canTakeNode(n: TreeNode): string | null {
  const cp = craftProg(); if (cp.nodes.includes(n.id)) return 'Already learned.';
  if (treePoints(cp) <= 0) return 'No skill points. You earn one each level.';
  const lv = [0, 2, 4, 7, 10][n.tier]; if (cp.lvl < lv) return `Requires ${CRAFTS[S.craft].name} Lv ${lv}.`;
  if (n.tier > 1) { const prev = CRAFTS[S.craft].tree.find(o => o.branch === n.branch && o.tier === n.tier - 1)!; if (!cp.nodes.includes(prev.id)) return `Learn ${prev.name} first.`; }
  return null;
}

// ---------- derived stats ----------
export interface Stats {
  maxHp: number; maxMp: number; pow: number; ward: number; spd: number; crit: number; haste: number;
  famMult: number; aff: number; el?: Element; garden: number; forage: number; brew: number; light: number;
}
export function gearSum() {
  const g: Record<StatKey, number> = { pow: 0, ward: 0, vig: 0, mana: 0, haste: 0, crit: 0 };
  const aff: Partial<Record<Affix, number>> = {};
  for (const s of SLOTS) { const it = S.eq[s]; if (!it) continue; for (const k in it.s) g[k as StatKey] += it.s[k as StatKey] || 0; if (it.aff) aff[it.aff] = (aff[it.aff] || 0) + (it.affV || 0); }
  return { g, aff };
}
export function calcStats(): Stats {
  const race = raceDef(), L = craftLv(), cd = CRAFTS[S.craft]; const { g, aff } = gearSum(); const c = companion();
  const tree = { hp: 0, pow: 0, crit: 0, ward: 0, spd: 0, mana: 0 };
  for (const n of activeNodes()) for (const x of n.fx) if (x.k === 'stat') { tree.hp += x.hp || 0; tree.pow += x.pow || 0; tree.crit += x.crit || 0; tree.ward += x.ward || 0; tree.spd += x.spd || 0; tree.mana += x.mana || 0; }
  const st: Stats = {
    maxHp: Math.round((60 + L * 12 + g.vig) * race.hp * cd.hpMul * (1 + tree.hp)), maxMp: Math.round((40 + L * 5 + g.mana) * race.mp * (1 + tree.mana)),
    pow: (8 + L * 2.2 + g.pow) * race.pow * (1 + tree.pow), ward: L * 0.8 + g.ward + tree.ward, spd: 74 * race.spd * (1 + g.haste * 0.003) * (1 + tree.spd), crit: 0.05 + g.crit / 100 + tree.crit,
    haste: g.haste, famMult: 1, aff: 0, garden: aff.garden || 0, forage: aff.forage || 0, brew: aff.brew || 0, light: 1,
  };
  if (c) {
    const sp = SPECIES[c.sp]; st.el = sp.el;
    const might = famStat(c, 'might') * (S.craft === 'shape' ? 2 : 1);
    st.famMult = 1 + might / 220 + (hasTal(c, 'fierce') ? 0.15 : 0);
    st.aff = (aff as Record<string, number>)[sp.el] || 0;
    if (sp.el === 'stone') st.ward += 4 + c.stage * 2;
    if (sp.el === 'gale') { st.crit += 0.08; st.spd *= 1.08; }
    if (c.sp === 'fluffowl') st.crit += sigVal(c) / 100;
    if (c.sp === 'wisplet') st.light *= 1 + sigVal(c) / 100;
    if (hasEvo(c, 'wickmoth')) st.light *= 1.5;
    if (hasTal(c, 'thickhide')) st.ward += 8;
    if (hasTal(c, 'brighteyes')) st.light *= 1.25;
  }
  return st;
}
export function elementName(el?: string) { return el ? ELEMENT_INFO[el as Element].name : 'None'; }

// ---------- home ----------
export function comfort(): number {
  const seen = new Set<string>(); let c = 0;
  for (const p of S.home.items) { const d = FURN[p.id]; if (!d) continue; c += seen.has(p.id) ? Math.ceil(d.comfort / 2) : d.comfort; seen.add(p.id); }
  return c + (S.home.wall ? 3 : 0) + (S.home.floor ? 3 : 0);
}

// ---------- save ----------
const SAVE_KEY = 'covenbound-save-v3';
export function saveGame(extra?: { x: number; y: number; hp: number; mp: number }) {
  if (!S) return; if (extra) Object.assign(S, extra);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* storage unavailable */ }
}
export function readSave(): GameState | null {
  try { const t = localStorage.getItem(SAVE_KEY); if (!t) return null; const s = JSON.parse(t) as GameState; return s && s.v === SAVE_VERSION ? s : null; } catch { return null; }
}
export function hasOldSave(): boolean { try { return !!localStorage.getItem('covenbound-save-v2'); } catch { return false; } }
export function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
export function snapshot(): GameState | null { return S ? JSON.parse(JSON.stringify(S)) : null; }
export { clamp };
