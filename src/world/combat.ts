import { T, R, clamp, dist, pick, rint } from '../core/util';
import { S, companion, famStat, hasTal, sigVal, newFamiliar, countItem, removeItem, famName } from '../core/state';
import { ENEMIES, EnemyDef, CORRUPT_SPAWNS } from '../data/enemies';
import { CRAFTS, SkillDef } from '../data/crafts';
import { SPECIES, ELEMENT_INFO, ELEMENTS } from '../data/familiars';
import { POTION, potionTierVal } from '../data/brewing';
import { makeGear, SLOTS } from '../data/gear';
import { sfx } from '../core/audio';
import { TL } from './tiles';
import {
  W, hooks, addPart, floatText, shake, moveBody, boxSolid, tileAt, giveXp, companionXp, heal, checkQuest, setTile, isNight, refresh, nearestWalkable,
} from './world';
import { rngFrom } from '../core/util';

export interface Enemy {
  uid: number; id: string; def: EnemyDef; x: number; y: number; hp: number; max: number; hw: number; hh: number; r: number; sc: number;
  face: number; aggro: boolean; home: { x: number; y: number }; wdir: { x: number; y: number }; wt: number; atk: number; cd: number;
  slow: number; burn: { t: number; tick: number; dps: number } | null; stun: number; root: number; flash: number; marks: number; markT: number;
  wild?: boolean; sp?: string; dazed: number; hurtT: number; tag?: string; swoop: number; sa: number; tele: number; charge: number; ca: number;
  phase: number; summoned: number; net: number; ally?: boolean;
}
export interface Proj {
  x: number; y: number; vx: number; vy: number; r: number; own: 'p' | 'e' | 'f' | 'a'; mult: number; dmg: number; life: number; pierce: number;
  col: string; lt: string; hits: Set<Enemy>; mark?: boolean; kind?: 'net' | 'lob' | 'bolt'; tx?: number; ty?: number; sx?: number; sy?: number; t?: number; T?: number; pid?: string; tier?: number; z?: number;
}
export interface Zone { k: 'sigil' | 'cloud' | 'circle' | 'rootspike'; x: number; y: number; r: number; t: number; arm: number; dps: number; mult: number; tick: number; own: 'p' | 'e'; col: string }
export interface Ally { k: 'minion' | 'thrall' | 'snapvine' | 'poppet'; id?: string; x: number; y: number; hw: number; hh: number; hp: number; max: number; t: number; cd: number; dmg: number; face: number; tick: number }

let uid = 1;
const st = () => W.st;

// ---------- spawning ----------
function mkEnemy(id: string, x: number, y: number, def?: EnemyDef): Enemy {
  const d = def || ENEMIES[id]; const sc = d.scale || 1;
  return { uid: uid++, id, def: d, x, y, hp: d.hp, max: d.hp, hw: sc > 1 ? 10 : 5, hh: sc > 1 ? 6 : 4, r: sc > 1 ? 13 : 7, sc, face: 1, aggro: false, home: { x, y }, wdir: { x: 0, y: 0 }, wt: R() * 2,
    atk: 0, cd: R() * 2, slow: 0, burn: null, stun: 0, root: 0, flash: 0, marks: 0, markT: 0, dazed: 0, hurtT: 0, swoop: 0, sa: 0, tele: 0, charge: 0, ca: 0, phase: 0, summoned: 0, net: 6 };
}
export function spawnEnemy(id: string, x: number, y: number, tag?: string): Enemy { const e = mkEnemy(id, x, y); e.tag = tag; W.enemies.push(e); return e; }
function randomOpen(minDist: number, filter?: (i: number) => boolean): { x: number; y: number } | null {
  const m = W.map; for (let k = 0; k < 200; k++) { const i = m.open[Math.floor(R() * m.open.length)]; if (filter && !filter(i)) continue; const x = (i % m.w) * T + 8, y = ((i / m.w) | 0) * T + 8;
    if (dist(x, y, W.P.x, W.P.y) < minDist) continue; if (dist(x, y, m.entries.w.x, m.entries.w.y) < 8 * T) continue; if (boxSolid(x, y, 5, 4, 'walk')) continue; return { x, y }; } return null;
}
function nearBlight(i: number): boolean { const m = W.map; const x = i % m.w, y = (i / m.w) | 0; for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) { const j = (y + dy) * m.w + x + dx; if (W.m[j] === TL.BLIGHT) return true; } return false; }
function spawnCorrupt(initial: boolean) {
  const blightLeft = !S.flags.cleansed; const p = randomOpen(initial ? 9 * T : 13 * T, i => !blightLeft || R() < 0.25 || nearBlight(i)); if (!p) return;
  let id = pick(CORRUPT_SPAWNS); if (id === 'rotcrow' && !isNight() && R() < 0.5) id = 'thornrat'; spawnEnemy(id, p.x, p.y, 'corrupt');
}
const WILD_DAY = ['sparkit', 'fluffowl', 'dirtnib', 'pebbleshell', 'puddlewog'];
const WILD_NIGHT = ['wickmoth', 'wickmoth', 'fluffowl', 'sparkit', 'flitbat', 'driftjel'];
export function spawnWild(sp?: string) {
  const s = sp || pick(isNight() ? WILD_NIGHT : WILD_DAY); const nearPond = s === 'puddlewog' || s === 'driftjel';
  let p: { x: number; y: number } | null = null;
  if (nearPond) { const g = W.map.regions[R() < 0.5 ? 'pond1' : 'pond2']; for (let k = 0; k < 40 && !p; k++) { const a = R() * Math.PI * 2, rr = (g.r + 1 + R() * 2) * T; const x = g.x * T + 8 + Math.cos(a) * rr, y = g.y * T + 8 + Math.sin(a) * rr; if (!boxSolid(x, y, 5, 4, 'walk')) p = { x, y }; } }
  if (!p) p = randomOpen(12 * T); if (!p) return;
  const sd = SPECIES[s]; const d: EnemyDef = { id: 'wild', name: 'Wild ' + sd.names[0], faction: 'wild', sprite: sd.shape, pal: sd.pal, hp: 70, dmg: 6, spd: 44, xp: 0, gold: [0, 0], ai: 'chase', lvl: 1, drops: [], fly: sd.fly };
  const e = mkEnemy('wild', p.x, p.y, d); e.wild = true; e.sp = s; W.enemies.push(e);
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
  for (const e of W.enemies) if (boxSolid(e.x, e.y, e.hw, e.hh, 'walk')) { const n = nearestWalkable(e.x, e.y); if (n) { e.x = n.x; e.y = n.y; e.home = { ...n }; } }
  if (S.flags.halloranActive && !S.bosses.halloran) { const h = m.regions.hideout; const hx = h.x * T + 8, hy = h.y * T + 8; spawnEnemy('halloran', hx + 30, hy - 10, 'hunt'); spawnEnemy('warden', hx + 10, hy + 20, 'hunt'); spawnEnemy('warden', hx - 20, hy + 16, 'hunt'); spawnEnemy('novice', hx + 40, hy + 12, 'hunt'); }
  if (!S.bosses.rootmaw) { const h = m.regions.hollow; const e = spawnEnemy('rootmaw', h.x * T + 8, h.y * T + 8, 'boss'); e.home = { x: e.x, y: e.y }; }
  if (!isNight()) spawnPatrol();
  spawnWild(); spawnWild();
}

// ---------- casting ----------
export function aimVec(aim?: { x: number; y: number }) {
  const P = W.P; let tx: number, ty: number;
  if (aim) { tx = aim.x; ty = aim.y; } else if (W.aim.mouse && W.clock - W.aim.t < 4) { tx = W.aim.x; ty = W.aim.y; } else { tx = P.x + P.fx * 60; ty = P.y - 7 + P.fy * 60; }
  let dx = tx - P.x, dy = ty - (P.y - 7); const l = Math.hypot(dx, dy) || 1; return { dx: dx / l, dy: dy / l, tx, ty, d: l };
}
export function castSkill(slot: number, aim?: { x: number; y: number }) {
  const P = W.P; if (P.dead > 0 || P.air > 0) return;
  if (P.flying) { if (W.clock - W.flyWarn > 2) { W.flyWarn = W.clock; hooks.toast('You cannot cast while flying. Land with B.', 'dim'); } return; }
  const cd = CRAFTS[S.craft]; const lvl = S.crafts[S.craft]!.lvl; let ab: SkillDef = cd.skills[slot];
  if (P.wild > 0 && slot === 0) ab = { ...cd.skills[0], name: 'Bite', mult: 1.6, rad: 30 };
  if (lvl < ab.lvl) { hooks.toast(`${ab.name} unlocks at ${cd.name} Lv ${ab.lvl}.`, 'dim'); return; }
  if (P.cd[slot] > 0) return; if (P.mp < ab.mp) { hooks.toast('Not enough MP.', 'dim'); return; }
  P.mp -= ab.mp; P.cd[slot] = ab.cd * (1 - Math.min(0.35, st().haste * 0.005)); P.cdMax[slot] = P.cd[slot];
  const a = aimVec(aim); P.fx = a.dx; P.fy = a.dy; const ox = P.x, oy = P.y - 7;
  const el = st().el ? ELEMENT_INFO[st().el as keyof typeof ELEMENT_INFO] : null; const col = el ? el.col : cd.col, lt = cd.light;
  const clampTo = (range: number) => { const d = Math.min(a.d, range); return { x: ox + a.dx * d, y: oy + a.dy * d + 7 }; };
  switch (ab.kind) {
    case 'proj': W.proj.push({ x: ox + a.dx * 6, y: oy + a.dy * 6, vx: a.dx * ab.spd!, vy: a.dy * ab.spd!, r: ab.r!, own: 'p', mult: ab.mult, dmg: 0, life: 0.9, pierce: ab.pierce || 0, col: cd.col, lt, hits: new Set(), mark: ab.mark }); sfx('shoot'); break;
    case 'melee': { const a0 = Math.atan2(a.dy, a.dx); const rad = ab.rad!; W.fx.push({ k: 'arc', x: ox, y: oy + 2, a: a0, t: 0, d: 0.18, R: rad, col: P.wild > 0 && el ? el.col : cd.col, lt });
      forEnemiesIn(ox, oy + 2, rad + 4, e => { const ang = Math.atan2((e.y - 4) - (oy + 2), e.x - ox); const da = Math.abs(((ang - a0) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (da < 1.3 || dist(e.x, e.y, ox, oy) < 12) hitEnemy(e, ab.mult, { kb: S.craft === 'herbal' ? 34 : 18, from: P, col: lt }); });
      sfx('thud'); break; }
    case 'sigil': { const p = clampTo(ab.range!); const mine = W.zones.filter(z => z.k === 'sigil'); if (mine.length >= 3) W.zones.splice(W.zones.indexOf(mine[0]), 1);
      W.zones.push({ k: 'sigil', x: p.x, y: p.y, r: ab.rad!, t: 20 + lvl, arm: 0.4, dps: 0, mult: ab.mult, tick: 0, own: 'p', col: cd.col }); sfx('buff'); break; }
    case 'circle': W.zones.push({ k: 'circle', x: P.x, y: P.y, r: ab.rad!, t: ab.dur!, arm: 0, dps: 0, mult: ab.mult, tick: 0, own: 'p', col: cd.col }); P.circle = ab.dur!; sfx('buff'); break;
    case 'poppet': { const p = clampTo(ab.range!); const old = W.allies.find(x => x.k === 'poppet'); if (old) W.allies.splice(W.allies.indexOf(old), 1);
      W.allies.push({ k: 'poppet', x: p.x, y: p.y, hw: 5, hh: 4, hp: st().maxHp * 0.45, max: st().maxHp * 0.45, t: ab.dur!, cd: 0, dmg: ab.mult, face: 1, tick: 0 }); addPart(p.x, p.y - 6, '#f2c14e', 10, 40); sfx('plant'); break; }
    case 'thread': { let n = 0; for (const e of W.enemies.slice()) { if (e.marks > 0 && onScreen(e)) { const m = e.marks; e.marks = 0; hitEnemy(e, ab.mult * m, { col: '#ffc8d8', stun: 1, noMark: true }); W.fx.push({ k: 'line', x: P.x, y: P.y - 8, tx: e.x, ty: e.y - 6, t: 0, d: 0.25, R: 0, col: '#ffc8d8', lt }); n++; } }
      if (!n) hooks.toast('No Marked enemies. Hit them with Pins first.', 'dim'); sfx('boom'); break; }
    case 'flask': { const p = clampTo(ab.range!); W.proj.push({ x: ox, y: oy, vx: 0, vy: 0, r: 3, own: 'p', mult: ab.mult, dmg: 0, life: 9, pierce: 0, col: '#8fd14f', lt: '#d8ffb0', hits: new Set(), kind: 'lob', tx: p.x, ty: p.y - 4, sx: ox, sy: oy, t: 0, T: 0.5, z: 0 }); sfx('whoosh'); break; }
    case 'snapvine': { const p = clampTo(ab.range!); const old = W.allies.filter(x => x.k === 'snapvine'); if (old.length >= 1) W.allies.splice(W.allies.indexOf(old[0]), 1);
      W.allies.push({ k: 'snapvine', x: p.x, y: p.y, hw: 5, hh: 4, hp: 999, max: 999, t: ab.dur!, cd: 0.3, dmg: ab.mult, face: 1, tick: 0 }); addPart(p.x, p.y, '#6ac04a', 16, 50, 0.5, 1, 40); sfx('plant'); break; }
    case 'pounce': { const p = clampTo(ab.range!); const dx = p.x - P.x, dy = p.y - P.y; P.air = 0.28; P.dashT = 0.28; P.dashV = { x: dx / 0.28, y: dy / 0.28 }; P.inv = Math.max(P.inv, 0.35);
      setTimeout(() => { forEnemiesIn(P.x, P.y - 4, ab.rad!, e => hitEnemy(e, ab.mult, { kb: 24, from: P, col: lt })); W.fx.push({ k: 'ring', x: P.x, y: P.y - 2, R: ab.rad!, t: 0, d: 0.25, col, lt }); shake(3); sfx('thud'); }, 280); sfx('dash'); break; }
    case 'wildshape': P.wild = ab.dur!; addPart(P.x, P.y - 8, col, 30, 60, 0.8); hooks.toast(companion() ? `You take the shape of your ${SPECIES[companion()!.sp].names[0]}.` : 'You take a wild shape.', 'good'); sfx('evolve'); break;
    case 'raise': { const cs = W.corpses.filter(c => dist(c.x, c.y, P.x, P.y) < ab.range!).slice(0, 2);
      if (cs.length) for (const c of cs) { W.corpses.splice(W.corpses.indexOf(c), 1); const d = ENEMIES[c.id]; W.allies.push({ k: 'minion', id: c.id, x: c.x, y: c.y, hw: 5, hh: 4, hp: d.hp * 0.6, max: d.hp * 0.6, t: ab.dur!, cd: 0.5, dmg: d.dmg * 0.8 + st().pow * 0.3, face: 1, tick: 0 }); addPart(c.x, c.y - 6, '#8affb0', 16, 40, 0.6, 1, -30); }
      else { const p = clampTo(40); W.allies.push({ k: 'thrall', x: p.x, y: p.y, hw: 4, hh: 3, hp: st().maxHp * 0.3, max: st().maxHp * 0.3, t: ab.dur!, cd: 0.5, dmg: st().pow * 0.5, face: 1, tick: 0 }); addPart(p.x, p.y - 6, '#d8d0ff', 16, 40, 0.6, 1, -30); }
      sfx('evolve'); break; }
    case 'pulse': { let total = 0; W.fx.push({ k: 'ring', x: ox, y: oy + 3, R: ab.rad!, t: 0, d: 0.35, col: cd.col, lt }); forEnemiesIn(ox, oy + 3, ab.rad!, e => { total += hitEnemy(e, ab.mult, { col: lt, kb: 10, from: P }); }); if (total) heal(total * 0.3); shake(3); sfx('boom'); break; }
  }
}
export function throwPotion(pid: string, tier: number, aim: { x: number; y: number }) {
  const P = W.P; const ox = P.x, oy = P.y - 7; let dx = aim.x - ox, dy = aim.y - oy; const d = Math.hypot(dx, dy); const m = Math.min(d, 110) / (d || 1);
  W.proj.push({ x: ox, y: oy, vx: 0, vy: 0, r: 3, own: 'p', mult: 0, dmg: 0, life: 9, pierce: 0, col: POTION[pid].col, lt: '#ffffff', hits: new Set(), kind: 'lob', tx: ox + dx * m, ty: oy + dy * m, sx: ox, sy: oy, t: 0, T: 0.5, z: 0, pid, tier });
  sfx('whoosh');
}
function onScreen(e: { x: number; y: number }) { return Math.abs(e.x - W.P.x) < 220 && Math.abs(e.y - W.P.y) < 130; }
export function forEnemiesIn(x: number, y: number, rad: number, fn: (e: Enemy) => void) { for (const e of W.enemies.slice()) { if (e.hp <= 0 && !e.wild) continue; if (dist(e.x, e.y - 4 * e.sc, x, y) <= rad + e.r) fn(e); } }

// ---------- damage ----------
interface HitOpts { kb?: number; from?: { x: number; y: number }; stun?: number; root?: number; col?: string; noCrit?: boolean; dot?: boolean; raw?: number; noMark?: boolean; fam?: boolean; mark?: boolean }
export function hitEnemy(e: Enemy, mult: number, o: HitOpts = {}): number {
  if (e.hp <= 0 && !e.wild) return 0; const s = st(); const P = W.P;
  let d = o.raw ?? s.pow * mult * s.famMult * (1 + s.aff / 100) * (P.wild > 0 && !o.fam ? 1.4 : 1) * (0.9 + R() * 0.2);
  if (e.def.dr) d *= 1 - e.def.dr;
  const crit = !o.noCrit && !o.dot && R() < s.crit; if (crit) d *= 1.75; d = Math.max(1, Math.round(d));
  e.hp -= d; e.flash = 0.12; e.aggro = true; e.hurtT = 4; P.combat = 4;
  floatText(e.x, e.y - 14 * e.sc, d, crit ? '#ffd166' : o.dot ? '#ffb04a' : '#ffffff');
  if (o.kb && e.sc === 1 && !e.def.boss) { const f = o.from || P; const a = Math.atan2(e.y - f.y, e.x - f.x); const kb = o.kb * (s.el === 'stone' ? 1.5 : 1); moveBody(e, Math.cos(a) * kb * 0.5, Math.sin(a) * kb * 0.5, e.def.fly ? 'fly' : 'enemy'); }
  if (o.stun) e.stun = Math.max(e.stun, e.def.boss || e.def.elite ? o.stun * 0.3 : o.stun);
  if (o.root) e.root = Math.max(e.root, e.def.boss || e.def.elite ? o.root * 0.3 : o.root);
  if (o.mark && !o.noMark) { e.marks = Math.min(5, e.marks + 1); e.markT = 8; }
  const c = companion();
  if (!o.dot && c) {
    const el = SPECIES[c.sp].el;
    if ((el === 'ember' && R() < 0.15) || (c.sp === 'sparkit' && R() < sigVal(c) / 100)) { e.burn = { t: 3, tick: 0.5, dps: s.pow * 0.35 }; }
    if (el === 'tide') e.slow = Math.max(e.slow, 1.2);
    if (c.sp === 'driftjel') e.slow = Math.max(e.slow, sigVal(c));
    if (c.sp === 'flitbat' && P.hp < s.maxHp) P.hp = Math.min(s.maxHp, P.hp + d * sigVal(c) / 100);
  }
  addPart(e.x, e.y - 6 * e.sc, o.col || '#ffffff', crit ? 8 : 4, 50, 0.3);
  if (!o.dot) sfx('hit');
  if (e.wild) { if (e.hp < e.max * 0.35 && !e.dazed) { e.dazed = 8; hooks.toast(`${e.def.name} is dazed! Press <b>E</b> beside it to bind it.`, 'good'); } if (e.dazed) { e.hp = Math.max(1, e.hp); e.dazed = Math.max(e.dazed, 3); } return d; }
  if (e.hp <= 0) killEnemy(e);
  return d;
}
function dropAt(x: number, y: number, id: string, q: number, n = 1) { W.pickups.push({ k: 'item', id, q, n, x: x + rint(-6, 6), y: y + rint(-4, 4), t: 0 }); }
export function killEnemy(e: Enemy) {
  e.hp = 0; const d = e.def; addPart(e.x, e.y - 6, d.pal.a || '#ffffff', e.def.boss ? 40 : 12, e.def.boss ? 90 : 50, e.def.boss ? 1 : 0.6, e.def.boss ? 2 : 1);
  const i = W.enemies.indexOf(e); if (i >= 0) W.enemies.splice(i, 1);
  S.kills[e.id] = (S.kills[e.id] || 0) + 1; S.factionKills[d.faction] = (S.factionKills[d.faction] || 0) + 1;
  giveXp(d.xp); companionXp(d.xp);
  const c = companion(); const pros = c && c.sp === 'dirtnib' ? sigVal(c) / 100 : 0; const lucky = c && hasTal(c, 'lucky') ? 0.15 : 0;
  const gold = Math.round(rint(d.gold[0], d.gold[1]) * (1 + pros + lucky)); if (gold) W.pickups.push({ k: 'gold', n: gold, x: e.x, y: e.y, t: 0 });
  if (c && c.sp === 'wickmoth') W.P.mp = Math.min(st().maxMp, W.P.mp + sigVal(c));
  const q = d.boss || d.elite ? 2 : 1;
  for (const dr of d.drops) if (R() < dr.p) dropAt(e.x, e.y, dr.id, q, dr.n ? rint(dr.n[0], dr.n[1]) : 1);
  W.corpses.push({ id: e.id, x: e.x, y: e.y, t: 10 });
  if (d.boss || d.elite) {
    S.bosses[e.id] = 1; shake(6); sfx('level'); hooks.banner('VICTORY', `${d.name} has fallen`);
    for (let k = 0; k < 3; k++) dropAt(e.x, e.y, 'ess_' + pick(ELEMENTS), 0);
    W.pickups.push({ k: 'gear', n: 1, gear: makeGear(pick(SLOTS), d.lvl, 2), x: e.x + 10, y: e.y, t: 0 });
    W.pickups.push({ k: 'gear', n: 1, gear: makeGear(pick(SLOTS), d.lvl, 1), x: e.x - 10, y: e.y, t: 0 });
    if (e.id === 'rootmaw') cleanseForest();
    if (e.id === 'halloran') { for (const o of W.enemies.filter(x => x.tag === 'hunt')) { addPart(o.x, o.y - 6, '#ffffff', 10, 40); W.enemies.splice(W.enemies.indexOf(o), 1); }
      hooks.say([{ who: 'Ysolde', text: 'You… you actually beat a Witchfinder. Thank you. I am going to Hollowmere, where there are others like us. Find me there.' }]); }
    if (e.id === 'mags') hooks.toast('Mags Redhand is down. The bounty can be claimed at the Hollowmere order board.', 'good');
  } else {
    if (R() < 0.05 * (1 + pros * 2)) { const rr = R(); W.pickups.push({ k: 'gear', n: 1, gear: makeGear(pick(SLOTS), clamp(d.lvl + rint(-1, 1), 1, 20), rr < 0.04 ? 2 : rr < 0.3 ? 1 : 0), x: e.x + 4, y: e.y, t: 0 }); }
    if (R() < 0.06) dropAt(e.x, e.y, 'ess_' + pick(ELEMENTS), 0);
  }
  checkQuest();
}
function cleanseForest() {
  S.flags.cleansed = true; const r = rngFrom(77);
  for (const i of W.map.blight) { if (r() < 0.15) continue; if (W.m[i] === TL.BLIGHT || W.m[i] === TL.DEADTREE) { setTile(i, W.m[i] === TL.DEADTREE ? TL.TREE : TL.GRASS); if (R() < 0.08) addPart((i % W.map.w) * T + 8, ((i / W.map.w) | 0) * T + 8, '#fff6c0', 4, 30, 0.8, 1, -20); } }
  hooks.banner('THE ROT LIFTS', 'Brindlewood breathes again');
}
export function hurtPlayer(raw: number, src: Enemy | null, melee: boolean) {
  const P = W.P; if (P.inv > 0 || P.dead > 0 || P.air > 0) return;
  if (P.flying && melee && !(src && src.def.fly)) return;
  const s = st(); let d = raw * 60 / (60 + s.ward);
  if (P.buffs.ward) d *= 1 - P.buffs.ward.v / 100; if (P.circle > 0) d *= 0.7;
  d = Math.max(1, Math.round(d * (0.9 + R() * 0.2)));
  P.hp -= d; P.inv = 0.6; P.combat = 4; floatText(P.x, P.y - 20, d, '#ff7a7a'); sfx('hurt'); shake(2);
  if (melee && src && src.hp > 0) { const c = companion(); let refl = 0; if (c && c.sp === 'pebbleshell') refl += sigVal(c) / 100; if (P.buffs.thorn) refl += P.buffs.thorn.v / 100;
    if (refl > 0) { const rd = Math.max(1, Math.round(raw * refl)); src.hp -= rd; src.flash = 0.1; floatText(src.x, src.y - 14, rd, '#ead2a2'); if (src.hp <= 0 && !src.wild) killEnemy(src); } }
  if (P.hp <= 0) { P.hp = 0; P.dead = 1.6; P.flying = false; hooks.toast('You fainted…', 'bad'); sfx('fail'); }
}

// ---------- binding ----------
export function tryBind(w: Enemy) {
  if (countItem('charm') <= 0) { hooks.toast('You need a Binding Charm. Marrow sells them in Hollowmere.', 'bad'); return; }
  removeItem('charm', 1); hooks.hud();
  const chance = w.dazed > 0 ? 0.6 + (1 - w.hp / w.max) * 0.35 : 0.06;
  W.fx.push({ k: 'sigil', x: w.x, y: w.y - 6, t: 0, d: 0.6, R: 0, col: '#f2c14e', lt: '#fff' });
  if (R() < chance) {
    W.enemies.splice(W.enemies.indexOf(w), 1); sfx('bind'); addPart(w.x, w.y - 6, '#f2c14e', 30, 70, 1);
    S.binds++;
    if (S.fams.length >= 16) { hooks.toast('Your roost is full (16). The familiar leaves you some Familiar Down instead.', 'dim'); W.pickups.push({ k: 'item', id: 'familiardown', q: 2, n: 2, x: w.x, y: w.y, t: 0 }); }
    else { const f = newFamiliar(w.sp!, R, 'wild'); S.fams.push(f); hooks.banner('BOUND!', `${SPECIES[f.sp].names[0]} joined your coven`); hooks.toast(`Visit your roost or press F to give ${famName(f)} a job. Every familiar rolls its own stats.`, 'good'); }
    giveXp(15); W.wildT = 35; checkQuest();
  } else { sfx('fail'); hooks.toast(`${w.def.name} broke free!`, 'bad'); w.dazed = Math.max(w.dazed, 0.5); }
}

// ---------- update ----------
type Target = { x: number; y: number; ally?: Ally; player?: boolean; fly?: boolean };
function chooseTarget(e: Enemy): Target {
  const P = W.P; const pop = W.allies.find(a => a.k === 'poppet' && dist(a.x, a.y, e.x, e.y) < 150);
  if (pop) return { x: pop.x, y: pop.y, ally: pop };
  let best: Target = { x: P.x, y: P.y, player: true, fly: P.flying }; let bd = dist(P.x, P.y, e.x, e.y);
  for (const a of W.allies) { if (a.k === 'snapvine') continue; const d = dist(a.x, a.y, e.x, e.y); if (d < bd - 20) { bd = d; best = { x: a.x, y: a.y, ally: a }; } }
  return best;
}
function enemyShoot(e: Enemy, a: number, spd: number, mul = 1, kind?: 'net') {
  W.proj.push({ x: e.x, y: e.y - 6 * e.sc, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: kind ? 4 : 3, own: 'e', mult: 0, dmg: e.def.dmg * mul, life: 2.6, pierce: 0, col: kind ? '#e9dfc7' : e.def.pcol || '#c890ff', lt: '#ffffff', hits: new Set(), kind });
}
function summon(e: Enemy, id: string, n: number) { for (let k = 0; k < n; k++) { const a = R() * Math.PI * 2; const s = spawnEnemy(id, e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, 'summon'); s.aggro = true; if (boxSolid(s.x, s.y, s.hw, s.hh, 'enemy')) { s.x = e.x; s.y = e.y; } addPart(s.x, s.y - 6, '#ffffff', 8, 40); } }
const AGGRO: Record<string, number> = { corrupt: 85, bandit: 100, order: 135, wild: 0 };
export function updateCombat(dt: number) {
  const P = W.P;
  if (!W.map.safe) {
    W.spawnT -= dt; const normal = W.enemies.filter(e => e.tag === 'corrupt').length; const cap = S.flags.cleansed ? 6 : 14;
    if (W.spawnT <= 0) { W.spawnT = 6; if (normal < cap) spawnCorrupt(false); }
    if (!W.enemies.some(e => e.wild)) { W.wildT -= dt; if (W.wildT <= 0) { spawnWild(); W.wildT = 35; } }
    W.patrolT -= dt; if (W.patrolT <= 0) { W.patrolT = 75; if (!isNight() && !W.enemies.some(e => e.tag === 'patrol')) spawnPatrol(); }
    W.banditT -= dt; if (W.banditT <= 0) { W.banditT = 50; if (W.enemies.filter(e => e.tag === 'camp').length < 4) { const c = W.map.regions.camp; spawnEnemy(R() < 0.5 ? 'roadcutter' : 'slinger', c.x * T + 8 + rint(-30, 30), c.y * T + 8 + rint(-20, 20), 'camp'); } }
  }
  // companion familiar attacks
  const c = companion(); W.F.cd -= dt;
  if (c && W.F.cd <= 0 && !P.flying && P.dead <= 0) {
    let tgt: Enemy | null = null, bd = 80; for (const e of W.enemies) { if (e.wild && !e.hurtT) continue; if (!e.aggro && !e.hurtT) continue; const d = dist(e.x, e.y, W.F.x, W.F.y); if (d < bd) { bd = d; tgt = e; } }
    if (tgt) { const el = SPECIES[c.sp].el, ec = ELEMENT_INFO[el]; const a = Math.atan2(tgt.y - 6 - W.F.y, tgt.x - W.F.x); const might = famStat(c, 'might');
      W.proj.push({ x: W.F.x, y: W.F.y - 6, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 2, own: 'f', mult: 0, dmg: (3 + might * 0.45) * (1 + 0.2 * (c.stage - 1)) * (hasTal(c, 'fierce') ? 1.15 : 1), life: 0.8, pierce: 0, col: ec.col, lt: ec.light, hits: new Set() });
      W.F.cd = el === 'gale' ? 1.0 : 1.5; W.F.hits++; if (el === 'tide' && W.F.hits % 3 === 0) heal(st().maxHp * 0.03); }
  }
  // enemies
  let boss: Enemy | null = null;
  for (const e of W.enemies.slice()) {
    e.flash = Math.max(0, e.flash - dt); e.atk = Math.max(0, e.atk - dt); e.slow = Math.max(0, e.slow - dt); e.hurtT = Math.max(0, e.hurtT - dt); e.root = Math.max(0, e.root - dt);
    if (e.markT > 0) { e.markT -= dt; if (e.markT <= 0) e.marks = 0; }
    if (e.burn) { e.burn.t -= dt; e.burn.tick -= dt; if (e.burn.tick <= 0) { e.burn.tick = 0.5; hitEnemy(e, 0, { raw: e.burn.dps * 0.5, dot: true, noCrit: true }); if (e.hp <= 0 && !e.wild) continue; }
      if (e.burn && e.burn.t <= 0) e.burn = null; if (e.burn && R() < 0.3) W.parts.push({ x: e.x + R() * 8 - 4, y: e.y - 8, vx: 0, vy: -20, life: 0.3, max: 0.3, col: '#ffb04a', size: 1, grav: 0 }); }
    if (e.stun > 0) { e.stun -= dt; continue; }
    const tgt = chooseTarget(e); const d = dist(e.x, e.y, tgt.x, tgt.y); const dp = dist(e.x, e.y, P.x, P.y);
    const spd = e.def.spd * (e.slow > 0 ? 0.55 : 1) * (e.root > 0 ? 0 : 1); const mode = e.def.fly ? 'fly' : 'enemy';
    if (e.wild) {
      if (e.dazed > 0) { e.dazed -= dt; if (e.dazed <= 0) { e.hp = Math.max(e.hp, e.max * 0.5); hooks.toast(`${e.def.name} shook off the daze.`, 'dim'); } continue; }
      if (e.hurtT > 0 && dp < 130) { const a = Math.atan2(P.y - e.y, P.x - e.x); moveBody(e, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, mode); e.face = Math.sign(P.x - e.x) || 1; if (dp < e.r + 6 && e.atk <= 0) { e.atk = 1.2; hurtPlayer(e.def.dmg, e, true); } }
      else wander(e, dt, spd * 0.6, mode);
      if (R() < 0.06) W.parts.push({ x: e.x + R() * 14 - 7, y: e.y - 6 - R() * 10, vx: 0, vy: -12, life: 0.5, max: 0.5, col: '#f2c14e', size: 1, grav: 0 });
      continue;
    }
    if (e.def.boss || e.def.elite) { if (dp < (e.def.boss ? 140 : 120)) e.aggro = true; if (e.aggro) { boss = e; bossAI(e, dt, tgt, d, spd); }
      if (e.aggro && (dp > 320 || P.dead > 0)) { e.aggro = false; e.hp = e.max; e.x = e.home.x; e.y = e.home.y; e.summoned = 0; } continue; }
    const ag = AGGRO[e.def.faction] || 90;
    if (!e.aggro && dp < ag && P.dead <= 0) { e.aggro = true; if (e.def.faction === 'order' && R() < 0.4) say(e, pick(['Witch!', 'Heretic!', 'Halt!', 'For Grace!'])); if (e.def.faction === 'bandit' && R() < 0.3) say(e, pick(['Your purse!', 'Get her!', 'Oi!'])); }
    if (e.aggro && (dp > 240 || P.dead > 0)) e.aggro = false;
    if (e.aggro) {
      const a = Math.atan2(tgt.y - e.y, tgt.x - e.x); e.face = Math.sign(tgt.x - e.x) || 1;
      switch (e.def.ai) {
        case 'ranged': { const want = d > 95 ? 1 : d < 60 ? -1 : 0; moveBody(e, Math.cos(a) * spd * dt * want, Math.sin(a) * spd * dt * want, mode); e.cd -= dt; if (e.cd <= 0) { e.cd = 2.1; enemyShoot(e, a, 95); } break; }
        case 'swoop': { e.cd -= dt; if (e.cd <= 0) { e.swoop = 0.7; e.cd = 1.8; e.sa = a; } if (e.swoop > 0) { e.swoop -= dt; moveBody(e, Math.cos(e.sa) * spd * 1.9 * dt, Math.sin(e.sa) * spd * 1.9 * dt, mode); } else moveBody(e, Math.cos(a + 1.4) * spd * 0.4 * dt, Math.sin(a + 1.4) * spd * 0.4 * dt, mode); break; }
        default: if (!(tgt.player && tgt.fly && !e.def.fly && d < 20)) moveBody(e, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, mode);
      }
      if (d < e.r + 6 && e.atk <= 0) { e.atk = 1.0; if (tgt.ally) damageAlly(tgt.ally, e.def.dmg); else hurtPlayer(e.def.dmg, e, true); }
    } else wander(e, dt, spd * 0.4, mode);
  }
  W.bossRef = boss;
  updateProj(dt); updateZones(dt); updateAllies(dt);
  if (P.circle > 0) P.circle -= dt;
}
function say(e: Enemy, txt: string) { W.floats.push({ x: e.x, y: e.y - 22, txt, col: '#e9dfc7', life: 1.6 }); }
function wander(e: Enemy, dt: number, spd: number, mode: 'fly' | 'enemy') {
  e.wt -= dt; if (e.wt <= 0) { e.wt = 1 + R() * 2.5; const hd = dist(e.home.x, e.home.y, e.x, e.y);
    if (hd > 80) { const a = Math.atan2(e.home.y - e.y, e.home.x - e.x); e.wdir = { x: Math.cos(a), y: Math.sin(a) }; } else if (R() < 0.35) e.wdir = { x: 0, y: 0 }; else { const a = R() * Math.PI * 2; e.wdir = { x: Math.cos(a), y: Math.sin(a) }; } }
  if (e.wdir.x || e.wdir.y) { moveBody(e, e.wdir.x * spd * dt, e.wdir.y * spd * dt, mode); if (e.wdir.x) e.face = Math.sign(e.wdir.x); }
}
function bossAI(e: Enemy, dt: number, tgt: Target, d: number, spd: number) {
  const P = W.P; const a = Math.atan2(tgt.y - e.y, tgt.x - e.x); e.face = Math.sign(tgt.x - e.x) || 1; e.cd -= dt;
  switch (e.def.ai) {
    case 'boss_root':
      moveBody(e, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, 'enemy');
      if (e.cd <= 0) { e.cd = 3; e.phase++; if (e.phase % 2) { const n = 12, off = R(); for (let k = 0; k < n; k++) enemyShoot(e, off + k * Math.PI * 2 / n, 78, 0.75); shake(2); }
        else { for (let k = 0; k < 3; k++) W.zones.push({ k: 'rootspike', x: P.x + rint(-20, 20), y: P.y + rint(-14, 14), r: 14, t: 1.4, arm: 0.8, dps: 0, mult: e.def.dmg * 1.2, tick: 0, own: 'e', col: '#b88aff' }); } }
      if (e.hp < e.max * 0.5 && e.summoned < 1) { e.summoned = 1; summon(e, 'snagstump', 2); hooks.toast('Old Rootmaw calls its saplings!', 'bad'); }
      if (e.hp < e.max * 0.25 && e.summoned < 2) { e.summoned = 2; summon(e, 'mossblob', 3); }
      break;
    case 'brute': // Mags Redhand: telegraphed charges
      e.ca = e.ca || 0;
      if (e.tele > 0) { e.tele -= dt; if (e.tele <= 0) { e.charge = 0.55; e.ca = Math.atan2(P.y - e.y, P.x - e.x); } }
      else if (e.charge > 0) { e.charge -= dt; moveBody(e, Math.cos(e.ca) * 190 * dt, Math.sin(e.ca) * 190 * dt, 'enemy'); if (R() < 0.6) addPart(e.x, e.y, '#c8a070', 2, 20, 0.3); }
      else { moveBody(e, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, 'enemy'); if (e.cd <= 0) { e.cd = 3.5; e.tele = 0.6; e.flash = 0.6; say(e, pick(['Hold still!', 'Mine!'])); } }
      if (e.hp < e.max * 0.5 && e.summoned < 1) { e.summoned = 1; summon(e, 'slinger', 2); hooks.toast('Mags whistles for her slingers!', 'bad'); }
      break;
    case 'netter': { // Witchfinder Halloran
      const want = d > 110 ? 1 : d < 70 ? -1 : 0; moveBody(e, Math.cos(a) * spd * dt * want, Math.sin(a) * spd * dt * want, 'enemy');
      if (e.cd <= 0) { e.cd = 2.4; for (let k = -2; k <= 2; k++) enemyShoot(e, a + k * 0.2, 105, 0.7); }
      e.net -= dt; if (e.net <= 0) { e.net = P.flying ? 3 : 6; enemyShoot(e, Math.atan2(P.y - 6 - e.y, P.x - e.x), 150, 0.4, 'net'); say(e, P.flying ? 'Down, witch!' : 'Bind her!'); }
      if (e.hp < e.max * 0.5 && e.summoned < 1) { e.summoned = 1; summon(e, 'novice', 2); hooks.toast('Halloran calls for his novices!', 'bad'); }
      break; }
  }
  if (d < e.r + 8 && e.atk <= 0) { e.atk = 1.0; if (tgt.ally) damageAlly(tgt.ally, e.def.dmg); else hurtPlayer(e.def.dmg, e, true); }
}
function damageAlly(a: Ally, dmg: number) {
  a.hp -= dmg; floatText(a.x, a.y - 14, Math.round(dmg), '#ff9a9a');
  if (a.k === 'poppet' && a.tick <= 0) { a.tick = 0.35; for (const e of W.enemies.slice()) if (e.marks > 0 && onScreen(e)) hitEnemy(e, a.dmg * e.marks, { col: '#ffc8d8', noMark: true, noCrit: true }); }
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
        for (const a of W.allies) if (a.k !== 'snapvine' && dist(a.x, a.y - 6, p.x, p.y) < 7 + p.r) { damageAlly(a, p.dmg); dead = true; break; }
        if (!dead && dist(P.x, P.y - 7, p.x, p.y) < 6 + p.r) {
          if (p.kind === 'net') { if (P.air <= 0 && P.inv <= 0) { if (P.flying) { P.flying = false; const n = boxSolid(P.x, P.y, P.hw, P.hh, 'walk') ? nearestWalkable(P.x, P.y) : null; if (n) { P.x = n.x; P.y = n.y; } hooks.toast('A net drags you off your broom!', 'bad'); } P.net = 1.2; hurtPlayer(p.dmg, null, false); } }
          else if (P.inv <= 0) hurtPlayer(p.dmg, null, false);
          dead = true;
        }
      }
    }
    if (dead) { const i = W.proj.indexOf(p); if (i >= 0) W.proj.splice(i, 1); }
  }
}
function tileSolidProj(x: number, y: number) { const t = tileAt(x, y); return [TL.TREE, TL.STONEWALL, TL.HWALL, TL.ROOF, TL.DOOR, TL.ROOF_BLUE, TL.ROCK, TL.WINDOW, TL.ROOF_GREEN, TL.DEADTREE, TL.STALL, TL.TENT, TL.ROOF_PURPLE, TL.HEDGE].includes(t as never); }
function landLob(p: Proj) {
  shake(1); sfx('boom'); addPart(p.x, p.y, p.col, 14, 50, 0.5);
  if (!p.pid) { W.zones.push({ k: 'cloud', x: p.x, y: p.y + 4, r: 28, t: 4, arm: 0, dps: 0, mult: p.mult, tick: 0, own: 'p', col: '#8fd14f' }); return; }
  const tier = p.tier || 1;
  if (p.pid === 'baneflask') W.zones.push({ k: 'cloud', x: p.x, y: p.y + 4, r: 30, t: 4, arm: 0, dps: potionTierVal([8, 14, 22, 34], tier) * (S.craft === 'herbal' ? 1.4 : 1), mult: 0, tick: 0, own: 'p', col: '#a25ad6' });
  if (p.pid === 'hexfire') { const dmg = potionTierVal([40, 70, 110, 170], tier) * (S.craft === 'herbal' ? 1.4 : 1); W.fx.push({ k: 'ring', x: p.x, y: p.y, R: 34, t: 0, d: 0.3, col: '#e05a9a', lt: '#ffc8e0' }); forEnemiesIn(p.x, p.y, 34, e => hitEnemy(e, 0, { raw: dmg, kb: 20, from: p, col: '#ffc8e0' })); }
}
function updateZones(dt: number) {
  const P = W.P;
  for (const z of W.zones.slice()) {
    z.t -= dt; z.arm = Math.max(0, z.arm - dt); z.tick -= dt;
    if (z.k === 'circle') { z.x = P.x; z.y = P.y; if (z.tick <= 0) { z.tick = 0.5; forEnemiesIn(z.x, z.y - 4, z.r, e => { hitEnemy(e, z.mult, { col: z.col, noCrit: true }); e.slow = Math.max(e.slow, 0.6); }); } }
    if (z.k === 'sigil' && z.arm <= 0) { const hit = W.enemies.find(e => !e.wild && dist(e.x, e.y, z.x, z.y) < 10 + e.r); if (hit) { z.t = 0; W.fx.push({ k: 'ring', x: z.x, y: z.y, R: z.r, t: 0, d: 0.3, col: z.col, lt: '#fff1a8' }); forEnemiesIn(z.x, z.y, z.r, e => hitEnemy(e, z.mult, { root: 1.5, col: '#fff1a8' })); shake(2); sfx('boom'); } }
    if (z.k === 'cloud' && z.tick <= 0) { z.tick = 0.5; forEnemiesIn(z.x, z.y, z.r, e => { if (z.dps) hitEnemy(e, 0, { raw: z.dps * 0.5, dot: true, noCrit: true, col: z.col }); else hitEnemy(e, z.mult * 0.5, { dot: true, noCrit: true, col: z.col }); }); }
    if (z.k === 'cloud' && R() < 0.5) W.parts.push({ x: z.x + (R() - 0.5) * z.r * 1.6, y: z.y + (R() - 0.5) * z.r, vx: 0, vy: -8, life: 0.6, max: 0.6, col: z.col, size: 2, grav: 0 });
    if (z.k === 'rootspike' && z.arm <= 0 && z.tick <= 0) { z.tick = 99; addPart(z.x, z.y, '#8a5a3a', 10, 50, 0.5, 2); if (dist(P.x, P.y, z.x, z.y) < z.r + 4) hurtPlayer(z.mult, null, false); }
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
    if (a.t <= 0 || a.hp <= 0) { addPart(a.x, a.y - 6, a.k === 'poppet' ? '#f2c14e' : '#d8d0ff', 10, 40); W.allies.splice(W.allies.indexOf(a), 1); }
  }
}
export { refresh };
