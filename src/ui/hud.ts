import { S, selected, companion, partyFams, famName, craftLv, famNeed, craftNeed, comfort, treePoints, craftProg } from '../core/state';
import { W, hooks, broomStamMax, isNight, famCdLeft, setDeco, decoStore } from '../world/world';
import { skillFor } from '../world/combat';
import { trackedQuest, questDef, stepLine } from '../world/quests';
import { CRAFTS } from '../data/crafts';
import { ITEMS } from '../data/items';
import { SPECIES, ELEMENT_INFO } from '../data/familiars';
import { TIER_NAMES } from '../data/brewing';
import { FURN, FURNITURE } from '../data/furniture';
import { WALLPAPERS, FLOORS } from '../world/terrain';
import { itemIcon, famSprite, icon } from '../art/sprites';
import { furnSprite } from '../art/furniture16';
import { url } from '../art/pixel';
import { esc, fmtTime, clamp } from '../core/util';
import { sfx } from '../core/audio';
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
  $('deco').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b || b.disabled) return; const d = b.dataset;
    if (d.furn) { W.deco.hold = { id: d.furn }; sfx('equip'); dirty = true; }
    else if (d.wall !== undefined) { S.home.wall = Number(d.wall); hooks.mapChanged(); sfx('equip'); dirty = true; }
    else if (d.floor !== undefined) { S.home.floor = Number(d.floor); hooks.mapChanged(); sfx('equip'); dirty = true; }
    else if (d.dact === 'store') decoStore();
    else if (d.dact === 'done') setDeco(false);
  });
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
  if (st.id === 'wand') { const cd = CRAFTS[S.craft]; ic = icon(cd.skills[0].icon, cd.col, cd.light); } else ic = itemIcon(st.id);
  const q = d.kind === 'potion' ? `<span class="tier t${st.q}">${'◆'.repeat(st.q)}</span>` : d.kind === 'ingredient' ? `<span class="tier q${st.q}">${'★'.repeat(st.q)}</span>` : '';
  const title = st.id === 'wand' ? `${CRAFTS[S.craft].name}: ${CRAFTS[S.craft].skills[0].name}` : d.kind === 'potion' ? `${TIER_NAMES[st.q]} ${d.name}` : d.name;
  return `<button class="hslot${sel}" data-slot="${i}" title="${esc(title)}"><span class="k">${key}</span><img alt="" src="${url(ic)}">${d.stack && st.n > 1 ? `<span class="n">${st.n}</span>` : ''}${q}</button>`;
}
const SK_KEYS = ['J', 'K', 'L', 'U'];
function rebuild() {
  dirty = false;
  let h = ''; for (let i = 0; i < 10; i++) h += slotHTML(i); setHTML('hotbar', h);
  const st = selected(); const d = st ? ITEMS[st.id] : null;
  setText('selName', st ? (st.id === 'wand' ? `${CRAFTS[S.craft].skills[0].name}` : d!.kind === 'potion' ? `${TIER_NAMES[st.q]} ${d!.name}` : d!.name) : 'Empty hand');
  // skills: J K L U, familiar ability O, dodge, potion
  const cd = CRAFTS[S.craft]; const lv = craftLv(); let sk = '';
  for (let i = 0; i < 4; i++) { const s = skillFor(i);
    if (!s) { sk += `<div class="skill empty" id="sk${i}" title="Advanced skill: unlock one in your Craft tree (N)"><span class="k">${SK_KEYS[i]}</span><div class="cdv"></div><div class="lock">+</div></div>`; continue; }
    sk += `<div class="skill" id="sk${i}" title="${esc(s.name)}: ${esc(s.desc)}${s.mp ? ` (${s.mp} MP)` : ''}"><span class="k">${SK_KEYS[i]}</span><img alt="" src="${url(icon(s.icon, cd.col, cd.light))}"><div class="cdv"></div>${i < 3 && lv < s.lvl ? `<div class="lock">Lv${s.lvl}</div>` : ''}</div>`; }
  const c = companion();
  if (c) { const sp = SPECIES[c.sp]; const el = ELEMENT_INFO[sp.el]; sk += `<div class="skill fam" id="skO" style="border-color:${el.col}" title="${esc(sp.act.name)}: ${esc(sp.act.d)}"><span class="k">O</span><img alt="" src="${url(icon(sp.act.kind === 'lantern' ? 'lanterni' : sp.act.kind, el.col, el.light))}"><div class="cdv"></div></div>`; }
  sk += `<div class="skill util" id="skD" title="Dodge roll: brief invulnerability"><span class="k">SPC</span><img alt="" src="${url(icon('dodge', '#e9dfc7', '#a294bd'))}"><div class="cdv"></div></div>`;
  sk += `<div class="skill util" id="skH" title="Drink your best healing potion (shared potion cooldown)"><span class="k">H</span><img alt="" src="${url(itemIcon('p_healing'))}"><div class="cdv"></div></div>`;
  setHTML('skills', sk);
  setText('wName', S.name); setText('wCraft', `${cd.name} Lv ${lv}${treePoints() > 0 ? ' ★' : ''}`);
  // party
  const party = partyFams(); let ph = '';
  party.forEach((f, i) => { const sp = SPECIES[f.sp]; const el = ELEMENT_INFO[sp.el]; const on = f === c;
    ph += `<div class="pm ${on ? 'on' : ''}" style="--c:${el.col}" title="${esc(famName(f))} · ${el.name}${on ? ' (active)' : ' · press T to swap'}"><img class="pix" alt="" src="${url(famSprite(f.sp, f.stage))}"><span class="el" style="background:${el.col}"></span></div>`; void i; });
  if (c) { const sp = SPECIES[c.sp]; const el = ELEMENT_INFO[sp.el]; ph += `<div class="fcol"><span class="nm" style="color:${el.col}">${esc(famName(c))}</span><span class="lbl">Lv ${c.lvl} · ${el.name}${party.length > 1 ? ' · T swap' : ''}</span><div class="bar fx thin"><i id="fxF"></i></div><div class="bar sw thin"><i id="swF"></i></div></div>`; }
  else ph += '<div class="fcol"><span class="nm">No familiar</span><span class="lbl">Press F</span></div>';
  setHTML('party', ph); delete cache['wfxF']; delete cache['wswF'];
  if (c) setW('fxF', c.xp / famNeed(c.lvl));
  setText('gold', String(S.gold));
  const a = trackedQuest(); const qd = a ? questDef(a.id) : undefined;
  if (!a || !qd) { setText('qTitle', S.quests.length ? 'Quests' : 'No active quest'); setText('qProg', S.quests.length ? 'Open the quest log (Q)' : 'Visit Grandmother Wren in Hollowmere.'); }
  else { setText('qTitle', qd.title); setText('qProg', stepLine(a)); }
  setText('qMore', S.quests.length > 1 ? `+${S.quests.length - 1} more · Q` : '');
  renderDeco();
}
function renderDeco() {
  const box = $('deco'); if (!W.deco.on) { if (!box.hidden) box.hidden = true; return; } box.hidden = false;
  const owned = FURNITURE.filter(f => (S.home.owned[f.id] || 0) > 0);
  let h = `<div class="dhead"><span class="nm">Decorate</span><span class="lbl">Comfort ${comfort()}</span></div>`;
  h += W.deco.hold ? `<div class="dhold">Placing: <b>${esc(FURN[W.deco.hold.id].name)}</b><div class="lbl">Click to place · right-click to store</div><button class="btn sm" data-dact="store">Store</button></div>` : '<div class="lbl">Click furniture in the room to move it.</div>';
  h += `<div class="lbl">In storage</div><div class="dgrid">${owned.map(f => `<button class="dfurn" data-furn="${f.id}" title="${esc(f.name)} · Comfort ${f.comfort}"><img class="pix" alt="" src="${url(furnSprite(f.id))}"><span class="n">${S.home.owned[f.id]}</span></button>`).join('') || '<span class="muted">Empty. Bram sells furniture in Hollowmere.</span>'}</div>`;
  h += `<div class="lbl">Wallpaper</div><div class="swatches">${S.home.walls.map(i => `<button class="sw ${S.home.wall === i ? 'sel' : ''}" style="background:${WALLPAPERS[i].b}" data-wall="${i}" title="${esc(WALLPAPERS[i].name)}"></button>`).join('')}</div>`;
  h += `<div class="lbl">Floor</div><div class="swatches">${S.home.floors.map(i => `<button class="sw ${S.home.floor === i ? 'sel' : ''}" style="background:${FLOORS[i].a}" data-floor="${i}" title="${esc(FLOORS[i].name)}"></button>`).join('')}</div>`;
  h += `<button class="btn go wide" data-dact="done">Done · V</button>`;
  setHTML('deco', h);
}
function cdBar(id: string, f: number) { const el = document.querySelector(`#${id} .cdv`) as HTMLElement | null; if (!el) return; const v = Math.round(clamp(f, 0, 1) * 100) + '%'; if (el.dataset.v !== v) { el.dataset.v = v; el.style.height = v; } }
function frameHud() {
  if (!S || !W.P) return; if (dirty) rebuild();
  const P = W.P, st = W.st;
  setW('hpF', P.hp / st.maxHp); setText('hpT', `${Math.ceil(P.hp)}/${st.maxHp}`);
  setW('mpF', P.mp / st.maxMp); setText('mpT', `${Math.floor(P.mp)}/${st.maxMp}`);
  setW('enF', S.energy / S.maxEnergy); setText('enT', `${S.energy}`);
  const cx = craftProg(); setW('xpF', cx.xp / craftNeed(cx.lvl));
  setText('clock', fmtTime(S.time)); setText('day', `Day ${S.day}`); setText('weather', S.rain ? 'Rain' : isNight() ? 'Night' : 'Clear');
  for (let i = 0; i < 4; i++) cdBar('sk' + i, P.cdMax[i] ? P.cd[i] / P.cdMax[i] : 0);
  const c = companion(); if (c) { cdBar('skO', (W.famCdMax[c.uid] ? famCdLeft(c) / W.famCdMax[c.uid] : 0)); if (document.getElementById('swF')) setW('swF', 1 - P.swapCd / 4); }
  cdBar('skD', P.rollCd / 0.8); cdBar('skH', P.potCdMax ? P.potCd / P.potCdMax : 0);
  const bm = broomStamMax(); const showB = P.flying || P.stam < bm - 0.5; ($('broombar') as HTMLElement).hidden = !showB; if (showB) setW('bsF', P.stam / bm);
  const buffs = Object.entries(P.buffs).map(([k, b]) => `<span title="${k}">${{ quick: 'Swift', ward: 'Ward', glimmer: 'Glimmer', haste: 'Haste', thorn: 'Thorns', hot: 'Mending' }[k] || k} ${Math.ceil(b.t)}s</span>`).join('')
    + (S.fondness > 1 ? '<span>Fondness</span>' : '') + (S.flags.rested ? '<span>Rested</span>' : '') + (P.wild > 0 ? `<span>Wild ${Math.ceil(P.wild)}s</span>` : '') + (P.circle > 0 ? '<span>Circle</span>' : '') + (P.shield > 0 ? `<span>Bubble ${Math.ceil(P.shield)}</span>` : '') + (P.bastion > 0 ? '<span>Bastion</span>' : '');
  setHTML('buffs', buffs);
  const b = W.bossRef; const bb = $('bossbar');
  if (b && b.hp > 0) { if (bb.hidden) bb.hidden = false; setText('bossName', (b.elite ? 'Alpha ' : '') + b.def.name + (b.def.el ? ` · ${ELEMENT_INFO[b.def.el].name}` : '') + (b.def.ai.startsWith('boss_') ? ` · Phase ${b.phase}` : ''));
    setW('bossF', b.hp / b.max); const sh = $('bossSh'); sh.hidden = !(b.shieldMax > 0 && b.shield > 0); if (!sh.hidden) setW('bossShF', b.shield / b.shieldMax); }
  else if (!bb.hidden) bb.hidden = true;
}
