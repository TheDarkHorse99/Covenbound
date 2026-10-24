import { S, selected, companion, famName, craftLv, famNeed, craftNeed } from '../core/state';
import { W, hooks, questProgress, broomStamMax, isNight } from '../world/world';
import { CRAFTS } from '../data/crafts';
import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import { SPECIES, ELEMENT_INFO } from '../data/familiars';
import { TIER_NAMES } from '../data/brewing';
import { itemIcon, famSprite, icon } from '../art/sprites';
import { url } from '../art/pixel';
import { esc, fmtTime, clamp } from '../core/util';
import { game } from './state';

const $ = (id: string) => document.getElementById(id)!;
let dirty = true;
const cache: Record<string, string> = {};
function setText(id: string, v: string) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
function setHTML(id: string, v: string) { if (cache['h' + id] !== v) { cache['h' + id] = v; $(id).innerHTML = v; } }
function setW(id: string, f: number) { const v = (Math.round(clamp(f, 0, 1) * 1000) / 10) + '%'; if (cache['w' + id] !== v) { cache['w' + id] = v; ($(id) as HTMLElement).style.width = v; } }

export function initHud() {
  hooks.hud = () => { dirty = true; };
  hooks.toast = toast; hooks.banner = banner;
  game.afterFrame = frameHud;
  const ro = new ResizeObserver(() => fitStage()); ro.observe(document.getElementById('app')!); fitStage();
  $('hotbar').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null; if (!b) return; S.sel = Number(b.dataset.slot); dirty = true; });
}
export function fitStage() {
  const app = document.getElementById('app')!; const st = document.getElementById('stage')!;
  const cs = getComputedStyle(app); const aw = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); const ah = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let w = aw, h = aw * 9 / 16; if (h > ah) { h = ah; w = ah * 16 / 9; }
  st.style.width = Math.floor(w) + 'px'; st.style.height = Math.floor(h) + 'px';
  st.style.setProperty('--u', (w / 400).toFixed(3) + 'px');
}
export function showHud(on: boolean) { $('hud').hidden = !on; dirty = true; }

export function toast(msg: string, cls = '') {
  const el = document.createElement('div'); el.className = cls; el.innerHTML = msg; const box = $('toasts'); box.appendChild(el);
  while (box.children.length > 5) box.firstChild!.remove(); setTimeout(() => el.remove(), 4200);
}
let banTimer = 0;
export function banner(big: string, sm = '') { setText('banBig', big); setText('banSm', sm); $('banner').classList.add('on'); clearTimeout(banTimer); banTimer = window.setTimeout(() => $('banner').classList.remove('on'), 2200); }

function slotHTML(i: number): string {
  const st = S.inv[i]; const sel = i === S.sel ? ' sel' : ''; const key = i === 9 ? '0' : String(i + 1);
  if (!st) return `<button class="hslot${sel}" data-slot="${i}"><span class="k">${key}</span></button>`;
  const d = ITEMS[st.id]; let ic: HTMLCanvasElement;
  if (st.id === 'wand') { const cd = CRAFTS[S.craft]; ic = icon(cd.skills[0].icon, cd.col, cd.light, 3); } else ic = itemIcon(st.id, 3);
  const q = d.kind === 'potion' ? `<span class="tier t${st.q}">${'◆'.repeat(st.q)}</span>` : d.kind === 'ingredient' ? `<span class="tier q${st.q}">${'★'.repeat(st.q)}</span>` : '';
  const title = st.id === 'wand' ? `${CRAFTS[S.craft].name}: ${CRAFTS[S.craft].skills[0].name}` : d.kind === 'potion' ? `${TIER_NAMES[st.q]} ${d.name}` : d.name;
  return `<button class="hslot${sel}" data-slot="${i}" title="${esc(title)}"><span class="k">${key}</span><img alt="" src="${url(ic)}">${d.stack && st.n > 1 ? `<span class="n">${st.n}</span>` : ''}${q}</button>`;
}
function rebuild() {
  dirty = false;
  let h = ''; for (let i = 0; i < 10; i++) h += slotHTML(i); setHTML('hotbar', h);
  const st = selected(); const d = st ? ITEMS[st.id] : null;
  setText('selName', st ? (st.id === 'wand' ? `${CRAFTS[S.craft].skills[0].name}` : d!.kind === 'potion' ? `${TIER_NAMES[st.q]} ${d!.name}` : d!.name) : 'Empty hand');
  // skills
  const cd = CRAFTS[S.craft]; const lv = craftLv(); let sk = '';
  cd.skills.forEach((s, i) => { sk += `<div class="skill" id="sk${i}" title="${esc(s.name)}: ${esc(s.desc)}${s.mp ? ` (${s.mp} MP)` : ''}"><span class="k">${'JKL'[i]}</span><img alt="" src="${url(icon(s.icon, cd.col, cd.light, 3))}"><div class="cdv"></div>${lv < s.lvl ? `<div class="lock">Lv${s.lvl}</div>` : ''}</div>`; });
  setHTML('skills', sk);
  setText('wName', S.name); setText('wCraft', `${cd.name} Lv ${lv}`);
  const c = companion();
  if (c) { const sp = SPECIES[c.sp]; const src = url(famSprite(c.sp, c.stage, 3)); const im = $('fImg') as HTMLImageElement; if (im.dataset.src !== src) { im.dataset.src = src; im.src = src; } im.hidden = false;
    setText('fName', famName(c)); setText('fLv', `Lv ${c.lvl} · ${ELEMENT_INFO[sp.el].name}`); setW('fxF', c.xp / famNeed(c.lvl)); }
  else { ($('fImg') as HTMLImageElement).hidden = true; setText('fName', 'No companion'); setText('fLv', 'Press F'); setW('fxF', 0); }
  setText('gold', String(S.gold));
  const q = QUESTS[S.q.i]; const p = questProgress();
  if (!q) { setText('qTitle', 'All quests done'); setText('qProg', 'Raise, breed and brew.'); }
  else { setText('qTitle', q.title); const g = q.goal; setText('qProg', p!.done ? 'Return to Grandmother Wren' : g.type === 'boss' ? 'Defeat ' + (g.id === 'halloran' ? 'Witchfinder Halloran' : 'Old Rootmaw') : `${{ harvest: 'Crops harvested', kill: 'Corrupted beasts', brew: 'Healing Draughts brewed', bind: 'Familiars bound', breed: 'Eggs hatched' }[g.type]}: ${p!.have}/${p!.need}`); }
}
function frameHud() {
  if (!S || !W.P) return; if (dirty) rebuild();
  const P = W.P, st = W.st;
  setW('hpF', P.hp / st.maxHp); setText('hpT', `${Math.ceil(P.hp)}/${st.maxHp}`);
  setW('mpF', P.mp / st.maxMp); setText('mpT', `${Math.floor(P.mp)}/${st.maxMp}`);
  setW('enF', S.energy / 100); setText('enT', `${S.energy}`);
  const cx = S.crafts[S.craft]!; setW('xpF', cx.xp / craftNeed(cx.lvl));
  setText('clock', fmtTime(S.time)); setText('day', `Day ${S.day}`); setText('weather', S.rain ? 'Rain' : isNight() ? 'Night' : 'Clear');
  for (let i = 0; i < 3; i++) { const el = document.querySelector(`#sk${i} .cdv`) as HTMLElement | null; if (el) { const f = P.cdMax[i] ? P.cd[i] / P.cdMax[i] : 0; const v = Math.round(f * 100) + '%'; if (el.dataset.v !== v) { el.dataset.v = v; el.style.height = v; } } }
  const bm = broomStamMax(); const showB = P.flying || P.stam < bm - 0.5; ($('broombar') as HTMLElement).hidden = !showB; if (showB) setW('bsF', P.stam / bm);
  const buffs = Object.entries(P.buffs).map(([k, b]) => `<span title="${k}">${{ quick: 'Swift', ward: 'Ward', glimmer: 'Glimmer', haste: 'Haste', thorn: 'Thorns', hot: 'Mending' }[k] || k} ${Math.ceil(b.t)}s</span>`).join('') + (S.fondness > 1 ? '<span>Fondness</span>' : '') + (P.wild > 0 ? `<span>Wild ${Math.ceil(P.wild)}s</span>` : '') + (P.circle > 0 ? '<span>Circle</span>' : '');
  setHTML('buffs', buffs);
  const b = W.bossRef; const bb = $('bossbar'); if (b && b.hp > 0) { if (bb.hidden) { bb.hidden = false; } setText('bossName', b.def.name); setW('bossF', b.hp / b.max); } else if (!bb.hidden) bb.hidden = true;
}
