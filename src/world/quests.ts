// Concurrent, event-driven quests: main story, villager side quests and daily bounties.
import { S, addItem, countItem, removeItem, ActiveQuest, companionEl, comfort, Familiar } from '../core/state';
import { QUEST, QUESTS, QuestDef, Step, BOUNTY_TEMPLATES, NPC_NAMES } from '../data/quests';
import { ITEMS } from '../data/items';
import { makeGear } from '../data/gear';
import { BPART } from '../data/gear';
import { FURN } from '../data/furniture';
import { ENEMIES } from '../data/enemies';
import { SPECIES, effMult, ELEMENT_INFO } from '../data/familiars';
import { POTION, TIER_NAMES } from '../data/brewing';
import { FSTATS } from '../data/familiars';
import { T, dist, rngFrom } from '../core/util';
import { sfx } from '../core/audio';
import { W, hooks, Line, saveNow, addPart } from './world';
import type { Enemy } from './combat';
import { spawnEnemy } from './combat';

export type QEvent =
  | { t: 'harvest'; crop: string } | { t: 'kill'; e: Enemy } | { t: 'brew'; potion: string; tier: number } | { t: 'bind'; sp: string }
  | { t: 'breed'; child: Familiar } | { t: 'boss'; id: string } | { t: 'explore'; place: string } | { t: 'escort' } | { t: 'defend' }
  | { t: 'comfort' } | { t: 'talk'; npc: string };

// ---------- definitions ----------
export function questDef(id: string): QuestDef | undefined {
  if (QUEST[id]) return QUEST[id];
  if (id.startsWith('b:')) { const [, tpl, day] = id.split(':'); const t = BOUNTY_TEMPLATES[Number(tpl)]; if (t) return { ...t, id, title: t.title, text: t.text + ` (Posted day ${day}.)` }; }
  return undefined;
}
export const activeQ = (id: string) => S.quests.find(q => q.id === id);
export const isDone = (id: string) => S.qdone.includes(id);
export function reqMet(d: QuestDef): boolean {
  if (d.req?.quests && !d.req.quests.every(isDone)) return false;
  if (d.req?.flags && !d.req.flags.every(f => S.flags[f])) return false;
  return true;
}
/** Quests this NPC can hand out right now. */
export function offersFrom(npc: string): QuestDef[] { return QUESTS.filter(q => q.giver === npc && !isDone(q.id) && !activeQ(q.id) && reqMet(q)); }
export function readyFor(npc: string): ActiveQuest[] { return S.quests.filter(a => { const d = questDef(a.id); return d && d.giver === npc && isReady(a); }); }
export function isReady(a: ActiveQuest): boolean { const d = questDef(a.id); return !!d && a.step >= d.steps.length; }
export function npcMarker(npc: string): '!' | '?' | null { if (readyFor(npc).length) return '?'; if (offersFrom(npc).length) return '!'; return null; }

export function acceptQuest(id: string, quiet = false) {
  const d = questDef(id); if (!d || activeQ(id) || isDone(id)) return;
  const a: ActiveQuest = { id, step: 0, prog: 0 }; S.quests.push(a);
  for (const f of d.onAccept || []) S.flags[f] = true;
  if (!S.track || d.kind === 'main') S.track = id;
  if (!quiet) { hooks.toast(`New quest: <b>${d.title}</b>`, 'good'); sfx('open'); }
  advance(a); hooks.hud();
}

// ---------- progress ----------
function stepLive(s: Step): boolean {
  switch (s.t) {
    case 'gather': return countItem(s.item, s.minQ || 0) >= s.n;
    case 'comfort': return comfort() >= s.n;
    case 'boss': return !!S.bosses[s.id];
    case 'explore': return !!S.flags['seen_' + s.place];
    default: return false;
  }
}
function advance(a: ActiveQuest) {
  const d = questDef(a.id)!; const was = isReady(a);
  while (a.step < d.steps.length && stepLive(d.steps[a.step])) { a.step++; a.prog = 0; }
  if (!was && isReady(a)) { hooks.toast(`Quest ready: <b>${d.title}</b>. Return to ${NPC_NAMES[d.giver] || d.giver}.`, 'good'); sfx('level'); }
}
function matches(s: Step, ev: QEvent): boolean {
  switch (s.t) {
    case 'harvest': return ev.t === 'harvest';
    case 'brew': return ev.t === 'brew' && ev.potion === s.potion && ev.tier >= (s.minTier || 1);
    case 'kill': { if (ev.t !== 'kill') return false; const e = ev.e; const pel = companionEl();
      if (s.faction && e.def.faction !== s.faction) return false; if (s.enemy && e.id !== s.enemy) return false; if (s.el && e.def.el !== s.el) return false;
      if (s.elite && !e.elite) return false; if (s.withEl && pel !== s.withEl) return false; if (s.adv && effMult(pel, e.def.el) <= 1) return false; return true; }
    case 'bind': return ev.t === 'bind' && (!s.sp || ev.sp === s.sp) && (!s.el || SPECIES[ev.sp].el === s.el);
    case 'breed': if (ev.t !== 'breed') return false; if (s.min) { const vals = s.stat ? [ev.child.pot[s.stat]] : FSTATS.map(k => ev.child.pot[k]); return Math.max(...vals) >= s.min; } return true;
    case 'boss': return ev.t === 'boss' && ev.id === s.id;
    case 'explore': return ev.t === 'explore' && ev.place === s.place;
    case 'escort': return ev.t === 'escort';
    case 'defend': return ev.t === 'defend';
    case 'talk': return ev.t === 'talk' && ev.npc === s.npc;
    default: return false;
  }
}
const stepCount = (s: Step) => 'n' in s ? (s as { n: number }).n : 1;
export function questEvent(ev: QEvent) {
  for (const a of S.quests) {
    const d = questDef(a.id); if (!d || isReady(a)) continue; const s = d.steps[a.step];
    if (s && matches(s, ev)) { a.prog++; if (a.prog >= stepCount(s)) { a.step++; a.prog = 0; } }
    advance(a);
  }
  hooks.hud();
}
export function stepProgress(a: ActiveQuest, i: number): { have: number; need: number; done: boolean } {
  const d = questDef(a.id)!; const s = d.steps[i]; const need = s.t === 'comfort' ? s.n : stepCount(s);
  if (i < a.step) return { have: need, need, done: true };
  if (i > a.step) return { have: 0, need, done: false };
  if (s.t === 'gather') { const h = Math.min(need, countItem(s.item, s.minQ || 0)); return { have: h, need, done: h >= need }; }
  if (s.t === 'comfort') { const h = Math.min(need, comfort()); return { have: h, need, done: h >= need }; }
  if (s.t === 'defend' && W.defend) return { have: W.defend.wave - 1, need: s.waves, done: false };
  return { have: a.prog, need, done: false };
}
export function trackedQuest(): ActiveQuest | undefined { return activeQ(S.track || '') || S.quests.find(q => questDef(q.id)?.kind === 'main') || S.quests[0]; }
export function stepLine(a: ActiveQuest): string {
  const d = questDef(a.id); if (!d) return ''; if (isReady(a)) return `Return to ${NPC_NAMES[d.giver] || d.giver}`;
  const s = d.steps[a.step]; const p = stepProgress(a, a.step); return p.need > 1 ? `${s.d}: ${p.have}/${p.need}` : s.d;
}

// ---------- turn in ----------
export function turnIn(a: ActiveQuest): Line[] {
  const d = questDef(a.id)!;
  // gather steps are checked live; take the items now
  for (let i = 0; i < d.steps.length; i++) { const s = d.steps[i]; if (s.t === 'gather' && countItem(s.item, s.minQ || 0) < s.n) { a.step = i; a.prog = 0; return [{ who: NPC_NAMES[d.giver] || '', text: `You still need ${s.n} ${ITEMS[s.item].name}${s.minQ ? ` (${s.item.startsWith('p_') ? TIER_NAMES[s.minQ] : '★'.repeat(s.minQ)}+)` : ''}.` }]; } }
  for (const s of d.steps) if (s.t === 'gather') removeItem(s.item, s.n, s.minQ || 0);
  const rw = d.reward; S.gold += rw.gold || 0; const got: string[] = [];
  for (const [id, q, n] of rw.items || []) { addItem(id, q, n); got.push(`${n} ${ITEMS[id].name}`); }
  if (rw.gear) { const g = makeGear(rw.gear.slot, rw.gear.lvl, rw.gear.rar); S.bag.push(g); got.push(g.name); }
  if (rw.part && !S.broom.owned.includes(rw.part)) { S.broom.owned.push(rw.part); got.push(BPART[rw.part].name); }
  for (const f of rw.furniture || []) { S.home.owned[f] = (S.home.owned[f] || 0) + 1; got.push(FURN[f].name); }
  for (const f of rw.flags || []) S.flags[f] = true;
  S.quests.splice(S.quests.indexOf(a), 1); S.qdone.push(a.id); if (S.track === a.id) S.track = null;
  sfx('level'); saveNow(); hooks.hud();
  return [{ who: NPC_NAMES[d.giver] || '', text: d.done }, { who: '', text: `Reward: ${rw.gold || 0} gold${got.length ? ', ' + got.join(', ') : ''}.` }];
}

/** Talking to a quest giver: turn in what is ready, then offer what is available. Returns lines to show (empty = nothing quest-related). */
export function questTalk(npc: string): Line[] {
  questEvent({ t: 'talk', npc });
  const lines: Line[] = [];
  for (const a of readyFor(npc)) lines.push(...turnIn(a));
  for (const d of offersFrom(npc)) { lines.push({ who: NPC_NAMES[npc] || '', text: d.text }, { who: '', text: `Quest accepted: ${d.title}. ${d.hint}` }); acceptQuest(d.id, true); if (d.kind === 'main') break; }
  return lines;
}

// ---------- bounties ----------
export function refreshBounties() {
  if (S.bounty.day === S.day) return; const r = rngFrom(S.day * 313 + 9); const pool = BOUNTY_TEMPLATES.map((_, i) => i);
  const list: { tpl: number; id: string; taken: boolean }[] = [];
  for (let k = 0; k < 3 && pool.length; k++) { const tpl = pool.splice(Math.floor(r() * pool.length), 1)[0]; list.push({ tpl, id: `b:${tpl}:${S.day}`, taken: false }); }
  S.bounty = { day: S.day, list };
}
export function takeBounty(i: number): string | null {
  const b = S.bounty.list[i]; if (!b || b.taken) return null;
  if (S.quests.filter(q => q.id.startsWith('b:')).length >= 3) return 'You can hold three bounties at once.';
  b.taken = true; acceptQuest(b.id); return null;
}

// ---------- world-side quest logic (called twice a second) ----------
const EXPLORE = ['hideout', 'glade', 'stone1', 'stone2', 'stone3'];
export function updateQuestWorld() {
  if (!W.map || W.map.id !== 'forest') { W.defend = null; return; }
  const P = W.P;
  for (const k of EXPLORE) { const g = W.map.regions[k]; if (g && !S.flags['seen_' + k] && dist(P.x, P.y, g.x * T + 8, g.y * T + 8) < (g.r + 1.5) * T) markSeen(k); }
  // Pip appears at the hideout while his escort is underway
  const esc = activeQ('s_ysolde'); const escD = questDef('s_ysolde')!;
  if (esc && !isReady(esc) && escD.steps[esc.step]?.t === 'escort' && !W.pip) { const h = W.map.regions.hideout; W.pip = { x: h.x * T + 8, y: h.y * T + 4, hw: 4, hh: 3, hp: 140, max: 140, face: 1, walk: 0, wait: true, inv: 0 }; }
  // shrine defense waves
  const D = W.defend; if (!D) return;
  const alive = W.enemies.filter(e => e.tag === 'wave').length;
  if (!D.spawned) { D.t -= 0.5; if (D.t <= 0) { const n = 3 + D.wave; const pool = D.wave >= 3 ? ['snagstump', 'hollowwisp', 'cinderbeetle', 'thornrat'] : ['mossblob', 'thornrat', 'rotcrow', 'cinderbeetle'];
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + D.wave; const e = spawnEnemy(pool[k % pool.length], D.x + Math.cos(a) * 120, D.y + Math.sin(a) * 90, 'wave'); e.aggro = true; }
    D.spawned = true; hooks.banner(`WAVE ${D.wave}`, 'Protect the shrine!'); sfx('hurt'); } return; }
  if (alive === 0) { if (D.wave >= 3) { W.defend = null; questEvent({ t: 'defend' }); hooks.banner('THE SHRINE HOLDS', 'The rot draws back'); addPart(D.x, D.y - 10, '#fff6c0', 40, 70, 1, 1, -20); return; }
    D.wave++; D.spawned = false; D.t = 3; hooks.toast('The next wave gathers…', 'dim'); }
}
export function markSeen(place: string) {
  if (S.flags['seen_' + place]) return; S.flags['seen_' + place] = true;
  if (place.startsWith('stone') && !S.flags['ws' + place.slice(5)]) { S.flags['ws' + place.slice(5)] = true; hooks.toast('An old waystone hums awake as you pass.', 'good'); sfx('evolve'); }
  questEvent({ t: 'explore', place });
}
export function startDefense(x: number, y: number) {
  if (W.defend) return; W.defend = { wave: 1, x, y, hp: 400, max: 400, t: 2, spawned: false };
  hooks.toast('Hold the shrine through three waves. Enemies will go for it.', 'good');
}
export function hurtShrine(d: number) {
  const D = W.defend; if (!D) return; D.hp -= d; addPart(D.x, D.y - 8, '#b06aff', 3, 30, 0.3);
  if (D.hp <= 0) { W.defend = null; for (const e of W.enemies) if (e.tag === 'wave') e.tag = 'corrupt'; hooks.banner('THE SHRINE FALLS', 'Try again when you are ready'); sfx('fail'); }
}
export { ENEMIES, POTION, ELEMENT_INFO };
