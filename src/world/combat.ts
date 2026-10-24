import { T, R, clamp, dist, pick, rint, rngFrom } from '../core/util';
import { S, companion, famStat, hasTal, sigVal, newFamiliar, famName, hasEvo, hasFlag, skillMod, unlockedAdv, craftProg, companionEl } from '../core/state';
import { ENEMIES, EnemyDef, CORRUPT_SPAWNS } from '../data/enemies';
import { CRAFTS, SkillDef } from '../data/crafts';
import { SPECIES, ELEMENT_INFO, ELEMENTS, effMult, Element } from '../data/familiars';
import { POTION, potionTierVal } from '../data/brewing';
import { makeGear, SLOTS } from '../data/gear';
import { sfx } from '../core/audio';
import { TL } from './tiles';
import type { Dir } from '../art/chars16';
import {
  W, hooks, addPart, floatText, shake, moveBody, boxSolid, tileAt, giveXp, companionXp, heal, setTile, isNight, refresh, nearestWalkable, after, hurtPip,
} from './world';
import { questEvent, hurtShrine } from './quests';

export interface Enemy {
  uid: number; id: string; def: EnemyDef; x: number; y: number; hp: number; max: number; hw: number; hh: number; r: number; sc: number;
  face: number; dir: Dir; walk: number; aggro: boolean; home: { x: number; y: number }; wdir: { x: number; y: number }; wt: number; atk: number; cd: number;
  slow: number; burn: { t: number; tick: number; dps: number } | null; bleed: { t: number; tick: number; dps: number } | null; stun: number; root: number; flash: number; marks: number; markT: number;
  wild?: boolean; sp?: string; bonus?: number; dazed: number; hurtT: number; tag?: string;
  tele: number; teleMax: number; teleA: number; teleK: string; dash: number; dashA: number; hitOnce: boolean;
  phase: number; patt: number; summoned: number; net: number; elite: boolean; dmg: number;
  shield: number; shieldMax: number; exposed: number; curse: number; fear: number; expose: number; shown: number;
}
export interface Proj {
  x: number; y: number; vx: number; vy: number; r: number; own: 'p' | 'e' | 'f'; mult: number; dmg: number; life: number; pierce: number;
  col: string; lt: string; hits: Set<Enemy>; mark?: boolean; kind?: 'net' | 'lob' | 'bolt'; tx?: number; ty?: number; sx?: number; sy?: number; t?: number; T?: number; pid?: string; tier?: number; z?: number;
  el?: Element; split?: boolean; fire?: boolean;
}
export type ZoneK = 'sigil' | 'cloud' | 'circle' | 'spike' | 'blast' | 'fire' | 'ward' | 'delay' | 'lantern';
export interface Zone { k: ZoneK; x: number; y: number; r: number; t: number; arm: number; armMax: number; dps: number; mult: number; tick: number; own: 'p' | 'e'; col: string; root?: number; stun?: number; marks?: number; cloud?: boolean; dmg?: number; el?: Element }
export interface Ally { k: 'minion' | 'thrall' | 'snapvine' | 'poppet' | 'decoy'; id?: string; x: number; y: number; hw: number; hh: number; hp: number; max: number; t: number; cd: number; dmg: number; face: number; tick: number }

let uid = 1;
const st = () => W.st;

// ---------- spawning ----------
function mkEnemy(id: string, x: number, y: number, def?: EnemyDef): Enemy {
  const d = def || ENEMIES[id]; const sc = d.scale || 1;
  const e: Enemy = { uid: uid++, id, def: d, x, y, hp: d.hp, max: d.hp, hw: sc > 1 ? 10 : 5, hh: sc > 1 ? 6 : 4, r: sc > 1 ? 13 : 7, sc, face: 1, dir: 'down', walk: 0, aggro: false, home: { x, y }, wdir: { x: 0, y: 0 }, wt: R() * 2,
    atk: 0.5, cd: 1 + R() * 2, slow: 0, burn: null, bleed: null, stun: 0, root: 0, flash: 0, marks: 0, markT: 0, dazed: 0, hurtT: 0,
    tele: 0, teleMax: 1, teleA: 0, teleK: '', dash: 0, dashA: 0, hitOnce: false, phase: 1, patt: 0, summoned: 0, net: 6, elite: false, dmg: d.dmg,
    shield: 0, shieldMax: 0, exposed: 0, curse: 0, fear: 0, expose: 0, shown: 0 };
  if (d.ai.startsWith('boss_')) { e.shieldMax = e.shield = Math.round(d.hp * 0.22); }
  return e;
}
export function spawnEnemy(id: string, x: number, y: number, tag?: string): Enemy { const e = mkEnemy(id, x, y); e.tag = tag; W.enemies.push(e); return e; }
function makeElite(e: Enemy) { e.elite = true; e.max = e.hp = Math.round(e.def.hp * 2.6); e.dmg = Math.round(e.def.dmg * 1.4); }
function randomOpen(minDist: number, filter?: (i: number) => boolean): { x: number; y: number } | null {
  const m = W.map; for (let k = 0; k < 200; k++) { const i = m.open[Math.floor(R() * m.open.length)]; if (filter && !filter(i)) continue; const x = (i % m.w) * T + 8, y = ((i / m.w) | 0) * T + 8;
    if (dist(x, y, W.P.x, W.P.y) < minDist) continue; if (m.entries.w && dist(x, y, m.entries.w.x, m.entries.w.y) < 8 * T) continue; if (boxSolid(x, y, 5, 4, 'walk')) continue; return { x, y }; } return null;
}
function nearBlight(i: number): boolean { const m = W.map; const x = i % m.w, y = (i / m.w) | 0; for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) { const j = (y + dy) * m.w + x + dx; if (W.m[j] === TL.BLIGHT) return true; } return false; }
function spawnCorrupt(initial: boolean) {
  const blightLeft = !S.flags.cleansed; const p = randomOpen(initial ? 9 * T : 13 * T, i => !blightLeft || R() < 0.25 || nearBlight(i)); if (!p) return;
  let id = pick(CORRUPT_SPAWNS); if (id === 'rotcrow' && !isNight() && R() < 0.5) id = 'thornrat'; if (isNight() && R() < 0.2) id = 'hollowwisp';
  const e = spawnEnemy(id, p.x, p.y, 'corrupt');
  if (!W.enemies.some(o => o.elite && o.tag === 'corrupt') && R() < (initial ? 0.08 : 0.04)) makeElite(e);
}
const WILD_DAY = ['sparkit', 'fluffowl', 'dirtnib', 'pebbleshell', 'puddlewog'];
const WILD_NIGHT = ['wickmoth', 'wickmoth', 'fluffowl', 'sparkit', 'flitbat'];
export function spawnWild(sp?: string, at?: { x: number; y: number }, lured = false): Enemy | null {
  const s = sp || pick(isNight() ? WILD_NIGHT : WILD_DAY); const nearPond = s === 'puddlewog';
  let p: { x: number; y: number } | null = at || null;
  if (!p && nearPond) { const g = W.map.regions[R() < 0.5 ? 'pond1' : 'pond2']; for (let k = 0; k < 40 && !p; k++) { const a = R() * Math.PI * 2, rr = (g.r + 1 + R() * 2) * T; const x = g.x * T + 8 + Math.cos(a) * rr, y = g.y * T + 8 + Math.sin(a) * rr; if (!boxSolid(x, y, 5, 4, 'walk')) p = { x, y }; } }
  if (!p) p = randomOpen(12 * T); if (!p) return null;
  const sd = SPECIES[s]; const hp = 60 + sd.rarity * 35;
  const d: EnemyDef = { id: 'wild', name: 'Wild ' + sd.names[0], faction: 'wild', el: sd.el, hp, dmg: 6 + sd.rarity * 3, spd: 46, xp: 0, gold: [0, 0], ai: 'melee', lvl: sd.rarity * 2, drops: [], fly: sd.fly, reach: 16, windup: 0.5 - sd.rarity * 0.05, rate: 1.4 };
  const e = mkEnemy('wild', p.x, p.y, d); e.wild = true; e.sp = s; e.bonus = lured ? 8 : 0; W.enemies.push(e); return e;
}
function spawnPatrol() {
  const m = W.map; const x0 = rint(20, m.w - 12); let y0 = m.mid; for (let k = 0; k < 8; k++) { if (!boxSolid(x0 * T + 8, (m.mid + k) * T + 8, 5, 4, 'walk')) { y0 = m.mid + k; break; } if (!boxSolid(x0 * T + 8, (m.mid - k) * T + 8, 5, 4, 'walk')) { y0 = m.mid - k; break; } }
  const x = x0 * T + 8, y = y0 * T + 8; if (dist(x, y, W.P.x, W.P.y) < 12 * T) return;
  spawnEnemy('warden', x, y, 'patrol'); spawnEnemy('novice', x - 14, y + 6, 'patrol'); if (R() < 0.5) spawnEnemy('novice', x + 14, y - 6, 'patrol');
}
export function spawnForMap() {
  if (W.map.safe) return; const m = W.map;
  const count = S.flags.cleansed ? 6 : 14; for (let k = 0; k < count; k++) spawnCorrupt(true);
  const camp = m.regions.camp; const cx = camp.x * T + 8, cy = camp.y * T + 8;
  for (let k = 0; k < 3; k++) spawnEnemy('roadcutter', cx + rint(-40, 40), cy + rint(-30, 30), 'camp');
  for (let k = 0; k < 2; k++) spawnEnemy('slinger', cx + rint(-40, 40), cy + rint(-30, 30), 'camp');
  if (!S.bosses.mags) spawnEnemy('mags', cx, cy - 20, 'camp');
  if (S.flags.halloranActive && !S.bosses.halloran) { const h = m.regions.hideout; const hx = h.x * T + 8, hy = h.y * T + 8; spawnEnemy('halloran', hx + 30, hy - 10, 'hunt'); spawnEnemy('warden', hx + 10, hy + 20, 'hunt'); spawnEnemy('warden', hx - 20, hy + 16, 'hunt'); spawnEnemy('novice', hx + 40, hy + 12, 'hunt'); }
  if (!S.bosses.rootmaw) { const h = m.regions.hollow; const e = spawnEnemy('rootmaw', h.x * T + 8, h.y * T + 8, 'boss'); e.home = { x: e.x, y: e.y }; }
  for (const e of W.enemies) if (boxSolid(e.x, e.y, e.hw, e.hh, 'walk')) { const n = nearestWalkable(e.x, e.y); if (n) { e.x = n.x; e.y = n.y; e.home = { ...n }; } }
  if (!isNight()) spawnPatrol();
  spawnWild(); spawnWild();
}

// ---------- casting ----------
export function aimVec(aim?: { x: number; y: number }) {
  const P = W.P; let tx: number, ty: number;
  if (aim) { tx = aim.x; ty = aim.y; } else if (W.aim.mouse && W.clock - W.aim.t < 4) { tx = W.aim.x; ty = W.aim.y; } else { tx = P.x + P.fx * 60; ty = P.y - 7 + P.fy * 60; }
  const dx = tx - P.x, dy = ty - (P.y - 7); const l = Math.hypot(dx, dy) || 1; return { dx: dx / l, dy: dy / l, tx, ty, d: l };
}
/** Skill in a hotkey slot: 0–2 are the Craft's core skills, 3 is the advanced skill you slotted from the tree. */
export function skillFor(slot: number): SkillDef | null {
  const cd = CRAFTS[S.craft]; if (slot < 3) return cd.skills[slot];
  const a = craftProg().adv; return a >= 0 && unlockedAdv().includes(a) ? cd.adv[a] : null;
}
const markCap = () => hasFlag('mark7') ? 7 : 5;
function fireProj(ox: number, oy: number, ang: number, ab: SkillDef, mult: number, extra: Partial<Proj> = {}) {
  const cd = CRAFTS[S.craft]; const el = st().el;
  W.proj.push({ x: ox + Math.cos(ang) * 6, y: oy + Math.sin(ang) * 6, vx: Math.cos(ang) * ab.spd!, vy: Math.sin(ang) * ab.spd!, r: ab.r!, own: 'p', mult, dmg: 0, life: ab.pierce && ab.pierce > 3 ? 1.1 : 0.9, pierce: ab.pierce || 0,
    col: el ? ELEMENT_INFO[el].col : cd.col, lt: cd.light, hits: new Set(), mark: ab.mark, ...extra });
}
export function castSkill(slot: number, aim?: { x: number; y: number }) {
  const P = W.P; if (P.dead > 0 || P.air > 0 || P.roll > 0 || W.deco.on) return;
  if (W.map.id === 'cottage') { if (W.clock - W.flyWarn > 3) { W.flyWarn = W.clock; hooks.toast('Not indoors! You would singe the curtains.', 'dim'); } return; }
  if (P.flying) { if (W.clock - W.flyWarn > 2) { W.flyWarn = W.clock; hooks.toast('You cannot cast while flying. Land with B.', 'dim'); } return; }
  const cd = CRAFTS[S.craft]; const lvl = craftProg().lvl; let ab = skillFor(slot);
  if (!ab) { hooks.toast('Learn an advanced skill in your Craft tree (N), then slot it on U.', 'dim'); return; }
  if (P.wild > 0 && slot === 0) ab = { ...cd.skills[0], name: 'Bite', mult: 1.6, rad: 30, kind: 'melee' };
  if (slot < 3 && lvl < ab.lvl) { hooks.toast(`${ab.name} unlocks at ${cd.name} Lv ${ab.lvl}.`, 'dim'); return; }
  const mod = slot < 3 ? skillMod(slot) : { dmg: 0, cd: 0, mp: 0 };
  const mp = P.wild > 0 && hasFlag('apex') ? 0 : Math.round(ab.mp * (1 - mod.mp));
  if (P.cd[slot] > 0) return; if (P.mp < mp) { hooks.toast('Not enough MP.', 'dim'); return; }
  P.mp -= mp; P.cd[slot] = ab.cd * (1 - mod.cd) * (1 - Math.min(0.35, st().haste * 0.005)); P.cdMax[slot] = P.cd[slot];
  const a = aimVec(aim); P.fx = a.dx; P.fy = a.dy; const ox = P.x, oy = P.y - 7; const mult = ab.mult * (1 + mod.dmg);
  const el = st().el ? ELEMENT_INFO[st().el!] : null; const col = el ? el.col : cd.col, lt = cd.light;
  const clampTo = (range: number) => { const d = Math.min(a.d, range); return { x: ox + a.dx * d, y: oy + a.dy * d + 7 }; };
  const ang = Math.atan2(a.dy, a.dx);
  switch (ab.kind) {
    case 'proj': {
      const pierce = (ab.pierce || 0) + (S.craft === 'poppet' && slot === 0 && hasFlag('pin_pierce') ? 1 : 0);
      const split = S.craft === 'necro' && slot === 0 && hasFlag('shard_split');
      if (S.craft === 'sigil' && slot === 0 && hasFlag('twin_bolt')) { fireProj(ox, oy, ang - 0.1, ab, mult, { pierce }); fireProj(ox, oy, ang + 0.1, ab, mult, { pierce }); }
      else fireProj(ox, oy, ang, ab, mult, { pierce, split });
      sfx('shoot'); break; }
    case 'fan': for (let k = 0; k < ab.n!; k++) fireProj(ox, oy, ang + (k - (ab.n! - 1) / 2) * 0.22, ab, mult); sfx('shoot'); break;
    case 'melee': {
      let m = mult; if (S.craft === 'shape' && slot === 0 && hasFlag('claw_combo')) { P.combo++; if (P.combo % 3 === 0) { m *= 2; floatText(P.x, P.y - 28, 'Combo!', '#ffd166'); } }
      const rad = ab.rad! * (S.craft === 'herbal' && slot === 0 && hasFlag('long_lash') ? 1.3 : 1);
      meleeArc(ox, oy + 2, ang, rad, m, P.wild > 0 && el ? el.col : cd.col, lt, S.craft === 'herbal' ? 34 : 18, S.craft === 'herbal' && slot === 0 && hasFlag('lash_bleed'));
      sfx('thud'); break; }
    case 'multi': for (let k = 0; k < ab.n!; k++) after(k * 0.11, () => { const a2 = aimVec(aim); meleeArc(W.P.x, W.P.y - 5, Math.atan2(a2.dy, a2.dx) + (k % 2 ? 0.3 : -0.3), ab!.rad!, mult, cd.col, lt, 8, false); sfx('thud'); }); break;
    case 'sigil': { const p = clampTo(ab.range!); const mine = W.zones.filter(z => z.k === 'sigil'); if (mine.length >= (hasFlag('sigil5') ? 5 : 3)) W.zones.splice(W.zones.indexOf(mine[0]), 1);
      W.zones.push(zone('sigil', p.x, p.y, ab.rad!, 20 + lvl, { arm: 0.4, mult, root: (ab.root || 1.5) + (hasFlag('snare_root') ? 0.8 : 0), col: cd.col })); sfx('buff'); break; }
    case 'circle': { const dur = ab.dur! + (hasFlag('grand_ward') ? 2 : 0); W.zones.push(zone('circle', P.x, P.y, ab.rad!, dur, { mult, col: cd.col })); P.circle = dur; sfx('buff'); break; }
    case 'wardzone': W.zones.push(zone('ward', P.x, P.y - 4, ab.rad!, ab.dur!, { col: cd.light })); sfx('buff'); break;
    case 'delayaoe': { const p = clampTo(ab.range!); W.zones.push(zone('delay', p.x, p.y, ab.rad!, ab.delay! + 0.05, { arm: ab.delay!, mult, root: ab.root, marks: ab.mark ? 2 : 0, cloud: S.craft === 'herbal', col: cd.col })); sfx('whoosh'); break; }
    case 'pull': { const p = clampTo(ab.range!); let n = 0; for (const e of W.enemies.slice()) { if (e.marks <= 0 || dist(e.x, e.y, P.x, P.y) > ab.range! * 1.4 || e.def.boss) continue; const d = dist(e.x, e.y, p.x, p.y); const k = Math.min(1, 60 / (d || 1));
        moveBody(e, (p.x - e.x) * k, (p.y - e.y) * k, e.def.fly ? 'fly' : 'enemy'); hitEnemy(e, mult, { col: '#ffc8d8', stun: 0.6 }); W.fx.push({ k: 'line', x: p.x, y: p.y - 6, tx: e.x, ty: e.y - 6, t: 0, d: 0.3, R: 0, col: '#ffc8d8', lt }); n++; }
      if (!n) hooks.toast('No Marked enemies to pull.', 'dim'); sfx('whoosh'); break; }
    case 'curse': { const p = clampTo(ab.range!); let best: Enemy | null = null, bd = 60; for (const e of W.enemies) { if (e.wild) continue; const d = dist(e.x, e.y, p.x, p.y); if (d < bd) { bd = d; best = e; } }
      if (best) { best.curse = ab.dur!; W.fx.push({ k: 'sigil', x: best.x, y: best.y - 10, t: 0, d: 0.6, R: 0, col: '#d06a8a', lt }); floatText(best.x, best.y - 22, 'Hexed', '#ffc8d8'); sfx('buff'); } else hooks.toast('No enemy near the cursor.', 'dim'); break; }
    case 'nova': W.fx.push({ k: 'ring', x: P.x, y: P.y - 4, R: ab.rad!, t: 0, d: 0.3, col, lt }); forEnemiesIn(P.x, P.y - 4, ab.rad!, e => hitEnemy(e, mult, { kb: 30, from: P, col: lt, stun: ab!.stun })); shake(3); sfx('boom'); break;
    case 'heal': heal(st().maxHp * ab.mult); P.buffs.hot = { t: ab.dur!, v: st().maxHp * 0.02 }; addPart(P.x, P.y - 8, '#c8f0a0', 24, 40, 0.8, 1, -30); sfx('heal'); break;
    case 'corpseboom': { const p = clampTo(ab.range!); const cs = W.corpses.filter(c => dist(c.x, c.y, p.x, p.y) < ab!.rad! * 1.5); if (!cs.length) { hooks.toast('No corpses near the cursor.', 'dim'); P.mp += mp; P.cd[slot] = 0; return; }
      for (const c of cs) { W.corpses.splice(W.corpses.indexOf(c), 1); W.fx.push({ k: 'ring', x: c.x, y: c.y - 4, R: ab.rad!, t: 0, d: 0.3, col: '#8a7ad0', lt }); addPart(c.x, c.y - 4, '#d8d0ff', 14, 60, 0.5); forEnemiesIn(c.x, c.y - 4, ab.rad!, e => hitEnemy(e, mult, { kb: 20, from: c, col: lt })); }
      shake(4); sfx('boom'); break; }
    case 'drain': { const list = W.enemies.filter(e => !e.wild && dist(e.x, e.y, P.x, P.y) < ab!.range!).sort((x, y) => dist(x.x, x.y, P.x, P.y) - dist(y.x, y.y, P.x, P.y)).slice(0, ab.n!);
      let tot = 0; for (const e of list) { tot += hitEnemy(e, mult, { col: '#d8d0ff' }); W.fx.push({ k: 'line', x: P.x, y: P.y - 10, tx: e.x, ty: e.y - 6, t: 0, d: 0.35, R: 0, col: '#8a7ad0', lt }); }
      if (tot) heal(tot * 0.5); else hooks.toast('Nothing nearby to drain.', 'dim'); sfx('heal'); break; }
    case 'poppet': { const p = clampTo(ab.range!); const old = W.allies.find(x => x.k === 'poppet'); if (old) killAlly(old);
      const hp = st().maxHp * 0.45 * (hasFlag('poppet_hp') ? 1.5 : 1); W.allies.push({ k: 'poppet', x: p.x, y: p.y, hw: 5, hh: 4, hp, max: hp, t: ab.dur!, cd: 0, dmg: mult, face: 1, tick: 0 }); addPart(p.x, p.y - 6, '#f2c14e', 10, 40); sfx('plant'); break; }
    case 'thread': { let n = 0; for (const e of W.enemies.slice()) { if (e.marks > 0 && onScreen(e)) { const m = e.marks; e.marks = 0; n += m; hitEnemy(e, mult * m, { col: '#ffc8d8', stun: ab.stun, noMark: true }); W.fx.push({ k: 'line', x: P.x, y: P.y - 8, tx: e.x, ty: e.y - 6, t: 0, d: 0.25, R: 0, col: '#ffc8d8', lt }); } }
      if (!n) hooks.toast('No Marked enemies. Hit them with Pins first.', 'dim'); else if (hasFlag('thread_refund')) P.mp = Math.min(st().maxMp, P.mp + n * 2); sfx('boom'); break; }
    case 'flask': { const p = clampTo(ab.range!); const lob = (tx: number, ty: number) => W.proj.push({ x: ox, y: oy, vx: 0, vy: 0, r: 3, own: 'p', mult, dmg: 0, life: 9, pierce: 0, col: '#8fd14f', lt: '#d8ffb0', hits: new Set(), kind: 'lob', tx, ty, sx: ox, sy: oy, t: 0, T: 0.5, z: 0 });
      lob(p.x, p.y - 4); if (hasFlag('flask_twin')) lob(p.x + rint(-26, 26), p.y - 4 + rint(-18, 18)); sfx('whoosh'); break; }
    case 'snapvine': { const p = clampTo(ab.range!); const n = hasFlag('snap_two') ? 2 : 1; const dur = ab.dur! + (hasFlag('snap_long') ? 5 : 0);
      for (const o of W.allies.filter(x => x.k === 'snapvine')) W.allies.splice(W.allies.indexOf(o), 1);
      for (let k = 0; k < n; k++) { const x = p.x + (n > 1 ? (k ? 14 : -14) : 0); W.allies.push({ k: 'snapvine', x, y: p.y, hw: 5, hh: 4, hp: 999, max: 999, t: dur, cd: 0.3, dmg: mult, face: 1, tick: 0 }); addPart(x, p.y, '#6ac04a', 16, 50, 0.5, 1, 40); }
      sfx('plant'); break; }
    case 'pounce': { const p = clampTo(ab.range!); const dx = p.x - P.x, dy = p.y - P.y; P.air = 0.28; P.dashT = 0.28; P.dashV = { x: dx / 0.28, y: dy / 0.28 }; P.inv = Math.max(P.inv, 0.35);
      const rad = ab.rad!; const ab2 = ab; after(0.28, () => { const before = W.enemies.length; forEnemiesIn(W.P.x, W.P.y - 4, rad, e => hitEnemy(e, mult, { kb: 24, from: W.P, col: lt, stun: ab2.id === 'a3' ? 0.8 : 0 })); W.fx.push({ k: 'ring', x: W.P.x, y: W.P.y - 2, R: rad, t: 0, d: 0.25, col, lt }); shake(ab2.id === 'a3' ? 5 : 3); sfx('thud');
        if (slot === 1 && hasFlag('pounce_reset') && W.enemies.length < before) { W.P.cd[1] = 0; floatText(W.P.x, W.P.y - 28, 'Reset!', '#ffd166'); } }); sfx('dash'); break; }
    case 'wildshape': P.wild = ab.dur! + (hasFlag('wild_long') ? 5 : 0); if (hasFlag('wild_long')) heal(st().maxHp * 0.2); addPart(P.x, P.y - 8, col, 30, 60, 0.8); hooks.toast(companion() ? `You take the shape of your ${SPECIES[companion()!.sp].names[0]}.` : 'You take a wild shape.', 'good'); sfx('evolve'); break;
    case 'raise': { const cap = hasFlag('raise3') ? 3 : 2; const dur = ab.dur! + (hasFlag('raise_long') ? 5 : 0); const boost = hasFlag('raise3') ? 1.3 : 1;
      const cs = W.corpses.filter(c => dist(c.x, c.y, P.x, P.y) < ab!.range!).slice(0, cap);
      if (cs.length) for (const c of cs) { W.corpses.splice(W.corpses.indexOf(c), 1); const d = ENEMIES[c.id] || ENEMIES.mossblob; W.allies.push({ k: 'minion', id: c.id, x: c.x, y: c.y, hw: 5, hh: 4, hp: d.hp * 0.6, max: d.hp * 0.6, t: dur, cd: 0.5, dmg: (d.dmg * 0.8 + st().pow * 0.3) * boost, face: 1, tick: 0 }); addPart(c.x, c.y - 6, '#8affb0', 16, 40, 0.6, 1, -30); }
      else { const p = clampTo(40); W.allies.push({ k: 'thrall', x: p.x, y: p.y, hw: 4, hh: 3, hp: st().maxHp * 0.3, max: st().maxHp * 0.3, t: dur, cd: 0.5, dmg: st().pow * 0.5 * boost, face: 1, tick: 0 }); addPart(p.x, p.y - 6, '#d8d0ff', 16, 40, 0.6, 1, -30); }
      sfx('evolve'); break; }
    case 'pulse': { let total = 0; W.fx.push({ k: 'ring', x: ox, y: oy + 3, R: ab.rad!, t: 0, d: 0.35, col: cd.col, lt }); forEnemiesIn(ox, oy + 3, ab.rad!, e => { total += hitEnemy(e, mult, { col: lt, kb: 10, from: P }); }); if (total) heal(total * (hasFlag('pulse_hunger') ? 0.5 : 0.3)); shake(3); sfx('boom'); break; }
  }
}
function meleeArc(ox: number, oy: number, a0: number, rad: number, mult: number, col: string, lt: string, kb: number, bleed: boolean) {
  W.fx.push({ k: 'arc', x: ox, y: oy, a: a0, t: 0, d: 0.18, R: rad, col, lt });
  forEnemiesIn(ox, oy, rad + 4, e => { const ang = Math.atan2((e.y - 4) - oy, e.x - ox); const da = Math.abs(((ang - a0) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    if (da < 1.3 || dist(e.x, e.y, ox, oy) < 12) { hitEnemy(e, mult, { kb, from: W.P, col: lt }); if (bleed && e.hp > 0) e.bleed = { t: 3, tick: 0.5, dps: st().pow * 0.25 }; } });
}
function zone(k: ZoneK, x: number, y: number, r: number, t: number, o: Partial<Zone> = {}): Zone {
  return { k, x, y, r, t, arm: 0, armMax: o.arm || 0, dps: 0, mult: 0, tick: 0, own: 'p', col: '#ffffff', ...o };
}
export function throwPotion(pid: string, tier: number, aim: { x: number; y: number }) {
  const P = W.P; const ox = P.x, oy = P.y - 7; const dx = aim.x - ox, dy = aim.y - oy; const d = Math.hypot(dx, dy); const m = Math.min(d, 110) / (d || 1);
  W.proj.push({ x: ox, y: oy, vx: 0, vy: 0, r: 3, own: 'p', mult: 0, dmg: 0, life: 9, pierce: 0, col: POTION[pid].col, lt: '#ffffff', hits: new Set(), kind: 'lob', tx: ox + dx * m, ty: oy + dy * m, sx: ox, sy: oy, t: 0, T: 0.5, z: 0, pid, tier });
  sfx('whoosh');
}
function onScreen(e: { x: number; y: number }) { return Math.abs(e.x - W.P.x) < 220 && Math.abs(e.y - W.P.y) < 130; }
export function forEnemiesIn(x: number, y: number, rad: number, fn: (e: Enemy) => void) { for (const e of W.enemies.slice()) { if (e.hp <= 0 && !e.wild) continue; if (dist(e.x, e.y - 4 * e.sc, x, y) <= rad + e.r) fn(e); } }
export function stunAround(x: number, y: number, rad: number, t: number) { W.fx.push({ k: 'ring', x, y, R: rad, t: 0, d: 0.3, col: '#c09a60', lt: '#ead2a2' }); forEnemiesIn(x, y, rad, e => { if (!e.wild) e.stun = Math.max(e.stun, e.def.boss ? t * 0.3 : t); }); shake(2); }

// ---------- familiar abilities (O) ----------
export function famAbility(aim?: { x: number; y: number }) {
  const P = W.P; const c = companion(); if (!c || P.dead > 0 || W.deco.on) return;
  if (P.flying) { hooks.toast('Land first (B).', 'dim'); return; }
  if (W.map.id === 'cottage') { hooks.toast('Your familiar would rather nap.', 'dim'); return; }
  const sp = SPECIES[c.sp], act = sp.act; const left = W.famCd[c.uid] || 0; if (left > 0) { hooks.toast(`${act.name} ready in ${left.toFixed(1)}s.`, 'dim'); return; }
  const might = famStat(c, 'might'); const pw = st().pow * (0.7 + might / 110) * (1 + 0.25 * (c.stage - 1)); const el = ELEMENT_INFO[sp.el];
  const a = aimVec(aim); const ang = Math.atan2(a.dy, a.dx); const tgt = { x: P.x + a.dx * Math.min(a.d, 110), y: P.y - 7 + a.dy * Math.min(a.d, 110) + 7 };
  const famHit = (e: Enemy, k: number, o: HitOpts = {}) => hitEnemy(e, 0, { raw: pw * k, fam: true, col: el.light, ...o });
  switch (act.kind) {
    case 'flamedash': { const d = Math.min(a.d, 80); P.dashT = 0.2; P.dashV = { x: a.dx * d / 0.2, y: a.dy * d / 0.2 }; P.inv = Math.max(P.inv, 0.3);
      for (let k = 0; k <= 4; k++) { const x = P.x + a.dx * d * k / 4, y = P.y + a.dy * d * k / 4; W.zones.push(zone('fire', x, y, 12, 3, { dps: pw * 0.45, col: el.col, el: 'ember' })); } sfx('dash'); break; }
    case 'swarm': for (let k = 0; k < 3; k++) W.orbs.push({ a: k * Math.PI * 2 / 3, t: 6, dmg: pw * 0.7, x: P.x, y: P.y, tgt: null, col: el.col }); sfx('buff'); break;
    case 'bubble': P.shield = st().maxHp * 0.3; P.shieldT = 6; addPart(P.x, P.y - 8, el.light, 16, 30, 0.5); sfx('buff'); break;
    case 'lash': { W.fx.push({ k: 'arc', x: P.x, y: P.y - 5, a: ang, t: 0, d: 0.25, R: 58, col: el.col, lt: el.light });
      forEnemiesIn(P.x, P.y - 5, 58, e => { const an = Math.atan2(e.y - P.y, e.x - P.x); const da = Math.abs(((an - ang) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (da > 1.1) return;
        if (!e.def.boss) moveBody(e, (P.x - e.x) * 0.5, (P.y - e.y) * 0.5, e.def.fly ? 'fly' : 'enemy'); e.slow = Math.max(e.slow, 2.5); famHit(e, 1.1); }); sfx('whoosh'); break; }
    case 'bastion': P.bastion = 3; for (const e of W.enemies) if (!e.wild && dist(e.x, e.y, P.x, P.y) < 90) e.aggro = true; addPart(P.x, P.y - 8, el.light, 20, 40, 0.5); floatText(P.x, P.y - 30, 'Bastion!', el.light); sfx('thud'); break;
    case 'burrow': W.F.busy = 0.6; W.F.tx = tgt.x; W.F.ty = tgt.y; addPart(W.F.x, W.F.y, '#8a6440', 10, 30, 0.4);
      after(0.45, () => { stunAround(tgt.x, tgt.y, 34, 1.6); forEnemiesIn(tgt.x, tgt.y, 34, e => famHit(e, 1.4)); addPart(tgt.x, tgt.y, '#8a6440', 24, 70, 0.6, 2, 60); sfx('boom'); }); break;
    case 'dive': W.F.busy = 0.45; W.F.tx = tgt.x; W.F.ty = tgt.y;
      after(0.3, () => { W.fx.push({ k: 'ring', x: tgt.x, y: tgt.y, R: 30, t: 0, d: 0.3, col: el.col, lt: el.light }); forEnemiesIn(tgt.x, tgt.y, 30, e => { famHit(e, 1.2, { kb: 40, from: tgt }); e.expose = 4; }); sfx('whoosh'); }); break;
    case 'screech': { let tot = 0; W.fx.push({ k: 'ring', x: P.x, y: P.y - 6, R: 64, t: 0, d: 0.4, col: el.col, lt: el.light });
      forEnemiesIn(P.x, P.y - 6, 64, e => { if (!e.def.boss) e.fear = 2; tot += famHit(e, 0.8); }); if (tot) heal(tot * 0.4); sfx('hurt'); break; }
    case 'phase': { const d = Math.min(a.d, 110); let x = P.x + a.dx * d, y = P.y + a.dy * d; if (boxSolid(x, y, P.hw, P.hh, 'walk')) { const n = nearestWalkable(x, y); if (!n) return; x = n.x; y = n.y; }
      W.allies.push({ k: 'decoy', x: P.x, y: P.y, hw: 4, hh: 3, hp: st().maxHp * 0.25, max: st().maxHp * 0.25, t: 3, cd: 0, dmg: 0, face: P.fx < 0 ? -1 : 1, tick: 0 });
      addPart(P.x, P.y - 8, el.light, 14, 40, 0.5); P.x = x; P.y = y; P.inv = Math.max(P.inv, 0.4); addPart(P.x, P.y - 8, el.light, 14, 40, 0.5); sfx('whoosh'); break; }
    case 'lantern': W.zones.push(zone('lantern', tgt.x, tgt.y, 42, 8, { dps: pw * 0.4, col: el.col, el: 'spirit' })); sfx('buff'); break;
  }
  const cdv = act.cd * (hasTal(c, 'eager') ? 0.8 : 1); W.famCd[c.uid] = cdv; W.famCdMax[c.uid] = cdv; P.combat = Math.max(P.combat, 3); hooks.hud();
}

// ---------- damage ----------
interface HitOpts { kb?: number; from?: { x: number; y: number }; stun?: number; root?: number; col?: string; noCrit?: boolean; dot?: boolean; raw?: number; noMark?: boolean; fam?: boolean; mark?: number | boolean; chain?: boolean; el?: Element }
export function hitEnemy(e: Enemy, mult: number, o: HitOpts = {}): number {
  if (e.hp <= 0 && !e.wild) return 0; const s = st(); const P = W.P; const c = companion(); const night = isNight();
  let d = o.raw ?? s.pow * mult * s.famMult * (1 + s.aff / 100) * (P.wild > 0 && !o.fam ? 1.4 : 1) * (0.9 + R() * 0.2);
  const att = o.el ?? s.el; const em = effMult(att, e.def.el); d *= em;
  if (e.curse > 0) d *= 1.35; if (e.exposed > 0) d *= 1.25;
  if (e.burn && hasEvo(c, 'sparkit')) d *= 1.25; if (e.slow > 0 && hasEvo(c, 'driftjel')) d *= 1.2; if (night && hasEvo(c, 'flitbat')) d *= 1.2;
  let blocked = false;
  if (e.def.ai === 'shield' && !o.dot) { const f = o.from || P; const toSrc = Math.atan2(f.y - e.y, f.x - e.x); const fa = Math.atan2(P.y - e.y, P.x - e.x); const da = Math.abs(((toSrc - fa) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (da < 1.0 && e.stun <= 0 && e.tele <= 0) { d *= 0.4; blocked = true; } }
  if (e.def.dr) d *= 1 - e.def.dr;
  const crit = !o.noCrit && !o.dot && R() < s.crit + (e.expose > 0 ? 0.5 : 0); if (crit) d *= 1.75; d = Math.max(1, Math.round(d));
  e.flash = 0.12; e.aggro = true; e.hurtT = 4; P.combat = 6;
  // boss shields soak damage; the right element cracks them fast
  if (e.shield > 0) {
    const sd = Math.round(d * (em > 1 ? 1.5 : att === 'spirit' ? 0.55 : 0.3)); e.shield -= sd; floatText(e.x, e.y - 14 * e.sc, sd, em > 1 ? '#bcd4ff' : '#7a7a90');
    if (e.shown < W.clock - 3 && em <= 1) { e.shown = W.clock; floatText(e.x, e.y - 26 * e.sc, 'Shielded', '#9a9ab0'); }
    if (e.shield <= 0) { e.shield = 0; e.exposed = 5; e.stun = Math.max(e.stun, 2); e.tele = 0; e.dash = 0; shake(5); sfx('boom'); hooks.banner('SHIELD BROKEN', `${e.def.name} is exposed!`); addPart(e.x, e.y - 12, '#bcd4ff', 30, 80, 0.7); }
    addPart(e.x, e.y - 6 * e.sc, '#bcd4ff', 3, 40, 0.3); if (!o.dot) sfx('hit'); return 0;
  }
  e.hp -= d;
  floatText(e.x, e.y - 14 * e.sc, d, crit ? '#ffd166' : o.dot ? '#ffb04a' : em > 1 ? '#ff9a4a' : em < 1 ? '#8a8aa0' : '#ffffff');
  if (!o.dot && em !== 1 && e.shown < W.clock - 4) { e.shown = W.clock; floatText(e.x, e.y - 24 * e.sc, em > 1 ? 'Weak!' : 'Resist', em > 1 ? '#ff9a4a' : '#8a8aa0'); }
  if (blocked && e.shown < W.clock - 2) { e.shown = W.clock; floatText(e.x, e.y - 24, 'Blocked', '#c8ccd8'); }
  if (o.kb && e.sc === 1 && !e.def.boss) { const f = o.from || P; const a = Math.atan2(e.y - f.y, e.x - f.x); const kb = o.kb * (s.el === 'stone' ? 1.5 : 1) * (e.elite ? 0.4 : 1); moveBody(e, Math.cos(a) * kb * 0.5, Math.sin(a) * kb * 0.5, e.def.fly ? 'fly' : 'enemy'); }
  if (o.stun) e.stun = Math.max(e.stun, e.def.boss || e.elite ? o.stun * 0.3 : o.stun);
  if (o.root) e.root = Math.max(e.root, e.def.boss || e.elite ? o.root * 0.3 : o.root);
  if (o.mark && !o.noMark) { e.marks = Math.min(markCap(), e.marks + (typeof o.mark === 'number' ? o.mark : 1)); e.markT = 8; }
  if (!o.dot && c) {
    const el = SPECIES[c.sp].el;
    if ((el === 'ember' && R() < 0.15) || (c.sp === 'sparkit' && R() < sigVal(c) / 100)) e.burn = { t: 3, tick: 0.5, dps: s.pow * 0.35 };
    if (el === 'tide') e.slow = Math.max(e.slow, 1.2);
    if (c.sp === 'driftjel') e.slow = Math.max(e.slow, sigVal(c));
    if (el === 'spirit') P.hp = Math.min(s.maxHp, P.hp + d * 0.03);
    if (c.sp === 'flitbat') P.hp = Math.min(s.maxHp, P.hp + d * sigVal(c) / 100 * (night && hasEvo(c, 'flitbat') ? 2 : 1));
  }
  if (!o.dot && hasFlag('shape_lifesteal')) P.hp = Math.min(s.maxHp, P.hp + d * 0.06);
  if (crit && !o.fam && hasFlag('crit_mp')) P.mp = Math.min(s.maxMp, P.mp + 3);
  if (crit && !o.chain && hasEvo(c, 'fluffowl')) { const n = W.enemies.find(x => x !== e && !x.wild && dist(x.x, x.y, e.x, e.y) < 56); if (n) { W.fx.push({ k: 'line', x: e.x, y: e.y - 8, tx: n.x, ty: n.y - 8, t: 0, d: 0.2, R: 0, col: '#d6ffe6', lt: '#ffffff' }); hitEnemy(n, 0, { raw: d * 0.5, chain: true, noCrit: true, col: '#d6ffe6' }); } }
  addPart(e.x, e.y - 6 * e.sc, o.col || '#ffffff', crit ? 8 : 4, 50, 0.3);
  if (!o.dot) sfx('hit');
  if (e.wild) { if (e.hp < e.max * 0.35 && !e.dazed) { e.dazed = 8; e.tele = 0; hooks.toast(`${e.def.name} is dazed! Press <b>E</b> beside it to begin a binding.`, 'good'); } if (e.dazed) { e.hp = Math.max(1, e.hp); e.dazed = Math.max(e.dazed, 3); } return d; }
  if (e.hp <= 0) killEnemy(e);
  return d;
}
function dropAt(x: number, y: number, id: string, q: number, n = 1) { W.pickups.push({ k: 'item', id, q, n, x: x + rint(-6, 6), y: y + rint(-4, 4), t: 0 }); }
export function killEnemy(e: Enemy) {
  e.hp = 0; const d = e.def; const big = !!d.boss || e.elite || d.ai.startsWith('boss_');
  addPart(e.x, e.y - 6, d.el ? ELEMENT_INFO[d.el].col : '#ffffff', big ? 40 : 12, big ? 90 : 50, big ? 1 : 0.6, big ? 2 : 1);
  const i = W.enemies.indexOf(e); if (i >= 0) W.enemies.splice(i, 1);
  S.kills[e.id] = (S.kills[e.id] || 0) + 1; S.factionKills[d.faction] = (S.factionKills[d.faction] || 0) + 1;
  const xp = d.xp * (e.elite ? 3 : 1); giveXp(xp); companionXp(xp);
  const c = companion(); const pros = c && c.sp === 'dirtnib' ? sigVal(c) / 100 : 0; const lucky = c && hasTal(c, 'lucky') ? 0.15 : 0;
  const gold = Math.round(rint(d.gold[0], d.gold[1]) * (1 + pros + lucky) * (e.elite ? 3 : 1)); if (gold) W.pickups.push({ k: 'gold', n: gold, x: e.x, y: e.y, t: 0 });
  if (c && c.sp === 'wickmoth') W.P.mp = Math.min(st().maxMp, W.P.mp + sigVal(c));
  if (hasEvo(c, 'wisplet')) W.pickups.push({ k: 'mote', n: 1, x: e.x, y: e.y - 4, t: 0 });
  const q = big ? 2 : 1;
  for (const dr of d.drops) if (R() < dr.p * (e.elite ? 2 : 1)) dropAt(e.x, e.y, dr.id, q, dr.n ? rint(dr.n[0], dr.n[1]) : 1);
  W.corpses.push({ id: e.id, x: e.x, y: e.y, t: 10 });
  questEvent({ t: 'kill', e });
  if (d.ai.startsWith('boss_')) {
    S.bosses[e.id] = 1; shake(6); sfx('level'); hooks.banner('VICTORY', `${d.name} has fallen`);
    for (let k = 0; k < 3; k++) dropAt(e.x, e.y, 'ess_' + pick(ELEMENTS), 0);
    W.pickups.push({ k: 'gear', n: 1, gear: makeGear(pick(SLOTS), d.lvl, 2), x: e.x + 10, y: e.y, t: 0 });
    W.pickups.push({ k: 'gear', n: 1, gear: makeGear(pick(SLOTS), d.lvl, 1), x: e.x - 10, y: e.y, t: 0 });
    for (const o of W.enemies.filter(x => x.tag === 'summon')) { addPart(o.x, o.y - 6, '#ffffff', 10, 40); W.enemies.splice(W.enemies.indexOf(o), 1); }
    if (e.id === 'rootmaw') cleanseForest();
    if (e.id === 'halloran') { for (const o of W.enemies.filter(x => x.tag === 'hunt')) { addPart(o.x, o.y - 6, '#ffffff', 10, 40); W.enemies.splice(W.enemies.indexOf(o), 1); }
      hooks.say([{ who: 'Ysolde', text: 'You… you actually beat a Witchfinder. Thank you. I am going to Hollowmere, where there are others like us. Find me there.' }]); }
    if (e.id === 'mags') hooks.toast('Mags Redhand is down. The bounty can be claimed at the Hollowmere order board.', 'good');
    questEvent({ t: 'boss', id: e.id });
  } else {
    const gearP = e.elite ? 0.6 : 0.05 * (1 + pros * 2);
    if (R() < gearP) { const rr = R(); W.pickups.push({ k: 'gear', n: 1, gear: makeGear(pick(SLOTS), clamp(d.lvl + rint(-1, 1) + (e.elite ? 1 : 0), 1, 20), e.elite ? (rr < 0.25 ? 2 : 1) : rr < 0.04 ? 2 : rr < 0.3 ? 1 : 0), x: e.x + 4, y: e.y, t: 0 }); }
    if (R() < (e.elite ? 0.8 : 0.06)) dropAt(e.x, e.y, 'ess_' + (d.el && R() < 0.6 ? d.el : pick(ELEMENTS)), 0);
    if (e.elite) hooks.toast(`The Alpha ${d.name} falls!`, 'good');
  }
}
function cleanseForest() {
  S.flags.cleansed = true; const r = rngFrom(77);
  for (const i of W.map.blight) { if (r() < 0.15) continue; if (W.m[i] === TL.BLIGHT || W.m[i] === TL.DEADTREE) { setTile(i, W.m[i] === TL.DEADTREE ? TL.TREE : TL.GRASS); if (R() < 0.08) addPart((i % W.map.w) * T + 8, ((i / W.map.w) | 0) * T + 8, '#fff6c0', 4, 30, 0.8, 1, -20); } }
  hooks.banner('THE ROT LIFTS', 'Brindlewood breathes again');
}
export function hurtPlayer(raw: number, src: Enemy | null, melee: boolean, el?: Element) {
  const P = W.P; if (P.inv > 0 || P.dead > 0 || P.air > 0) return;
  if (P.flying && melee && !(src && src.def.fly)) return;
  const c = companion(); const s = st();
  if (c && c.sp === 'gloamkit' && R() < sigVal(c) / 100) { floatText(P.x, P.y - 24, 'Dodge', '#ecfcff'); P.inv = 0.25; addPart(P.x, P.y - 8, '#9ad8e8', 6, 30, 0.3); return; }
  const srcEl = el ?? src?.def.el; let d = raw * effMult(srcEl, s.el) * 60 / (60 + s.ward);
  if (P.buffs.ward) d *= 1 - P.buffs.ward.v / 100; if (P.circle > 0) d *= hasFlag('grand_ward') ? 0.5 : 0.7;
  if (P.bastion > 0) d *= 0.6; if (hasEvo(c, 'pebbleshell')) d *= 0.88; if (isNight() && hasEvo(c, 'wickmoth')) d *= 0.85;
  d = Math.max(1, Math.round(d * (0.9 + R() * 0.2)));
  if (P.shield > 0) { const ab = Math.min(P.shield, d); P.shield -= ab; d -= ab; floatText(P.x, P.y - 24, ab, '#a6e4ff');
    if (P.shield <= 0) { P.shield = 0; P.shieldT = 0; W.fx.push({ k: 'ring', x: P.x, y: P.y - 8, R: 40, t: 0, d: 0.3, col: '#3fa7d6', lt: '#a6e4ff' }); forEnemiesIn(P.x, P.y - 8, 40, e => { e.slow = Math.max(e.slow, 2); }); sfx('water'); }
    if (d <= 0) { P.inv = 0.3; return; } }
  P.hp -= d; P.inv = 0.5; P.combat = 6; floatText(P.x, P.y - 22, d, effMult(srcEl, s.el) > 1 ? '#ff5050' : '#ff8a8a'); sfx('hurt'); shake(d > s.maxHp * 0.15 ? 4 : 2);
  if (melee && src && !hasEvo(c, 'pebbleshell') && P.bastion <= 0) { const a = Math.atan2(P.y - src.y, P.x - src.x); moveBody(P, Math.cos(a) * 6, Math.sin(a) * 6, 'walk'); }
  if (melee && src && src.hp > 0) { let refl = 0; if (c && c.sp === 'pebbleshell') refl += sigVal(c) / 100; if (P.buffs.thorn) refl += P.buffs.thorn.v / 100; if (hasFlag('bramble')) refl += 0.15;
    if (refl > 0) { const rd = Math.max(1, Math.round(raw * refl)); if (src.shield <= 0) { src.hp -= rd; src.flash = 0.1; floatText(src.x, src.y - 14, rd, '#ead2a2'); if (src.hp <= 0 && !src.wild) killEnemy(src); } } }
  if (P.hp <= 0) {
    if (hasEvo(c, 'gloamkit') && !P.nine) { P.nine = true; P.hp = 1; P.inv = 2; floatText(P.x, P.y - 30, 'Nine Lives!', '#ecfcff'); addPart(P.x, P.y - 8, '#9ad8e8', 30, 60, 0.8); sfx('evolve'); return; }
    P.hp = 0; P.dead = 1.6; P.flying = false; hooks.toast('You fainted…', 'bad'); sfx('fail');
  }
}

// ---------- binding ----------
export interface BindInfo { charm: string | null; zone: number; diff: number; adv: number; label: string }
export function bindInfo(w: Enemy): BindInfo {
  const charm = ['charm3', 'charm2', 'charm'].find(c => S.inv.some(s => s && s.id === c)) || null;
  const zone = charm === 'charm3' ? 0.4 : charm === 'charm2' ? 0.3 : 0.22;
  const sd = SPECIES[w.sp!]; const adv = effMult(companionEl(), sd.el);
  const diff = clamp(0.8 + (sd.rarity - 1) * 0.45 + (w.hp / w.max) * 0.9 + (adv > 1 ? -0.25 : adv < 1 ? 0.3 : 0), 0.6, 2.4);
  const label = diff < 1.05 ? 'Calm' : diff < 1.4 ? 'Restless' : diff < 1.8 ? 'Wild' : 'Furious';
  return { charm, zone, diff, adv, label };
}
export function bindResult(w: Enemy, ok: boolean) {
  const i = W.enemies.indexOf(w);
  if (ok) {
    if (i >= 0) W.enemies.splice(i, 1); sfx('bind'); addPart(w.x, w.y - 6, '#f2c14e', 30, 70, 1); S.binds++;
    if (S.fams.length >= 16) { hooks.toast('Your roost is full (16). The familiar leaves you some Familiar Down instead.', 'dim'); W.pickups.push({ k: 'item', id: 'familiardown', q: 2, n: 2, x: w.x, y: w.y, t: 0 }); }
    else { const f = newFamiliar(w.sp!, R, 'wild', w.bonus || 0); S.fams.push(f); hooks.banner('BOUND!', `${SPECIES[f.sp].names[0]} joined your coven`); hooks.toast(`Press F to add ${famName(f)} to your party or give it a job. Every familiar rolls its own stats.`, 'good'); }
    giveXp(15); W.wildT = 35; questEvent({ t: 'bind', sp: w.sp! });
  } else { sfx('fail'); hooks.toast(`${w.def.name} broke free!`, 'bad'); w.dazed = 0; w.hp = Math.max(w.hp, Math.round(w.max * 0.45)); w.hurtT = 5; w.aggro = true; }
  refresh();
}

// ---------- AI helpers ----------
type Target = { x: number; y: number; ally?: Ally; player?: boolean; fly?: boolean; pip?: boolean; shrine?: boolean };
function chooseTarget(e: Enemy): Target {
  const P = W.P; const lure = W.allies.find(a => (a.k === 'poppet' || a.k === 'decoy') && dist(a.x, a.y, e.x, e.y) < 150);
  if (lure && P.bastion <= 0) return { x: lure.x, y: lure.y, ally: lure };
  if (e.tag === 'wave' && W.defend && dist(P.x, P.y, e.x, e.y) > 50) return { x: W.defend.x, y: W.defend.y, shrine: true };
  let best: Target = { x: P.x, y: P.y, player: true, fly: P.flying }; let bd = dist(P.x, P.y, e.x, e.y); if (P.bastion > 0) return best;
  for (const a of W.allies) { if (a.k === 'snapvine') continue; const d = dist(a.x, a.y, e.x, e.y); if (d < bd - 20) { bd = d; best = { x: a.x, y: a.y, ally: a }; } }
  if (W.pip && !e.wild) { const d = dist(W.pip.x, W.pip.y, e.x, e.y); if (d < bd - 10) best = { x: W.pip.x, y: W.pip.y, pip: true }; }
  return best;
}
function damageTarget(e: Enemy, tgt: Target, dmg: number, melee = true) {
  if (tgt.ally) damageAlly(tgt.ally, dmg); else if (tgt.pip) hurtPip(dmg); else if (tgt.shrine) hurtShrine(dmg); else hurtPlayer(dmg, e, melee);
}
function enemyShoot(e: Enemy, a: number, spd: number, mul = 1, kind?: 'net') {
  W.proj.push({ x: e.x, y: e.y - 6 * e.sc, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: kind ? 4 : 3, own: 'e', mult: 0, dmg: e.dmg * mul, life: 3, pierce: 0, col: kind ? '#e9dfc7' : e.def.pcol || '#c890ff', lt: '#ffffff', hits: new Set(), kind, el: e.def.el });
}
function enemyZone(e: Enemy, k: 'spike' | 'blast', x: number, y: number, r: number, arm: number, mul: number) { W.zones.push(zone(k, x, y, r, arm + 0.25, { arm, own: 'e', dmg: e.dmg * mul, col: e.def.pcol || '#e0484f', el: e.def.el })); }
function summon(e: Enemy, id: string, n: number) { for (let k = 0; k < n; k++) { const a = R() * Math.PI * 2; const s = spawnEnemy(id, e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, 'summon'); s.aggro = true; if (boxSolid(s.x, s.y, s.hw, s.hh, 'enemy')) { s.x = e.x; s.y = e.y; } addPart(s.x, s.y - 6, '#ffffff', 8, 40); } }
const AGGRO: Record<string, number> = { corrupt: 85, bandit: 100, order: 135, wild: 0 };
function face(e: Enemy, dx: number, dy: number) { if (Math.abs(dx) > Math.abs(dy) * 1.1) { e.dir = 'side'; e.face = Math.sign(dx) || 1; } else e.dir = dy > 0 ? 'down' : 'up'; }
function inReach(e: Enemy, tgt: Target, reach: number) { return dist(e.x + Math.cos(e.teleA) * reach * 0.4, e.y + Math.sin(e.teleA) * reach * 0.4, tgt.x, tgt.y) < reach * 0.8 + 5; }

export function updateCombat(dt: number) {
  const P = W.P;
  if (!W.map.safe) {
    W.spawnT -= dt; const normal = W.enemies.filter(e => e.tag === 'corrupt').length; const cap = S.flags.cleansed ? 6 : 14;
    if (W.spawnT <= 0) { W.spawnT = 6; if (normal < cap) spawnCorrupt(false); }
    if (!W.enemies.some(e => e.wild)) { W.wildT -= dt; if (W.wildT <= 0) { spawnWild(); W.wildT = 35; } }
    W.patrolT -= dt; if (W.patrolT <= 0) { W.patrolT = 75; if (!isNight() && !W.enemies.some(e => e.tag === 'patrol')) spawnPatrol(); }
    W.banditT -= dt; if (W.banditT <= 0) { W.banditT = 50; if (W.enemies.filter(e => e.tag === 'camp').length < 4) { const c = W.map.regions.camp; spawnEnemy(R() < 0.5 ? 'roadcutter' : 'slinger', c.x * T + 8 + rint(-30, 30), c.y * T + 8 + rint(-20, 20), 'camp'); } }
  }
  // the active familiar fights beside you
  const c = companion(); W.F.cd -= dt;
  if (c && W.F.cd <= 0 && W.F.busy <= 0 && !P.flying && P.dead <= 0) {
    let tgt: Enemy | null = null, bd = 80; for (const e of W.enemies) { if (e.wild && !e.hurtT) continue; if (!e.aggro && !e.hurtT) continue; const d = dist(e.x, e.y, W.F.x, W.F.y); if (d < bd) { bd = d; tgt = e; } }
    if (tgt) { const el = SPECIES[c.sp].el, ec = ELEMENT_INFO[el]; const a = Math.atan2(tgt.y - 6 - W.F.y, tgt.x - W.F.x); const might = famStat(c, 'might');
      W.proj.push({ x: W.F.x, y: W.F.y - 6, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 2, own: 'f', mult: 0, dmg: (3 + might * 0.45) * (1 + 0.2 * (c.stage - 1)) * (hasTal(c, 'fierce') ? 1.15 : 1), life: 0.8, pierce: 0, col: ec.col, lt: ec.light, hits: new Set() });
      W.F.cd = el === 'gale' ? 1.0 : 1.5; W.F.hits++; if (el === 'tide' && W.F.hits % 3 === 0) heal(st().maxHp * 0.03); }
  }
  let boss: Enemy | null = null, bossD = 1e9;
  for (const e of W.enemies.slice()) {
    e.flash = Math.max(0, e.flash - dt); e.atk = Math.max(0, e.atk - dt); e.slow = Math.max(0, e.slow - dt); e.hurtT = Math.max(0, e.hurtT - dt); e.root = Math.max(0, e.root - dt);
    e.curse = Math.max(0, e.curse - dt); e.exposed = Math.max(0, e.exposed - dt); e.fear = Math.max(0, e.fear - dt); e.expose = Math.max(0, e.expose - dt);
    if (e.markT > 0) { e.markT -= dt; if (e.markT <= 0) e.marks = 0; }
    for (const k of ['burn', 'bleed'] as const) { const b = e[k]; if (!b) continue; b.t -= dt; b.tick -= dt; if (b.tick <= 0) { b.tick = 0.5; hitEnemy(e, 0, { raw: b.dps * 0.5, dot: true, noCrit: true, el: k === 'burn' ? 'ember' : undefined }); }
      if (b.t <= 0) e[k] = null; else if (k === 'burn' && R() < 0.3) W.parts.push({ x: e.x + R() * 8 - 4, y: e.y - 8, vx: 0, vy: -20, life: 0.3, max: 0.3, col: '#ffb04a', size: 1, grav: 0 }); }
    if (e.hp <= 0 && !e.wild) continue;
    if (e.stun > 0) { e.stun -= dt; continue; }
    const tgt = chooseTarget(e); const d = dist(e.x, e.y, tgt.x, tgt.y); const dp = dist(e.x, e.y, P.x, P.y);
    const spd = e.def.spd * (e.slow > 0 ? 0.55 : 1) * (e.root > 0 ? 0 : 1); const mode = e.def.fly ? 'fly' : 'enemy';
    if (e.fear > 0) { const a = Math.atan2(e.y - P.y, e.x - P.x); moveBody(e, Math.cos(a) * spd * 1.2 * dt, Math.sin(a) * spd * 1.2 * dt, mode); e.tele = 0; continue; }
    if (e.wild) {
      if (e.dazed > 0) { e.dazed -= dt; if (e.dazed <= 0) { e.hp = Math.max(e.hp, e.max * 0.5); hooks.toast(`${e.def.name} shook off the daze.`, 'dim'); } continue; }
      if (e.hurtT > 0 && dp < 140) meleeAI(e, dt, { x: P.x, y: P.y, player: true, fly: P.flying }, dp, spd, mode);
      else { e.tele = 0; wander(e, dt, spd * 0.6, mode); }
      if (R() < 0.06) W.parts.push({ x: e.x + R() * 14 - 7, y: e.y - 6 - R() * 10, vx: 0, vy: -12, life: 0.5, max: 0.5, col: '#f2c14e', size: 1, grav: 0 });
      continue;
    }
    if (e.def.ai.startsWith('boss_')) {
      if (dp < 140) e.aggro = true;
      if (e.aggro) { if (dp < bossD) { bossD = dp; boss = e; } bossAI(e, dt, tgt, d, spd); }
      if (e.aggro && (dp > 320 || P.dead > 0)) { e.aggro = false; e.hp = e.max; e.shield = e.shieldMax; e.phase = 1; e.x = e.home.x; e.y = e.home.y; e.summoned = 0; e.tele = 0; e.dash = 0;
        for (const o of W.enemies.filter(x => x.tag === 'summon')) W.enemies.splice(W.enemies.indexOf(o), 1); W.zones = W.zones.filter(z => z.own !== 'e'); }
      continue;
    }
    const ag = AGGRO[e.def.faction] || 90;
    if (!e.aggro && (dp < ag || e.tag === 'wave') && P.dead <= 0) { e.aggro = true; if (e.def.faction === 'order' && R() < 0.4) say(e, pick(['Witch!', 'Heretic!', 'Halt!', 'For Grace!'])); if (e.def.faction === 'bandit' && R() < 0.3) say(e, pick(['Your purse!', 'Get her!', 'Oi!'])); }
    if (e.aggro && e.tag !== 'wave' && (dp > 240 || P.dead > 0)) { e.aggro = false; e.tele = 0; e.dash = 0; }
    if (e.elite && e.aggro && dp < bossD) { bossD = dp; boss = e; }
    if (e.aggro) {
      switch (e.def.ai) {
        case 'ranged': rangedAI(e, dt, tgt, d, spd, mode); break;
        case 'caster': casterAI(e, dt, tgt, d, spd, mode); break;
        case 'swoop': swoopAI(e, dt, tgt, d, spd, mode); break;
        case 'charger': chargerAI(e, dt, tgt, d, spd, mode); break;
        default: meleeAI(e, dt, tgt, d, spd * (e.def.ai === 'shield' ? 0.85 : 1), mode);
      }
    } else { e.tele = 0; wander(e, dt, spd * 0.4, mode); }
  }
  W.bossRef = boss;
  updateProj(dt); updateZones(dt); updateAllies(dt); updateOrbs(dt);
  if (P.circle > 0) P.circle -= dt;
}
function meleeAI(e: Enemy, dt: number, tgt: Target, d: number, spd: number, mode: 'fly' | 'enemy') {
  const reach = (e.def.reach ?? 18) * (e.sc > 1 ? 1.6 : 1);
  if (e.tele > 0) { e.tele -= dt; if (e.tele <= 0) { e.atk = e.def.rate ?? 1.3; moveBody(e, Math.cos(e.teleA) * 5, Math.sin(e.teleA) * 5, mode); if (inReach(e, tgt, reach) && !(tgt.player && tgt.fly && !e.def.fly)) damageTarget(e, tgt, e.dmg); W.fx.push({ k: 'arc', x: e.x, y: e.y - 5, a: e.teleA, t: 0, d: 0.15, R: reach, col: '#e0484f', lt: '#ffb0b0' }); sfx('thud'); } return; }
  const a = Math.atan2(tgt.y - e.y, tgt.x - e.x); face(e, Math.cos(a), Math.sin(a));
  if (d > reach * 0.75) { if (!(tgt.player && tgt.fly && !e.def.fly && d < 20)) { moveBody(e, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, mode); e.walk += dt; } }
  else if (e.atk <= 0) { e.tele = e.teleMax = (e.def.windup ?? 0.5) * (e.elite ? 0.85 : 1); e.teleA = a; e.teleK = 'melee'; }
}
function rangedAI(e: Enemy, dt: number, tgt: Target, d: number, spd: number, mode: 'fly' | 'enemy') {
  const a = Math.atan2(tgt.y - e.y, tgt.x - e.x); face(e, Math.cos(a), Math.sin(a));
  if (e.tele > 0) { e.tele -= dt; if (e.tele <= 0) { enemyShoot(e, e.teleA, e.def.faction === 'order' ? 120 : 105); if (e.elite) { enemyShoot(e, e.teleA - 0.2, 105); enemyShoot(e, e.teleA + 0.2, 105); } } return; }
  const want = d > 100 ? 1 : d < 64 ? -1 : 0; moveBody(e, Math.cos(a) * spd * dt * want, Math.sin(a) * spd * dt * want, mode); if (want) e.walk += dt;
  e.cd -= dt; if (e.cd <= 0 && d < 170) { e.cd = 2.1; e.tele = e.teleMax = 0.4; e.teleA = Math.atan2(tgt.y - 6 - (e.y - 6), tgt.x - e.x); e.teleK = 'aim'; }
}
function casterAI(e: Enemy, dt: number, tgt: Target, d: number, spd: number, mode: 'fly' | 'enemy') {
  const a = Math.atan2(tgt.y - e.y, tgt.x - e.x); face(e, Math.cos(a), Math.sin(a));
  const want = d > 110 ? 1 : d < 75 ? -1 : 0; moveBody(e, Math.cos(a) * spd * dt * want, Math.sin(a) * spd * dt * want, mode);
  e.cd -= dt; if (e.cd <= 0 && d < 160) { e.cd = 3.2; enemyZone(e, 'blast', tgt.x, tgt.y, 16, 1.0, 1.3); }
  e.atk -= dt; if (e.atk <= 0 && d < 150) { e.atk = 1.7; enemyShoot(e, Math.atan2(tgt.y - 6 - (e.y - 6), tgt.x - e.x), 72, 0.7); }
}
function swoopAI(e: Enemy, dt: number, tgt: Target, d: number, spd: number, mode: 'fly' | 'enemy') {
  const a = Math.atan2(tgt.y - e.y, tgt.x - e.x); face(e, Math.cos(a), Math.sin(a));
  if (e.tele > 0) { e.tele -= dt; if (e.tele <= 0) { e.dash = 0.55; e.dashA = e.teleA; e.hitOnce = false; } return; }
  if (e.dash > 0) { e.dash -= dt; moveBody(e, Math.cos(e.dashA) * spd * 2.3 * dt, Math.sin(e.dashA) * spd * 2.3 * dt, mode);
    if (!e.hitOnce && dist(e.x, e.y, tgt.x, tgt.y) < e.r + 6) { e.hitOnce = true; damageTarget(e, tgt, e.dmg); } return; }
  moveBody(e, Math.cos(a + 1.4) * spd * 0.45 * dt, Math.sin(a + 1.4) * spd * 0.45 * dt, mode);
  e.cd -= dt; if (e.cd <= 0 && d < 130) { e.cd = 2.2; e.tele = e.teleMax = 0.45; e.teleA = a; e.teleK = 'line'; }
}
function chargerAI(e: Enemy, dt: number, tgt: Target, d: number, spd: number, mode: 'fly' | 'enemy') {
  const a = Math.atan2(tgt.y - e.y, tgt.x - e.x);
  if (e.tele > 0) { e.tele -= dt; e.teleA = a; face(e, Math.cos(a), Math.sin(a)); if (e.tele <= 0) { e.dash = 0.5; e.dashA = e.teleA; e.hitOnce = false; } return; }
  if (e.dash > 0) { e.dash -= dt; const ox = e.x, oy = e.y; moveBody(e, Math.cos(e.dashA) * 210 * dt, Math.sin(e.dashA) * 210 * dt, mode);
    if (R() < 0.6) addPart(e.x, e.y, '#ff6a2a', 2, 20, 0.3);
    if (!e.hitOnce && dist(e.x, e.y, tgt.x, tgt.y) < e.r + 7) { e.hitOnce = true; damageTarget(e, tgt, e.dmg * 1.2); }
    if (Math.hypot(e.x - ox, e.y - oy) < 1) { e.dash = 0; e.stun = 1.2; floatText(e.x, e.y - 16, 'Dazed', '#ffd166'); shake(2); }
    else if (e.dash <= 0) e.stun = 0.6; return; }
  face(e, Math.cos(a), Math.sin(a));
  if (d > 40) { moveBody(e, Math.cos(a) * spd * 0.6 * dt, Math.sin(a) * spd * 0.6 * dt, mode); e.walk += dt; }
  e.cd -= dt; if (e.cd <= 0 && d < 120) { e.cd = 3; e.tele = e.teleMax = e.def.windup ?? 0.7; e.teleK = 'line'; }
  if (d < 16 && e.atk <= 0) { e.atk = 1.2; damageTarget(e, tgt, e.dmg * 0.6); }
}
function say(e: Enemy, txt: string) { W.floats.push({ x: e.x, y: e.y - 26 * e.sc, txt, col: '#e9dfc7', life: 1.6 }); }
function wander(e: Enemy, dt: number, spd: number, mode: 'fly' | 'enemy') {
  e.wt -= dt; if (e.wt <= 0) { e.wt = 1 + R() * 2.5; const hd = dist(e.home.x, e.home.y, e.x, e.y);
    if (hd > 80) { const a = Math.atan2(e.home.y - e.y, e.home.x - e.x); e.wdir = { x: Math.cos(a), y: Math.sin(a) }; } else if (R() < 0.35) e.wdir = { x: 0, y: 0 }; else { const a = R() * Math.PI * 2; e.wdir = { x: Math.cos(a), y: Math.sin(a) }; } }
  if (e.wdir.x || e.wdir.y) { moveBody(e, e.wdir.x * spd * dt, e.wdir.y * spd * dt, mode); face(e, e.wdir.x, e.wdir.y); e.walk += dt; } else e.walk = 0;
}

// ---------- bosses ----------
function bossPhase(e: Enemy) {
  const ph = e.hp > e.max * 0.66 ? 1 : e.hp > e.max * 0.33 ? 2 : 3; if (ph <= e.phase) return;
  e.phase = ph; e.shield = e.shieldMax; e.tele = 0; e.dash = 0; e.cd = 1.2; shake(5); sfx('boom');
  const names: Record<string, string[]> = { rootmaw: ['', '', 'Old Rootmaw tears its saplings from the ground!', 'Old Rootmaw is enraged!'], mags: ['', '', 'Mags whistles for her slingers!', 'Mags is seeing red!'], halloran: ['', '', 'Halloran calls for his novices!', 'Halloran invokes the Purge!'] };
  hooks.banner(`PHASE ${ph}`, (names[e.id] || [])[ph] || ''); addPart(e.x, e.y - 12, ELEMENT_INFO[e.def.el!].col, 30, 70, 0.8);
  if (e.id === 'rootmaw') summon(e, ph === 2 ? 'snagstump' : 'mossblob', ph === 2 ? 2 : 3);
  if (e.id === 'mags' && ph === 2) summon(e, 'slinger', 2);
  if (e.id === 'halloran' && ph === 2) summon(e, 'novice', 2);
}
function bossAI(e: Enemy, dt: number, tgt: Target, d: number, spd: number) {
  const P = W.P; bossPhase(e); const a = Math.atan2(tgt.y - e.y, tgt.x - e.x); const ph = e.phase;
  if (e.tele > 0) { e.tele -= dt; if (e.teleK === 'charge') e.teleA = Math.atan2(P.y - e.y, P.x - e.x); if (e.tele <= 0) bossRelease(e, tgt); return; }
  if (e.dash > 0) { e.dash -= dt; const ox = e.x, oy = e.y; moveBody(e, Math.cos(e.dashA) * 230 * dt, Math.sin(e.dashA) * 230 * dt, 'enemy'); if (R() < 0.6) addPart(e.x, e.y, '#c8a070', 2, 20, 0.3);
    if (!e.hitOnce && dist(e.x, e.y, P.x, P.y) < e.r + 8) { e.hitOnce = true; hurtPlayer(e.dmg * 1.4, e, true); }
    if (Math.hypot(e.x - ox, e.y - oy) < 1) { e.dash = 0; e.stun = 1.4; shake(4); floatText(e.x, e.y - 30, 'Stuck!', '#ffd166'); } return; }
  face(e, Math.cos(a), Math.sin(a)); e.cd -= dt;
  const pace = ph === 1 ? 1 : ph === 2 ? 0.8 : 0.62;
  switch (e.def.ai) {
    case 'boss_root': {
      if (d > 34) { moveBody(e, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, 'enemy'); e.walk += dt; }
      if (e.cd <= 0) { e.cd = 2.4 * pace; const p = e.patt++ % 3;
        if (p === 0) { const n = 1 + ph * 2; for (let k = 0; k < n; k++) enemyZone(e, 'spike', P.x + (k ? rint(-30, 30) : 0), P.y + (k ? rint(-22, 22) : 0), 14, 0.9, 1.2); }
        else if (p === 1) { e.tele = e.teleMax = 0.6; e.teleK = 'burst'; }
        else { e.tele = e.teleMax = 0.9; e.teleK = 'slam'; } }
      break; }
    case 'boss_mags': {
      if (d > 26) { moveBody(e, Math.cos(a) * spd * (ph === 3 ? 1.3 : 1) * dt, Math.sin(a) * spd * (ph === 3 ? 1.3 : 1) * dt, 'enemy'); e.walk += dt; }
      if (e.cd <= 0) { e.cd = 2.6 * pace; const p = e.patt++ % 3;
        if (p === 0) { e.tele = e.teleMax = 0.75; e.teleK = 'charge'; e.teleA = a; say(e, pick(['Hold still!', 'Mine!'])); }
        else if (p === 1) { const n = ph + 1; for (let k = 0; k < n; k++) { const tx = P.x + (k ? rint(-36, 36) : 0), ty = P.y + (k ? rint(-26, 26) : 0); W.proj.push({ x: e.x, y: e.y - 16, vx: 0, vy: 0, r: 3, own: 'e', mult: 0, dmg: e.dmg * 0.5, life: 9, pierce: 0, col: '#ff8a3a', lt: '#ffd166', hits: new Set(), kind: 'lob', tx, ty, sx: e.x, sy: e.y - 16, t: 0, T: 0.8, z: 0, fire: true, el: 'ember' }); enemyZone(e, 'blast', tx, ty, 18, 0.8, 0.9); } }
        else { e.tele = e.teleMax = 0.55; e.teleK = 'melee'; e.teleA = a; } }
      break; }
    case 'boss_halloran': {
      const want = d > 120 ? 1 : d < 80 ? -1 : 0; moveBody(e, Math.cos(a) * spd * dt * want, Math.sin(a) * spd * dt * want, 'enemy'); if (want) e.walk += dt;
      e.net -= dt; if (e.net <= 0) { e.net = P.flying ? 3 : 7; enemyShoot(e, Math.atan2(P.y - 6 - e.y, P.x - e.x), 150, 0.4, 'net'); say(e, P.flying ? 'Down, witch!' : 'Bind her!'); }
      if (e.cd <= 0) { e.cd = 2.5 * pace; const p = e.patt++ % (ph >= 2 ? 4 : 3);
        if (p === 0) { e.tele = e.teleMax = 0.45; e.teleK = 'fan'; e.teleA = Math.atan2(P.y - 6 - (e.y - 12), P.x - e.x); }
        else if (p === 1) { for (let k = 0; k < 2 + ph; k++) enemyZone(e, 'blast', P.x + (k ? rint(-34, 34) : 0), P.y + (k ? rint(-24, 24) : 0), 22, 1.0, 1.1); say(e, 'Be cleansed!'); }
        else if (p === 2) { e.tele = e.teleMax = ph === 3 ? 0.6 : 0.5; e.teleK = ph === 3 ? 'ring' : 'fan'; e.teleA = Math.atan2(P.y - 6 - (e.y - 12), P.x - e.x); }
        else { enemyZone(e, 'blast', e.x, e.y, 58, 1.3, 1.6); say(e, 'PURGE!'); } }
      break; }
  }
}
function bossRelease(e: Enemy, tgt: Target) {
  const P = W.P; const ph = e.phase;
  switch (e.teleK) {
    case 'burst': { const n = 8 + ph * 3, off = R(); for (let k = 0; k < n; k++) enemyShoot(e, off + k * Math.PI * 2 / n, 74, 0.75); shake(2); break; }
    case 'slam': W.fx.push({ k: 'ring', x: e.x, y: e.y, R: 46, t: 0, d: 0.35, col: '#b88aff', lt: '#ffffff' }); if (dist(P.x, P.y, e.x, e.y) < 46) hurtPlayer(e.dmg * 1.6, e, true); shake(5); sfx('boom'); break;
    case 'charge': e.dash = 0.55; e.dashA = e.teleA; e.hitOnce = false; break;
    case 'melee': W.fx.push({ k: 'arc', x: e.x, y: e.y - 8, a: e.teleA, t: 0, d: 0.18, R: 40, col: '#e0484f', lt: '#ffb0b0' }); if (inReach(e, tgt, 40)) damageTarget(e, tgt, e.dmg * 1.3); sfx('thud'); break;
    case 'fan': for (let k = -2; k <= 2; k++) enemyShoot(e, e.teleA + k * 0.18, 110, 0.7); break;
    case 'ring': { const n = 16; for (let k = 0; k < n; k++) enemyShoot(e, e.teleA + k * Math.PI * 2 / n, 90, 0.6); break; }
  }
}
function damageAlly(a: Ally, dmg: number) {
  a.hp -= dmg; floatText(a.x, a.y - 14, Math.round(dmg), '#ff9a9a');
  if (a.k === 'poppet' && a.tick <= 0) { a.tick = 0.35; for (const e of W.enemies.slice()) if (e.marks > 0 && onScreen(e)) hitEnemy(e, a.dmg * e.marks, { col: '#ffc8d8', noMark: true, noCrit: true }); }
}
function killAlly(a: Ally) {
  const i = W.allies.indexOf(a); if (i < 0) return; W.allies.splice(i, 1); addPart(a.x, a.y - 6, a.k === 'poppet' ? '#f2c14e' : '#d8d0ff', 10, 40);
  const boom = (a.k === 'poppet' && hasFlag('poppet_explode')) || ((a.k === 'minion' || a.k === 'thrall') && hasFlag('minion_explode'));
  if (boom) { W.fx.push({ k: 'ring', x: a.x, y: a.y - 4, R: 36, t: 0, d: 0.3, col: '#f2c14e', lt: '#ffffff' }); forEnemiesIn(a.x, a.y - 4, 36, e => hitEnemy(e, 1.2, { kb: 20, from: a, col: '#ffd166' })); shake(3); sfx('boom'); }
}
function updateProj(dt: number) {
  const P = W.P;
  for (const p of W.proj.slice()) {
    let dead = false;
    if (p.kind === 'lob') {
      p.t! += dt; const k = Math.min(1, p.t! / p.T!); p.x = p.sx! + (p.tx! - p.sx!) * k; p.y = p.sy! + (p.ty! - p.sy!) * k; p.z = Math.sin(k * Math.PI) * 26;
      if (k >= 1) { dead = true; landLob(p); }
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.own !== 'e' && R() < 0.6) W.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.16, max: 0.16, col: p.lt, size: 1, grav: 0 });
      if (p.life <= 0) dead = true;
      if (!dead && tileSolidProj(p.x, p.y + 4)) { dead = true; addPart(p.x, p.y, p.col, 4, 30, 0.3); }
      if (!dead && (p.own === 'p' || p.own === 'f')) {
        for (const e of W.enemies.slice()) { if (p.hits.has(e)) continue; if (dist(e.x, e.y - 5 * e.sc, p.x, p.y) < e.r + p.r) { p.hits.add(e); if (p.own === 'f') hitEnemy(e, 0, { raw: p.dmg * (0.9 + R() * 0.2), fam: true, col: p.lt, noCrit: true }); else hitEnemy(e, p.mult, { kb: 8, from: p, col: p.lt, mark: p.mark }); if (p.pierce-- <= 0) { dead = true; break; } } }
      } else if (!dead && p.own === 'e') {
        for (const z of W.zones) if (z.k === 'ward' && dist(z.x, z.y, p.x, p.y) < z.r) { dead = true; addPart(p.x, p.y, '#fff1a8', 5, 30, 0.3); break; }
        if (!dead && P.bastion > 0 && dist(P.x, P.y - 7, p.x, p.y) < 10) { dead = true; addPart(p.x, p.y, '#ead2a2', 6, 40, 0.3); }
        if (!dead) for (const a of W.allies) if (a.k !== 'snapvine' && dist(a.x, a.y - 6, p.x, p.y) < 7 + p.r) { damageAlly(a, p.dmg); dead = true; break; }
        if (!dead && W.pip && dist(W.pip.x, W.pip.y - 7, p.x, p.y) < 6 + p.r) { hurtPip(p.dmg); dead = true; }
        if (!dead && W.defend && dist(W.defend.x, W.defend.y - 6, p.x, p.y) < 9) { hurtShrine(p.dmg); dead = true; }
        if (!dead && dist(P.x, P.y - 7, p.x, p.y) < 5 + p.r) {
          if (P.inv > 0 || P.air > 0) { /* rolled through it */ }
          else { if (p.kind === 'net') { if (!hasEvo(companion(), 'pebbleshell')) { if (P.flying) { P.flying = false; const n = boxSolid(P.x, P.y, P.hw, P.hh, 'walk') ? nearestWalkable(P.x, P.y) : null; if (n) { P.x = n.x; P.y = n.y; } hooks.toast('A net drags you off your broom!', 'bad'); } P.net = 1.2; } hurtPlayer(p.dmg, null, false, p.el); }
            else hurtPlayer(p.dmg, null, false, p.el); dead = true; }
        }
      }
    }
    if (dead) { const i = W.proj.indexOf(p); if (i >= 0) W.proj.splice(i, 1);
      if (p.split) { const base = Math.atan2(p.vy, p.vx); for (let k = -1; k <= 1; k++) { const a = base + Math.PI + k * 0.5; W.proj.push({ ...p, x: p.x - Math.cos(base) * 4, y: p.y - Math.sin(base) * 4, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: 2, mult: p.mult * 0.4, life: 0.35, pierce: 0, hits: new Set(p.hits), split: false }); } } }
  }
}
function tileSolidProj(x: number, y: number) { const t = tileAt(x, y); return [TL.TREE, TL.STONEWALL, TL.HWALL, TL.ROOF, TL.DOOR, TL.ROOF_BLUE, TL.ROCK, TL.WINDOW, TL.ROOF_GREEN, TL.DEADTREE, TL.STALL, TL.TENT, TL.ROOF_PURPLE, TL.HEDGE, TL.SHRINE, TL.WALL_IN, TL.VOID].includes(t as never); }
function landLob(p: Proj) {
  shake(1); sfx('boom'); addPart(p.x, p.y, p.col, 14, 50, 0.5);
  if (p.own === 'e') { if (p.fire) W.zones.push(zone('fire', p.x, p.y + 4, 18, 3, { own: 'e', dps: p.dmg, col: '#ff8a3a', el: 'ember' })); return; }
  if (!p.pid) { W.zones.push(zone('cloud', p.x, p.y + 4, 28, 4, { mult: p.mult * (hasFlag('caustic') ? 1.6 : 1), col: '#8fd14f' })); return; }
  const tier = p.tier || 1;
  if (p.pid === 'baneflask') W.zones.push(zone('cloud', p.x, p.y + 4, 30, 4, { dps: potionTierVal([8, 14, 22, 34], tier) * (S.craft === 'herbal' ? 1.4 : 1) * (hasFlag('caustic') ? 1.6 : 1), col: '#a25ad6' }));
  if (p.pid === 'hexfire') { const dmg = potionTierVal([40, 70, 110, 170], tier) * (S.craft === 'herbal' ? 1.4 : 1); W.fx.push({ k: 'ring', x: p.x, y: p.y, R: 34, t: 0, d: 0.3, col: '#e05a9a', lt: '#ffc8e0' }); forEnemiesIn(p.x, p.y, 34, e => hitEnemy(e, 0, { raw: dmg, kb: 20, from: p, col: '#ffc8e0' })); }
}
function updateZones(dt: number) {
  const P = W.P;
  for (const z of W.zones.slice()) {
    z.t -= dt; const armed = z.arm > 0; z.arm = Math.max(0, z.arm - dt); z.tick -= dt;
    switch (z.k) {
      case 'circle': z.x = P.x; z.y = P.y; if (z.tick <= 0) { z.tick = 0.5; forEnemiesIn(z.x, z.y - 4, z.r, e => { hitEnemy(e, z.mult, { col: z.col, noCrit: true }); e.slow = Math.max(e.slow, 0.6); }); } break;
      case 'sigil': if (z.arm <= 0) { const hit = W.enemies.find(e => !e.wild && dist(e.x, e.y, z.x, z.y) < 10 + e.r); if (hit) { z.t = 0; W.fx.push({ k: 'ring', x: z.x, y: z.y, R: z.r, t: 0, d: 0.3, col: z.col, lt: '#fff1a8' }); forEnemiesIn(z.x, z.y, z.r, e => hitEnemy(e, z.mult, { root: z.root, col: '#fff1a8' })); shake(2); sfx('boom'); } } break;
      case 'cloud': if (z.tick <= 0) { z.tick = 0.5; forEnemiesIn(z.x, z.y, z.r, e => { if (z.dps) hitEnemy(e, 0, { raw: z.dps * 0.5, dot: true, noCrit: true, col: z.col }); else hitEnemy(e, z.mult * 0.5, { dot: true, noCrit: true, col: z.col }); }); }
        if (R() < 0.5) W.parts.push({ x: z.x + (R() - 0.5) * z.r * 1.6, y: z.y + (R() - 0.5) * z.r, vx: 0, vy: -8, life: 0.6, max: 0.6, col: z.col, size: 2, grav: 0 }); break;
      case 'spike': case 'blast': if (armed && z.arm <= 0) { addPart(z.x, z.y, z.k === 'spike' ? '#8a5a3a' : z.col, 12, 60, 0.5, 2); if (dist(P.x, P.y, z.x, z.y) < z.r + 3) hurtPlayer(z.dmg || 10, null, false, z.el); if (W.pip && dist(W.pip.x, W.pip.y, z.x, z.y) < z.r) hurtPip(z.dmg || 10); if (z.r > 30) shake(4); sfx('thud'); } break;
      case 'fire': if (z.tick <= 0) { z.tick = 0.5; if (z.own === 'e') { if (dist(P.x, P.y, z.x, z.y) < z.r) hurtPlayer(z.dps * 0.5, null, false, 'ember'); } else forEnemiesIn(z.x, z.y, z.r, e => hitEnemy(e, 0, { raw: z.dps * 0.5, dot: true, noCrit: true, col: '#ffb04a', el: 'ember' })); }
        if (R() < 0.4) W.parts.push({ x: z.x + (R() - 0.5) * z.r, y: z.y - R() * 4, vx: 0, vy: -24, life: 0.4, max: 0.4, col: R() < 0.5 ? '#ffd166' : '#ff7a2a', size: 1, grav: 0 }); break;
      case 'delay': if (armed && z.arm <= 0) { W.fx.push({ k: 'ring', x: z.x, y: z.y, R: z.r, t: 0, d: 0.3, col: z.col, lt: '#ffffff' }); forEnemiesIn(z.x, z.y, z.r, e => hitEnemy(e, z.mult, { root: z.root, mark: z.marks || undefined, col: '#ffffff' }));
        if (z.cloud) W.zones.push(zone('cloud', z.x, z.y, z.r, 4, { mult: z.mult * 0.4 * (hasFlag('caustic') ? 1.6 : 1), col: '#8fd14f' })); shake(3); sfx('boom'); } break;
      case 'lantern': if (dist(P.x, P.y, z.x, z.y) < z.r) P.hp = Math.min(st().maxHp, P.hp + st().maxHp * 0.03 * dt);
        if (z.tick <= 0) { z.tick = 0.5; forEnemiesIn(z.x, z.y, z.r, e => hitEnemy(e, 0, { raw: z.dps * 0.5, dot: true, noCrit: true, col: '#ecfcff', el: 'spirit' })); } break;
    }
    if (z.t <= 0) W.zones.splice(W.zones.indexOf(z), 1);
  }
}
function updateAllies(dt: number) {
  const P = W.P;
  for (const a of W.allies.slice()) {
    a.t -= dt; a.cd -= dt; a.tick -= dt;
    if (a.k === 'minion' || a.k === 'thrall') {
      let tgt: Enemy | null = null, bd = 120; for (const e of W.enemies) { if (e.wild) continue; const d = dist(a.x, a.y, e.x, e.y); if (d < bd) { bd = d; tgt = e; } }
      if (tgt) { const ang = Math.atan2(tgt.y - a.y, tgt.x - a.x); a.face = Math.sign(tgt.x - a.x) || 1; if (bd > 12) moveBody(a, Math.cos(ang) * 60 * dt, Math.sin(ang) * 60 * dt, 'enemy'); else if (a.cd <= 0) { a.cd = 0.8; hitEnemy(tgt, 0, { raw: a.dmg, col: '#8affb0', noCrit: true }); } }
      else if (dist(a.x, a.y, P.x, P.y) > 30) { const ang = Math.atan2(P.y - a.y, P.x - a.x); moveBody(a, Math.cos(ang) * 60 * dt, Math.sin(ang) * 60 * dt, 'enemy'); }
    }
    if (a.k === 'snapvine') {
      if (a.cd <= 0) { let tgt: Enemy | null = null, bd = 40; for (const e of W.enemies) { if (e.wild) continue; const d = dist(a.x, a.y, e.x, e.y); if (d < bd) { bd = d; tgt = e; } }
        if (tgt) { a.cd = 0.7; a.face = Math.sign(tgt.x - a.x) || 1; hitEnemy(tgt, a.dmg, { col: '#c8f0a0' }); W.fx.push({ k: 'arc', x: a.x, y: a.y - 6, a: Math.atan2(tgt.y - a.y, tgt.x - a.x), t: 0, d: 0.15, R: 20, col: '#6ac04a', lt: '#c8f0a0' }); } }
      if (dist(a.x, a.y, P.x, P.y) < 40) P.hp = Math.min(st().maxHp, P.hp + st().maxHp * 0.02 * dt);
    }
    if (a.t <= 0 || a.hp <= 0) killAlly(a);
  }
}
function updateOrbs(dt: number) {
  const P = W.P;
  for (const o of W.orbs.slice()) {
    o.t -= dt; o.a += dt * 4;
    if (!o.tgt || o.tgt.hp <= 0 || !W.enemies.includes(o.tgt)) { o.tgt = null; let bd = 70; for (const e of W.enemies) { if (e.wild && !e.hurtT) continue; const d = dist(e.x, e.y, P.x, P.y); if (d < bd && (e.aggro || e.hurtT)) { bd = d; o.tgt = e; } } }
    let tx = P.x + Math.cos(o.a) * 16, ty = P.y - 10 + Math.sin(o.a) * 10; if (o.tgt) { tx = o.tgt.x; ty = o.tgt.y - 6; }
    const k = Math.min(1, dt * (o.tgt ? 7 : 10)); o.x += (tx - o.x) * k; o.y += (ty - o.y) * k;
    if (R() < 0.5) W.parts.push({ x: o.x, y: o.y, vx: 0, vy: -6, life: 0.25, max: 0.25, col: '#ffd166', size: 1, grav: 0 });
    if (o.tgt && dist(o.x, o.y, o.tgt.x, o.tgt.y - 6) < 6) { hitEnemy(o.tgt, 0, { raw: o.dmg, fam: true, col: '#ffd166', noCrit: true }); addPart(o.x, o.y, '#ff7a2a', 8, 40, 0.3); W.orbs.splice(W.orbs.indexOf(o), 1); continue; }
    if (o.t <= 0) W.orbs.splice(W.orbs.indexOf(o), 1);
  }
}
export { refresh };
