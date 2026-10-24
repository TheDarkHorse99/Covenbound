import {
  S, addItem, removeItem, removeAt, countItem, companion, famStat, famName, famNeed, hasTal, sigVal, witchLv, craftLv, craftNeed, lifeNeed,
  raceDef, deleteSave, Familiar, saveGame,
} from '../core/state';
import { W, hooks, refresh, usePotion, sleep, questProgress, startQuest, checkQuest, saveNow, Line, refreshOrders, isNight } from '../world/world';
import { CRAFTS, CRAFT_IDS, CRAFT_LEARN_PRICE, CraftId } from '../data/crafts';
import { SPECIES, FSTATS, FSTAT_INFO, TALENT, JOB_INFO, Job, EVO, ELEMENT_INFO } from '../data/familiars';
import { ITEMS, sellPrice } from '../data/items';
import { ING, ASPECTS, ASPECT_INFO, POTIONS, POTION, TIER_NAMES, TIER_MULT, CROPS, Aspect } from '../data/brewing';
import { Gear, SLOTS, SLOT_NAMES, STAT_NAMES, RARITY, AFFIX_INFO, makeGear, BROOM_PARTS, BPART, BROOM_DYES, StatKey, Slot } from '../data/gear';
import { QUESTS, WREN_IDLE } from '../data/quests';
import { itemIcon, famSprite, witchSprite, icon } from '../art/sprites';
import { url } from '../art/pixel';
import { esc, rngFrom, pick, clamp } from '../core/util';
import { sfx, audio } from '../core/audio';
import { game } from './state';
import { setInputHandlers } from './input';
import { openCauldron, cauldronKey } from './brew';
import { canBreed, layEgg } from '../world/breed';
import { NpcDef } from '../world/maps';
import { playerLook } from '../scenes/WorldScene';
import { showTitle } from './title';

const $ = (id: string) => document.getElementById(id)!;
type View = { kind: string; tab?: string; data?: unknown };
let view: View | null = null;
let selInv: number | null = null;
let onModalKey: ((k: string) => boolean) | null = null;

export function openModal(html: string, v: View, keyFn: ((k: string) => boolean) | null = null) {
  view = v; onModalKey = keyFn; $('win').dataset.kind = ''; $('win').innerHTML = html; $('modal').hidden = false; game.modal = true; $('win').className = 'win ' + (v.kind === 'title' || v.kind === 'create' ? 'title-win' : '');
}
export function closeModal() {
  if (view && (view.kind === 'create' || view.kind === 'title')) return;
  const was = view; $('modal').hidden = true; game.modal = false; view = null; onModalKey = null; hooks.hud();
  if (was?.kind === 'morning') { /* nothing */ }
}
export function rerender() { if (!view) return; renderView(view); }
function renderView(v: View) {
  switch (v.kind) {
    case 'menu': openModal(menuHTML(v.tab!), v); break;
    case 'roost': openModal(roostHTML(), v); break;
    case 'broom': openModal(broomHTML(), v); break;
    case 'crate': openModal(crateHTML(), v); break;
    case 'shop': openModal(shopHTML(v.data as ShopState), v); break;
    case 'board': openModal(boardHTML(), v); break;
    case 'learn': openModal(learnHTML(), v); break;
    case 'cauldron': view = v; onModalKey = null; $('modal').hidden = false; game.modal = true; openCauldron(); break;
  }
}

// ---------- dialog ----------
let dlg: { lines: Line[]; i: number; cb?: () => void } | null = null;
export function say(lines: Line[], cb?: () => void) { if (!lines.length) { cb?.(); return; } dlg = { lines, i: 0, cb }; game.dialog = true; showDlg(); }
function showDlg() { const l = dlg!.lines[dlg!.i]; $('dWho').textContent = l.who; $('dTxt').textContent = l.text; $('dialog').hidden = false; }
export function advanceDlg() { if (!dlg) return; dlg.i++; if (dlg.i >= dlg.lines.length) { const cb = dlg.cb; dlg = null; $('dialog').hidden = true; game.dialog = false; cb?.(); } else showDlg(); }

// ---------- helpers ----------
const ic = (c: HTMLCanvasElement, cls = '') => `<img class="pix ${cls}" alt="" src="${url(c)}">`;
const qStars = (id: string, q: number) => { const d = ITEMS[id]; if (!d) return ''; if (d.kind === 'potion') return `<span class="tier t${q}">${TIER_NAMES[q]}</span>`; if (d.kind === 'ingredient') return `<span class="tier q${q}">${'★'.repeat(q)}</span>`; return ''; };
function itemTitle(id: string, q: number) { const d = ITEMS[id]; return d.kind === 'potion' ? `${TIER_NAMES[q]} ${d.name}` : d.name; }
function aspectPips(id: string, showAll = false): string {
  const d = ING[id]; if (!d) return ''; const known = showAll ? 99 : S.known[id] || 0;
  const list = (Object.entries(d.asp) as [Aspect, number][]).sort((a, b) => b[1] - a[1]);
  return '<span class="asp">' + list.map(([a, v], i) => i < known ? `<span class="pip" style="--c:${ASPECT_INFO[a].col}" title="${ASPECT_INFO[a].name} ${v}">${ASPECT_INFO[a].name} ${v}</span>` : `<span class="pip unk" title="Unknown aspect: brew with it to learn more">?</span>`).join('') + '</span>';
}
export function itemDesc(id: string, q: number): string {
  const d = ITEMS[id]; if (!d) return '';
  if (d.kind === 'potion') { const p = POTION[id.slice(2)]; return `${p.desc(q)}${p.use === 'throw' ? ' Select it and click where to throw.' : p.use === 'crop' ? ' Select it and click a crop.' : p.use === 'cleanse' ? ' Select it and click blighted ground.' : ''}`; }
  if (d.kind === 'ingredient') return `${ING[id].desc} ${aspectPips(id)}`;
  return d.desc;
}
function statLine(g: Gear) { const parts: string[] = []; for (const k in g.s) parts.push(`+${g.s[k as StatKey]} ${STAT_NAMES[k as StatKey]}`); if (g.aff) parts.push(`<span class="aff">${AFFIX_INFO[g.aff].d(g.affV || 0)}</span>`); return parts.join(' · '); }
function compareLine(g: Gear) { const cur = S.eq[g.slot]; const ks = new Set([...Object.keys(g.s), ...Object.keys(cur ? cur.s : {})]); const out: string[] = [];
  for (const k of ks) { const dv = (g.s[k as StatKey] || 0) - (cur?.s[k as StatKey] || 0); if (dv) out.push(`<span class="${dv > 0 ? 'up' : 'down'}">${dv > 0 ? '+' : ''}${dv} ${STAT_NAMES[k as StatKey]}</span>`); }
  return out.length ? out.join(' · ') : '<span class="muted">Same stats as equipped</span>'; }
function gearIcon(g: Gear) { const col = RARITY[g.rar].col; const name = g.slot === 'weapon' ? (g.wtype === 'staff' ? 'staff' : 'wand') : g.slot === 'charm' ? 'charmi' : g.slot; return icon(name, g.slot === 'hat' ? (g.hatCol || '#2a2140') : col, col, 3, { c: '#a07a50' }); }
function gearRow(g: Gear, actions: string, compare = true) { return `<div class="row-item"><div class="ri-ic">${ic(gearIcon(g))}</div><div class="ri-main"><div class="ri-name" style="color:${RARITY[g.rar].col}">${esc(g.name)}</div><div class="ri-sub">${SLOT_NAMES[g.slot]} · Lv ${g.lvl} · ${RARITY[g.rar].name}</div><div class="ri-sub">${statLine(g)}</div>${compare ? `<div class="ri-sub">${compareLine(g)}</div>` : ''}</div><div class="ri-act">${actions}</div></div>`; }
function bar(f: number, col: string) { return `<div class="mbar"><i style="width:${clamp(f, 0, 1) * 100}%;background:${col}"></i></div>`; }
function header(title: string, extra = '') { return `<div class="whead"><h2>${title}</h2>${extra}<div class="spacer"></div><button class="btn" data-act="close">Close · Esc</button></div>`; }

// ---------- main menu ----------
const TABS: [string, string][] = [['bag', 'Bag'], ['witch', 'Witch'], ['fams', 'Familiars'], ['grimoire', 'Grimoire'], ['quest', 'Quest & help'], ['options', 'Options']];
export function openMenu(tab = 'bag') { selInv = null; renderView({ kind: 'menu', tab }); }
function menuHTML(tab: string): string {
  let h = `<div class="whead tabs">${TABS.map(([k, n]) => `<button class="btn ${tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}<div class="spacer"></div><button class="btn" data-act="close">Close · Esc</button></div>`;
  if (tab === 'bag') h += bagHTML(); if (tab === 'witch') h += witchHTML(); if (tab === 'fams') h += famsHTML(); if (tab === 'grimoire') h += grimoireHTML(); if (tab === 'quest') h += questHTML(); if (tab === 'options') h += optionsHTML();
  return h;
}
function invGrid(clickData = 'inv', filter?: (id: string) => boolean): string {
  return `<div class="invgrid">${S.inv.map((st, i) => { if (!st) return `<button class="islot empty ${i < 10 ? 'hb' : ''}" data-${clickData}="${i}"></button>`; const d = ITEMS[st.id]; const dim = filter && !filter(st.id) ? ' dimmed' : '';
    const icn = st.id === 'wand' ? icon(CRAFTS[S.craft].skills[0].icon, CRAFTS[S.craft].col, CRAFTS[S.craft].light, 3) : itemIcon(st.id, 3);
    return `<button class="islot ${i < 10 ? 'hb' : ''}${selInv === i && clickData === 'inv' ? ' sel' : ''}${dim}" data-${clickData}="${i}" title="${esc(itemTitle(st.id, st.q))}">${ic(icn)}${d.stack && st.n > 1 ? `<span class="n">${st.n}</span>` : ''}${d.kind === 'potion' ? `<span class="tier t${st.q}">${'◆'.repeat(st.q)}</span>` : d.kind === 'ingredient' ? `<span class="tier q${st.q}">${'★'.repeat(st.q)}</span>` : ''}</button>`; }).join('')}</div>`;
}
function bagHTML(): string {
  let h = `<div class="cols"><div class="col-main"><div class="lbl">Bag · top row is your hotbar (1–0). Click an item, then another slot to swap.</div>${invGrid()}`;
  h += `<div class="lbl" style="margin-top:12px">Gear bag (${S.bag.length}/40)</div>`;
  h += S.bag.length ? `<div class="list">${S.bag.slice().sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || b.lvl - a.lvl).map(g => gearRow(g, `<button class="btn" data-equip="${g.uid}" ${witchLv() < g.lvl ? 'disabled' : ''}>${witchLv() < g.lvl ? `Needs Lv ${g.lvl}` : 'Equip'}</button>`)).join('')}</div>` : '<p class="muted">No spare gear. Enemies, bosses and shops have more.</p>';
  h += `</div><div class="col-side">`;
  const st = selInv !== null ? S.inv[selInv] : null;
  if (st) { const d = ITEMS[st.id]; const p = d.kind === 'potion' ? POTION[st.id.slice(2)] : null;
    h += `<div class="detail">${ic(st.id === 'wand' ? icon(CRAFTS[S.craft].skills[0].icon, CRAFTS[S.craft].col, CRAFTS[S.craft].light, 6) : itemIcon(st.id, 6), 'big')}<h3>${esc(itemTitle(st.id, st.q))}</h3><div>${qStars(st.id, st.q)} ${d.stack ? `×${st.n}` : ''}</div><p>${itemDesc(st.id, st.q)}</p>
      ${d.sellable ? `<p class="muted">Sells for ${sellPrice(st.id, st.q)}g each.</p>` : ''}
      <div class="btnrow">${p && p.use === 'drink' ? `<button class="btn go" data-drink="${selInv}">Drink</button>` : ''}${d.sellable ? `<button class="btn" data-trash="${selInv}">Discard 1</button>` : ''}</div></div>`; }
  else h += `<div class="detail muted">Select an item to see what it does.</div>`;
  h += `<div class="lbl">Purse</div><div class="big-num">${S.gold}g</div></div></div>`;
  return h;
}
function witchHTML(): string {
  const st = W.st, race = raceDef(); const cd = CRAFTS[S.craft];
  let h = `<div class="cols"><div class="col-side"><div class="detail center">${ic(witchSprite(playerLook(), 0, 7), 'witch')}<h3>${esc(S.name)}</h3><div class="muted">${race.name} · ${cd.name} Lv ${craftLv()}</div><div class="muted">Witch level ${witchLv()} (highest Craft)</div></div>
    <div class="lbl">Life skills</div>${(['garden', 'forage', 'brew'] as const).map(k => `<div class="kv"><span>${{ garden: 'Gardening', forage: 'Foraging', brew: 'Brewing' }[k]}</span><b>Lv ${S.life[k].lvl}</b></div>${bar(S.life[k].xp / lifeNeed(S.life[k].lvl), '#a8d65a')}`).join('')}</div>
    <div class="col-main"><div class="lbl">Stats</div><dl class="stats">
    <dt>HP</dt><dd>${st.maxHp}</dd><dt>MP</dt><dd>${st.maxMp}</dd><dt>Power</dt><dd>${Math.round(st.pow)}</dd><dt>Ward</dt><dd>${Math.round(st.ward)} <span class="muted">(−${Math.round(100 - 6000 / (60 + st.ward))}% damage)</span></dd>
    <dt>Speed</dt><dd>${Math.round(st.spd)}</dd><dt>Crit</dt><dd>${Math.round(st.crit * 100)}%</dd><dt>Familiar power</dt><dd>×${st.famMult.toFixed(2)}${st.el ? ` · ${ELEMENT_INFO[st.el as keyof typeof ELEMENT_INFO].name} infusion` : ''}</dd>
    <dt>Race</dt><dd>${race.name} <span class="muted">${race.bonus}</span></dd></dl>
    <div class="lbl">Equipped</div><div class="list">${SLOTS.map(s => { const g = S.eq[s]; return g ? gearRow(g, `<button class="btn" data-unequip="${s}">Remove</button>`, false) : `<div class="row-item"><div class="ri-main"><div class="ri-sub">${SLOT_NAMES[s]}: empty</div></div></div>`; }).join('')}</div>
    <div class="lbl">Crafts · swap any time out of combat. Each levels separately.</div><div class="cards">${CRAFT_IDS.map(id => { const c = CRAFTS[id]; const lx = S.crafts[id]; const on = S.craft === id;
      return `<div class="card ${on ? 'sel' : ''}"><div class="t" style="color:${c.col}">${c.name}</div><div class="muted">${c.role}</div>${lx ? `<div>Lv ${lx.lvl}</div>${bar(lx.xp / craftNeed(lx.lvl), c.col)}${on ? '<div class="lbl" style="color:var(--candle)">Active</div>' : `<button class="btn" data-craft="${id}" ${W.P.combat > 0 ? 'disabled' : ''}>Switch</button>`}` : `<div class="muted">${S.flags.crafts ? 'Learn from Grandmother Wren' : 'Locked'}</div>`}</div>`; }).join('')}</div>
    ${W.P.combat > 0 ? '<p class="warn">In combat: you can switch Crafts in a few seconds.</p>' : ''}</div></div>`;
  return h;
}
function famCard(f: Familiar, opts: { jobs?: boolean; select?: string; selected?: boolean } = {}): string {
  const sp = SPECIES[f.sp], el = ELEMENT_INFO[sp.el]; const ev = EVO[f.stage]; const ess = countItem('ess_' + sp.el);
  let h = `<div class="card fam ${opts.selected ? 'sel' : ''}" ${opts.select ? `data-${opts.select}="${f.uid}"` : ''}><div class="famtop">${ic(famSprite(f.sp, f.stage, 4))}<div><div class="t" style="color:${el.col}">${esc(famName(f))}</div><div class="muted">${sp.names[f.stage - 1]} · <span style="color:${el.col}">${el.name}</span> · Lv ${f.lvl} · Stage ${f.stage}/3</div>${bar(f.xp / famNeed(f.lvl), el.col)}</div></div>`;
  h += `<div class="fstats">${FSTATS.map(k => { const v = famStat(f, k), cap = sp.caps[k]; return `<div class="fs" title="${FSTAT_INFO[k].job}. Potential ${f.pot[k]}% of this species' cap (${cap}).">${FSTAT_INFO[k].name}<b>${v}</b><span class="potbar"><i style="width:${f.pot[k]}%"></i></span><em>${f.pot[k]}%</em></div>`; }).join('')}</div>`;
  h += `<div class="tals"><span class="tal sig" title="${esc(sp.sig.d(sigVal(f)))}">★ ${sp.sig.name}: ${esc(sp.sig.d(sigVal(f)))}</span>${f.tal.map(t => `<span class="tal" title="${esc(TALENT[t].d)}">${TALENT[t].name}: ${esc(TALENT[t].d)}</span>`).join('')}</div>`;
  if (f.rest > 0) h += `<div class="muted">Resting after breeding: ${f.rest} day${f.rest > 1 ? 's' : ''}</div>`;
  if (opts.jobs) {
    h += `<div class="jobs">${(['companion', 'garden', 'forage', 'cauldron', 'rest'] as Job[]).map(j => `<button class="btn sm ${f.job === j ? 'on' : ''}" data-job="${j}" data-fam="${f.uid}" title="${esc(JOB_INFO[j].d)}" ${j === 'companion' && W.P.combat > 0 && f.job !== 'companion' ? 'disabled' : ''}>${JOB_INFO[j].name}</button>`).join('')}</div>`;
    if (ev) { const can = f.lvl >= ev.lvl && ess >= ev.ess; h += `<button class="btn ${can ? 'go' : ''}" data-evolve="${f.uid}" ${can ? '' : 'disabled'}>Evolve to ${sp.names[f.stage]} <span class="muted">(Lv ${ev.lvl}, ${ev.ess} ${el.name} Essence · have ${ess})</span></button>`; }
    else h += '<div class="muted">Final form</div>';
    if (S.fams.length > 1 && f.job !== 'companion') h += `<button class="btn sm ghost" data-release="${f.uid}">Release</button>`;
  }
  return h + '</div>';
}
let confirmRelease = 0;
function famsHTML(): string {
  let h = `<p class="muted">Your companion travels and fights with you and adds its element to your skills. Familiars with home jobs work while you are away: Garden uses <b>Nurture</b>, Forage uses <b>Instinct</b>, Cauldron uses <b>Wit</b>. Potential (the % under each stat) is rolled per familiar and passed down by breeding.</p>`;
  if (confirmRelease) { const f = S.fams.find(x => x.uid === confirmRelease); if (f) h += `<div class="confirm">Release ${esc(famName(f))} back to the wild? It leaves you Familiar Down. <button class="btn" data-release2="${f.uid}">Release</button> <button class="btn" data-cancel="1">Keep</button></div>`; }
  h += `<div class="cards wide">${S.fams.map(f => famCard(f, { jobs: true })).join('')}</div>`;
  const unseen = Object.keys(SPECIES).filter(s => !S.fams.some(f => f.sp === s));
  if (unseen.length) h += `<div class="lbl">Not yet bound</div><div class="cards">${unseen.map(s => `<div class="card dim">${ic(famSprite(s, 1, 4), 'shadowed')}<div class="t">???</div><div class="muted">${SPECIES[s].where}</div></div>`).join('')}</div>`;
  return h;
}
function grimoireHTML(): string {
  let h = `<div class="cols"><div class="col-main"><div class="lbl">Ingredients · you learn one more aspect of an ingredient each time you brew with it</div><div class="list">`;
  const known = Object.keys(S.known).filter(id => ING[id]);
  for (const id of known) { const d = ING[id]; h += `<div class="row-item"><div class="ri-ic">${ic(itemIcon(id, 3))}</div><div class="ri-main"><div class="ri-name">${d.name} <span class="muted">· ${d.source === 'crop' ? 'garden' : d.source === 'forage' ? (d.glimmer ? 'glimmer forage' : 'forage') : 'drop'}</span></div><div class="ri-sub">${aspectPips(id)}</div></div><div class="ri-act muted">×${countItem(id)}</div></div>`; }
  if (!known.length) h += '<p class="muted">Nothing yet.</p>';
  h += `</div></div><div class="col-side"><div class="lbl">Recipes</div><div class="list">`;
  for (const p of POTIONS) { if (p.id === 'murky') continue; const best = S.recipes[p.id];
    const asp = p.asp.map(a => `<span class="pip" style="--c:${ASPECT_INFO[a].col}">${ASPECT_INFO[a].name}</span>`).join('+');
    h += `<div class="row-item ${best ? '' : 'dim'}"><div class="ri-ic">${ic(itemIcon('p_' + p.id, 3))}</div><div class="ri-main"><div class="ri-name">${best || p.asp.length === 1 ? p.name : '???'}</div><div class="ri-sub">${best || p.asp.length === 1 ? asp : '<span class="pip unk">?</span>+<span class="pip unk">?</span>'}${best ? ` · best: ${TIER_NAMES[best]}` : ''}</div></div></div>`; }
  h += `</div><p class="muted">The strongest aspect decides the brew. If the second is at least 40% as strong, you may get a two-aspect brew instead. Boil purifies; Steep favours the second aspect.</p></div></div>`;
  return h;
}
function questHTML(): string {
  const q = QUESTS[S.q.i]; const p = questProgress();
  let h = q ? `<h3>${esc(q.title)}</h3><p>${esc(q.text)}</p><p class="hint">${esc(q.hint)}</p><p class="muted">${p!.done ? 'Complete: return to Grandmother Wren in Hollowmere.' : `Progress: ${p!.have} / ${p!.need}`}</p>` : '<h3>All quests complete</h3><p>More of the world opens in future updates. Keep breeding, brewing and growing.</p>';
  h += `<div class="lbl">Controls</div><div class="ctrl">
    <div><kbd>WASD</kbd> move</div><div><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> Craft skills (aim with the mouse)</div><div><kbd>Click</kbd> use the selected hotbar item (slot 1 is your Craft)</div><div><kbd>E</kbd>/<kbd>Space</kbd>/<kbd>Right-click</kbd> talk, pick, harvest, bind</div>
    <div><kbd>1</kbd>–<kbd>0</kbd>/<kbd>Wheel</kbd> select hotbar</div><div><kbd>C</kbd> use item in front of you</div><div><kbd>B</kbd> mount or land your broom</div><div><kbd>H</kbd> drink your best healing potion</div>
    <div><kbd>Tab</kbd> bag · <kbd>F</kbd> familiars · <kbd>G</kbd> grimoire · <kbd>Q</kbd> quest</div><div><kbd>M</kbd> sound · gamepads work too</div></div>
    <div class="lbl">How a day works</div><p>Days run from 6am to 2am. Sleep in your cottage to grow crops, hatch eggs, get paid for the shipping crate, and save. Water crops every day, or give a familiar the Garden job. Glimmer forage like Glowmoss only shows at night inside your lantern light.</p>`;
  return h;
}
let confirmDelete = false;
function optionsHTML(): string {
  return `<div class="list"><div class="row-item"><div class="ri-main"><div class="ri-name">Sound</div></div><div class="ri-act"><button class="btn" data-act="mute">${audio.muted ? 'Off' : 'On'}</button></div></div>
    <div class="row-item"><div class="ri-main"><div class="ri-name">Save</div><div class="ri-sub">The game saves when you sleep, change areas, and every 20 seconds.</div></div><div class="ri-act"><button class="btn" data-act="save">Save now</button></div></div>
    <div class="row-item"><div class="ri-main"><div class="ri-name">Title screen</div></div><div class="ri-act"><button class="btn" data-act="title">Save &amp; quit to title</button></div></div>
    <div class="row-item"><div class="ri-main"><div class="ri-name">Delete save</div><div class="ri-sub">Erases this witch, every familiar and all progress.</div></div><div class="ri-act">${confirmDelete ? '<button class="btn danger" data-act="delete2">Delete forever</button><button class="btn" data-act="nodelete">Keep</button>' : '<button class="btn" data-act="delete">Delete…</button>'}</div></div></div>
    <p class="muted">Play time ${Math.floor(S.playTime / 60)} min · Day ${S.day}</p>`;
}

// ---------- roost ----------
let nestA = 0, nestB = 0;
export function openRoost() { renderView({ kind: 'roost' }); }
function roostHTML(): string {
  let h = header('Familiar roost');
  const a = S.fams.find(f => f.uid === nestA), b = S.fams.find(f => f.uid === nestB);
  h += `<div class="cols"><div class="col-main"><div class="lbl">Jobs · one familiar per job</div><div class="list">${S.fams.map(f => { const sp = SPECIES[f.sp];
    return `<div class="row-item"><div class="ri-ic">${ic(famSprite(f.sp, f.stage, 3))}</div><div class="ri-main"><div class="ri-name" style="color:${ELEMENT_INFO[sp.el].col}">${esc(famName(f))} <span class="muted">Lv ${f.lvl}</span></div><div class="ri-sub">${FSTATS.map(k => `${FSTAT_INFO[k].name} ${famStat(f, k)}`).join(' · ')}</div><div class="jobs">${(['companion', 'garden', 'forage', 'cauldron', 'rest'] as Job[]).map(j => `<button class="btn sm ${f.job === j ? 'on' : ''}" data-job="${j}" data-fam="${f.uid}" ${j === 'companion' && W.P.combat > 0 && f.job !== 'companion' ? 'disabled' : ''}>${JOB_INFO[j].name}</button>`).join('')}</div></div></div>`; }).join('')}</div></div>`;
  h += `<div class="col-side"><div class="lbl">Nest</div>`;
  if (S.egg) { const pa = S.fams.find(f => f.uid === S.egg!.a), pb = S.fams.find(f => f.uid === S.egg!.b); h += `<div class="detail center">${ic(icon('egg', '#f4ecd8', '#f08ac0', 6))}<p>An egg from ${pa ? esc(famName(pa)) : '?'} and ${pb ? esc(famName(pb)) : '?'}. It hatches after you sleep.</p></div>`; }
  else {
    h += `<p class="muted">Choose two parents (Lv 3+), then lay an egg with a Kinship Draught. Each stat's potential comes from one parent, then shifts −5 to +10, plus a bonus from the draught's quality.</p>`;
    h += `<div class="pick">${S.fams.map(f => `<button class="btn sm ${f.uid === nestA ? 'on' : f.uid === nestB ? 'on2' : ''}" data-parent="${f.uid}">${esc(famName(f))} ${f.lvl}</button>`).join('')}</div>`;
    if (a && b) {
      h += `<div class="lbl">Potentials: ${esc(famName(a))} / ${esc(famName(b))}</div><dl class="stats small">${FSTATS.map(k => `<dt>${FSTAT_INFO[k].name}</dt><dd>${a.pot[k]}% / ${b.pot[k]}%</dd>`).join('')}</dl>`;
      h += `<div class="muted">Talents passed down: ${Array.from(new Set([...a.tal, ...b.tal])).map(t => TALENT[t].name).join(', ')}</div>`;
      const why = canBreed(a, b); h += why ? `<p class="warn">${why}</p>` : `<button class="btn go" data-act="lay">Lay egg (uses a Kinship Draught)</button>`;
    } else h += `<p class="muted">Kinship Draughts owned: ${countItem('p_kinship')}</p>`;
  }
  return h + '</div></div>';
}

// ---------- broom ----------
function broomHTML(): string {
  let h = header('Broom rack');
  const kinds: ['handle' | 'bristle' | 'lantern', string][] = [['handle', 'Handle'], ['bristle', 'Bristles'], ['lantern', 'Lantern']];
  h += `<p class="muted">Press B to fly. Flying passes over trees, water and fences, but you cannot forage, plant or cast while airborne. Your companion's Wing stat adds speed.</p>`;
  for (const [k, n] of kinds) { h += `<div class="lbl">${n}</div><div class="cards">${BROOM_PARTS.filter(p => p.kind === k).map(p => { const owned = S.broom.owned.includes(p.id); const on = S.broom[k] === p.id;
    return `<div class="card ${on ? 'sel' : ''} ${owned ? '' : 'dim'}"><div class="t">${p.name}</div><div class="muted">${p.d}</div>${owned ? (on ? '<div class="lbl" style="color:var(--candle)">Fitted</div>' : `<button class="btn" data-part="${p.id}">Fit</button>`) : `<div class="muted">Sold by Tamsin · ${p.price}g</div>`}</div>`; }).join('')}</div>`; }
  h += `<div class="lbl">Handle dye</div><div class="swatches">${BROOM_DYES.map((c, i) => `<button class="sw ${S.broom.dye === i ? 'sel' : ''}" style="background:${c}" data-dye="${i}" aria-label="Dye ${i + 1}"></button>`).join('')}</div>`;
  return h;
}

// ---------- shipping crate ----------
function crateHTML(): string {
  let h = header('Shipping crate', `<span class="muted">Everything in the crate sells overnight.</span>`);
  const total = S.ship.reduce((s, st) => s + sellPrice(st.id, st.q) * st.n, 0);
  h += `<div class="cols"><div class="col-main"><div class="lbl">Click an item to put the whole stack in the crate</div>${invGrid('ship', id => ITEMS[id].sellable)}</div>`;
  h += `<div class="col-side"><div class="lbl">In the crate · ${total}g</div><div class="list">${S.ship.map((st, i) => `<div class="row-item"><div class="ri-ic">${ic(itemIcon(st.id, 3))}</div><div class="ri-main"><div class="ri-name">${esc(itemTitle(st.id, st.q))} ×${st.n}</div><div class="ri-sub">${sellPrice(st.id, st.q) * st.n}g</div></div><div class="ri-act"><button class="btn sm" data-unship="${i}">Take back</button></div></div>`).join('') || '<p class="muted">Empty.</p>'}</div></div></div>`;
  return h;
}

// ---------- shops ----------
type Stock = { t: 'item'; id: string; q: number; price: number } | { t: 'gear'; g: Gear } | { t: 'part'; id: string };
interface ShopState { id: string; title: string; tab: 'buy' | 'sell'; stock: Stock[]; gearSell: boolean }
const stockCache: Record<string, { day: number; stock: Stock[] }> = {};
function gearStock(slots: Slot[], seed: number): Stock[] {
  const r = rngFrom(S.day * 131 + seed); const tiers = [1, 3, 5, 7, 9].filter(t => t <= witchLv() + 2); const top = tiers[tiers.length - 1];
  const out: Stock[] = []; const seen = new Set<string>();
  const add = (g: Gear) => { const k = g.name + g.lvl + g.rar; if (seen.has(k)) return; seen.add(k); out.push({ t: 'gear', g }); };
  for (const s of Array.from(new Set(slots))) for (let k = 0; k < (s === 'weapon' ? 3 : 2); k++) add(makeGear(s, k === 0 ? Math.max(1, top - 2) : top, k === 0 ? 0 : 1, r, k === 0 ? null : undefined));
  if (r() < 0.5) add(makeGear(pick(slots, r), top, 2, r)); return out;
}
function shopFor(id: string): ShopState {
  const cached = stockCache[id]; let stock: Stock[];
  if (cached && cached.day === S.day) stock = cached.stock;
  else {
    switch (id) {
      case 'marrow': stock = [...CROPS.filter(c => c.id !== 'sweetbriar' || S.flags.crafts).map(c => ({ t: 'item' as const, id: 'seed_' + c.id, q: 0, price: c.seedPrice })), { t: 'item', id: 'charm', q: 0, price: 25 }]; break;
      case 'hettie': stock = gearStock(['hat', 'robe', 'boots'], 7); break;
      case 'corwin': stock = gearStock(['weapon', 'charm'], 13); break;
      case 'tamsin': stock = BROOM_PARTS.filter(p => p.price > 0).map(p => ({ t: 'part' as const, id: p.id })); break;
      case 'ysolde': stock = [{ t: 'item', id: 'argentsalt', q: 2, price: 70 }, { t: 'item', id: 'familiardown', q: 2, price: 55 }, { t: 'item', id: 'glowmoss', q: 2, price: 50 }, { t: 'item', id: 'starbloom', q: 2, price: 140 }, { t: 'item', id: 'seed_sweetbriar', q: 0, price: 22 }, { t: 'item', id: 'charm', q: 0, price: 22 }]; break;
      default: stock = [];
    }
    stockCache[id] = { day: S.day, stock };
  }
  const titles: Record<string, string> = { marrow: "Marrow's Seeds & Sundries", hettie: "Hettie's Hats & Habits", corwin: "Corwin's Wands", tamsin: "Tamsin's Brooms", ysolde: "Ysolde's Hedge Goods" };
  return { id, title: titles[id], tab: 'buy', stock, gearSell: id === 'hettie' || id === 'corwin' };
}
export function openShop(id: string) { renderView({ kind: 'shop', data: shopFor(id) }); }
function shopHTML(s: ShopState): string {
  let h = header(s.title, `<button class="btn ${s.tab === 'buy' ? 'on' : ''}" data-stab="buy">Buy</button><button class="btn ${s.tab === 'sell' ? 'on' : ''}" data-stab="sell">Sell</button><span class="gold">${S.gold}g</span>`);
  if (s.tab === 'buy') {
    h += `<div class="list">${s.stock.map((st, i) => {
      if (st.t === 'item') { const d = ITEMS[st.id]; return `<div class="row-item"><div class="ri-ic">${ic(itemIcon(st.id, 3))}</div><div class="ri-main"><div class="ri-name">${esc(d.name)} ${qStars(st.id, st.q)} <span class="muted">· have ${countItem(st.id)}</span></div><div class="ri-sub">${itemDesc(st.id, st.q)}</div></div><div class="ri-act"><button class="btn" data-buy="${i}" ${S.gold < st.price ? 'disabled' : ''}>Buy ${st.price}g</button><button class="btn sm" data-buy5="${i}" ${S.gold < st.price * 5 ? 'disabled' : ''}>×5</button></div></div>`; }
      if (st.t === 'gear') return gearRow(st.g, `<button class="btn" data-buy="${i}" ${S.gold < st.g.price ? 'disabled' : ''}>Buy ${st.g.price}g</button>`);
      const p = BPART[st.id]; const owned = S.broom.owned.includes(p.id);
      return `<div class="row-item"><div class="ri-ic">${ic(icon(p.kind === 'lantern' ? 'lantern' : 'broom', p.col, p.col === '#000000' ? '#555' : '#e0c070', 3))}</div><div class="ri-main"><div class="ri-name">${p.name}</div><div class="ri-sub">${p.d}</div></div><div class="ri-act">${owned ? '<span class="muted">Owned</span>' : `<button class="btn" data-buy="${i}" ${S.gold < p.price ? 'disabled' : ''}>Buy ${p.price}g</button>`}</div></div>`;
    }).join('') || '<p class="muted">Sold out today.</p>'}</div>`;
  } else {
    h += `<div class="lbl">Click an item to sell one</div>${invGrid('sell', id => ITEMS[id].sellable)}`;
    if (s.gearSell) h += `<div class="lbl">Spare gear</div><div class="list">${S.bag.map(g => gearRow(g, `<button class="btn" data-sellgear="${g.uid}">Sell ${Math.round(g.price * 0.4)}g</button>`)).join('') || '<p class="muted">No spare gear.</p>'}</div>`;
  }
  return h;
}

// ---------- order board ----------
function boardHTML(): string {
  refreshOrders();
  let h = header('Hollowmere order board');
  h += `<div class="list">${S.orders.map((o, i) => { const p = POTION[o.potion]; const have = countItem('p_' + o.potion, o.minTier);
    return `<div class="row-item ${o.done ? 'dim' : ''}"><div class="ri-ic">${ic(itemIcon('p_' + o.potion, 3))}</div><div class="ri-main"><div class="ri-name">${o.n}× ${p.name}</div><div class="ri-sub">${TIER_NAMES[o.minTier]} quality or better · you have ${have}</div></div><div class="ri-act">${o.done ? '<span class="muted">Delivered</span>' : `<button class="btn ${have >= o.n ? 'go' : ''}" data-order="${i}" ${have >= o.n ? '' : 'disabled'}>Deliver · ${o.reward}g</button>`}</div></div>`; }).join('')}</div>`;
  h += `<div class="lbl">Bounty</div><div class="row-item"><div class="ri-main"><div class="ri-name">Mags Redhand, Roadcutter chief</div><div class="ri-sub">Camps south of the King's Road in Brindlewood. 250 gold.</div></div><div class="ri-act">${S.flags.magsPaid ? '<span class="muted">Paid</span>' : S.bosses.mags ? '<button class="btn go" data-act="bounty">Claim 250g</button>' : '<span class="muted">Wanted</span>'}</div></div>`;
  h += `<p class="muted">New orders are posted every morning.</p>`;
  return h;
}

// ---------- npcs ----------
export function talkTo(n: NpcDef) {
  if (n.id === 'wren') { wrenTalk(); return; }
  const greet: Record<string, string> = { marrow: 'Seeds, charms, the usual. Mind the Moonpetal, it bites.', hettie: 'A witch is nothing without a good hat, dear.', corwin: 'Wands for quick hands, staves for heavy ones.', tamsin: 'A broom is a living thing. Treat it well and it flies true.', ysolde: 'The Order nearly had me. Anything I have is yours at a fair price.' };
  say([{ who: n.name, text: greet[n.id] || 'Hello.' }], () => openShop(n.id));
}
function wrenTalk() {
  const q = QUESTS[S.q.i]; const p = questProgress();
  if (q && p && p.done) {
    const rw = q.reward; S.gold += rw.gold || 0; const got: string[] = [];
    for (const [id, qq, n] of rw.items || []) { addItem(id, qq, n); got.push(`${n} ${ITEMS[id].name}`); }
    if (rw.gear) { const g = makeGear(rw.gear.slot, rw.gear.lvl, rw.gear.rar); S.bag.push(g); got.push(g.name); }
    if (rw.part && !S.broom.owned.includes(rw.part)) { S.broom.owned.push(rw.part); got.push(BPART[rw.part].name); }
    for (const f of rw.flags || []) S.flags[f] = true;
    const lines: Line[] = [{ who: 'Grandmother Wren', text: q.done }, { who: '', text: `Reward: ${rw.gold || 0} gold${got.length ? ', ' + got.join(', ') : ''}.` }];
    S.q.i++; const nq = QUESTS[S.q.i]; if (nq) { startQuest(); lines.push({ who: 'Grandmother Wren', text: nq.text }); }
    sfx('level'); saveNow(); hooks.hud(); say(lines, () => { checkQuest(); }); return;
  }
  const lines: Line[] = q ? [{ who: 'Grandmother Wren', text: q.text }, { who: 'Grandmother Wren', text: `So far: ${p!.have} of ${p!.need}. ${q.hint}` }] : [{ who: 'Grandmother Wren', text: pick(WREN_IDLE) }];
  if (q && S.q.i > 0 && Math.random() < 0.4) lines.push({ who: 'Grandmother Wren', text: pick(WREN_IDLE) });
  say(lines, () => { if (S.flags.crafts) renderView({ kind: 'learn' }); });
}
function learnHTML(): string {
  let h = header('Learn a Craft', `<span class="gold">${S.gold}g</span>`);
  h += `<p>Wren can teach you another Craft for ${CRAFT_LEARN_PRICE} gold. New Crafts start at Lv 1, and you can switch between them any time out of combat.</p><div class="cards">`;
  for (const id of CRAFT_IDS) { const c = CRAFTS[id]; const has = !!S.crafts[id];
    h += `<div class="card"><div class="t" style="color:${c.col}">${c.name}</div><div class="muted">${c.role}</div><p>${c.blurb}</p><p class="muted">${c.passive}</p><div class="muted">${c.skills.map(s => s.name).join(' · ')}</div>${has ? '<div class="lbl">Known</div>' : `<button class="btn go" data-learn="${id}" ${S.gold < CRAFT_LEARN_PRICE ? 'disabled' : ''}>Learn · ${CRAFT_LEARN_PRICE}g</button>`}</div>`; }
  return h + '</div>';
}

// ---------- sleep & morning ----------
export function askSleep() {
  const late = S.time >= 18 * 60;
  openModal(`${header('Your cottage')}<p>${late ? 'The fire is low and the bed is warm.' : 'It is still early. Sleeping now skips the rest of the day.'}</p><p class="muted">Sleeping grows your crops, hatches eggs, pays for the shipping crate, refreshes forage and orders, and saves.</p><div class="btnrow"><button class="btn go" data-act="sleep">Sleep until morning</button><button class="btn" data-act="close">Stay up</button></div>`, { kind: 'sleep' });
}
export function showMorning(lines: string[]) {
  openModal(`<div class="center"><h2>Day ${S.day}</h2><div class="muted">${S.rain ? 'Rain on the roof.' : 'A clear morning.'}</div></div><div class="list">${lines.map(l => `<div class="row-item"><div class="ri-main">${esc(l)}</div></div>`).join('') || '<p class="muted">A quiet night.</p>'}</div><div class="btnrow center"><button class="btn go" data-act="close">Start the day</button></div>`, { kind: 'morning' });
}

// ---------- events ----------
export function initMenus() {
  setInputHandlers({
    menu: (tab?: string) => openMenu(tab), close: () => closeModal(), advance: () => advanceDlg(),
    modalKey: (k: string) => { if (view?.kind === 'cauldron') return cauldronKey(k); if (onModalKey) return onModalKey(k); if (view?.kind === 'menu' && ((k === 'f' && view.tab === 'fams') || (k === 'g' && view.tab === 'grimoire') || (k === 'q' && view.tab === 'quest'))) { closeModal(); return true; } return false; },
  });
  $('dialog').addEventListener('click', advanceDlg);
  $('modal').addEventListener('click', e => { if (e.target === $('modal') && view && !['create', 'title', 'cauldron'].includes(view.kind)) closeModal(); });
  hooks.say = say;
  hooks.open = (kind: string, arg?: unknown) => {
    switch (kind) {
      case 'npc': talkTo(arg as NpcDef); break; case 'sleep': askSleep(); break; case 'cauldron': renderView({ kind: 'cauldron' }); break; case 'roost': openRoost(); break;
      case 'broom': renderView({ kind: 'broom' }); break; case 'crate': renderView({ kind: 'crate' }); break; case 'board': renderView({ kind: 'board' }); break;
      case 'morning': showMorning((arg as { lines: string[] }).lines); break;
    }
  };
  $('win').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b || b.disabled) return; const d = b.dataset; if (!view) return;
    if (view.kind === 'create' || view.kind === 'title' || view.kind === 'cauldron') return;
    if (d.act === 'close') { closeModal(); return; }
    if (d.tab) { selInv = null; confirmRelease = 0; confirmDelete = false; renderView({ kind: 'menu', tab: d.tab }); return; }
    // bag
    if (d.inv !== undefined) { const i = Number(d.inv); if (selInv !== null && selInv !== i) { const t = S.inv[i]; S.inv[i] = S.inv[selInv]; S.inv[selInv] = t; selInv = null; sfx('equip'); } else selInv = selInv === i ? null : (S.inv[i] ? i : null); rerender(); hooks.hud(); return; }
    if (d.drink !== undefined) { usePotion(Number(d.drink)); if (!S.inv[Number(d.drink)]) selInv = null; rerender(); return; }
    if (d.trash !== undefined) { removeAt(Number(d.trash)); if (!S.inv[Number(d.trash)]) selInv = null; rerender(); hooks.hud(); return; }
    if (d.equip) { const i = S.bag.findIndex(g => g.uid === Number(d.equip)); if (i >= 0) { const g = S.bag[i]; const cur = S.eq[g.slot]; S.bag.splice(i, 1); if (cur) S.bag.push(cur); S.eq[g.slot] = g; sfx('equip'); refresh(); } rerender(); return; }
    if (d.unequip) { const s = d.unequip as Slot; const g = S.eq[s]; if (g) { if (S.bag.length >= 40) { hooks.toast('Gear bag is full.', 'bad'); return; } delete S.eq[s]; S.bag.push(g); refresh(); } rerender(); return; }
    if (d.craft) { if (W.P.combat > 0) return; S.craft = d.craft as CraftId; W.P.cd = [0, 0, 0]; W.P.wild = 0; W.P.circle = 0; W.allies = []; W.zones = W.zones.filter(z => z.own !== 'p'); refresh(); W.P.hp = Math.min(W.P.hp, W.st.maxHp); hooks.toast(`You are now a ${CRAFTS[S.craft].name}.`, 'good'); sfx('buff'); rerender(); return; }
    // familiars
    if (d.job && d.fam) { const f = S.fams.find(x => x.uid === Number(d.fam)); if (!f) return; const j = d.job as Job; if (j === 'companion' && W.P.combat > 0) return;
      if (j !== 'rest') for (const o of S.fams) if (o.job === j && o !== f) o.job = 'rest'; f.job = j; refresh(); sfx('equip'); rerender(); return; }
    if (d.evolve) { const f = S.fams.find(x => x.uid === Number(d.evolve)); if (!f) return; const sp = SPECIES[f.sp]; const ev = EVO[f.stage]; if (ev && f.lvl >= ev.lvl && removeItem('ess_' + sp.el, ev.ess)) { const old = sp.names[f.stage - 1]; f.stage++; sfx('evolve'); hooks.banner('EVOLUTION!', `${old} became ${sp.names[f.stage - 1]}`); refresh(); saveNow(); } rerender(); return; }
    if (d.release) { confirmRelease = Number(d.release); rerender(); return; }
    if (d.release2) { const i = S.fams.findIndex(x => x.uid === Number(d.release2)); if (i >= 0) { S.fams.splice(i, 1); addItem('familiardown', 2, 1); hooks.toast('Released. It left some Familiar Down.', 'dim'); } confirmRelease = 0; refresh(); rerender(); return; }
    if (d.cancel) { confirmRelease = 0; rerender(); return; }
    if (d.parent) { const u = Number(d.parent); if (nestA === u) nestA = 0; else if (nestB === u) nestB = 0; else if (!nestA) nestA = u; else nestB = u; rerender(); return; }
    if (d.act === 'lay') { const a = S.fams.find(f => f.uid === nestA), b2 = S.fams.find(f => f.uid === nestB); if (a && b2 && !canBreed(a, b2)) { const tier = layEgg(a, b2); hooks.toast(`An egg! (${TIER_NAMES[tier]} Kinship Draught) It hatches after you sleep.`, 'good'); sfx('bind'); nestA = nestB = 0; saveNow(); } rerender(); return; }
    // broom
    if (d.part) { const p = BPART[d.part]; if (S.broom.owned.includes(p.id)) { (S.broom as unknown as Record<string, string>)[p.kind] = p.id; sfx('equip'); W.P.stam = Math.min(W.P.stam, BPART[S.broom.handle].stam || 100); } rerender(); return; }
    if (d.dye !== undefined) { S.broom.dye = Number(d.dye); rerender(); return; }
    // crate
    if (d.ship !== undefined) { const i = Number(d.ship); const st = S.inv[i]; if (!st || !ITEMS[st.id].sellable) return; const ex = S.ship.find(x => x.id === st.id && x.q === st.q); if (ex) ex.n += st.n; else S.ship.push({ ...st }); S.inv[i] = null; sfx('coin'); rerender(); hooks.hud(); return; }
    if (d.unship !== undefined) { const st = S.ship[Number(d.unship)]; if (st) { const left = addItem(st.id, st.q, st.n); if (left) st.n = left; else S.ship.splice(Number(d.unship), 1); } rerender(); hooks.hud(); return; }
    // shop
    if (d.stab && view.kind === 'shop') { (view.data as ShopState).tab = d.stab as 'buy' | 'sell'; rerender(); return; }
    if ((d.buy !== undefined || d.buy5 !== undefined) && view.kind === 'shop') { const s = view.data as ShopState; const i = Number(d.buy ?? d.buy5); const st = s.stock[i]; const n = d.buy5 !== undefined ? 5 : 1;
      if (st.t === 'item') { if (S.gold < st.price * n) return; const left = addItem(st.id, st.q, n); if (left === n) { hooks.toast('Your bag is full.', 'bad'); return; } S.gold -= st.price * (n - left); sfx('coin'); }
      else if (st.t === 'gear') { if (S.gold < st.g.price) return; if (S.bag.length >= 40) { hooks.toast('Gear bag is full.', 'bad'); return; } S.gold -= st.g.price; S.bag.push(st.g); s.stock.splice(i, 1); sfx('equip'); hooks.toast(`Bought ${esc(st.g.name)}. Equip it from your Bag (Tab).`, ''); }
      else { const p = BPART[st.id]; if (S.gold < p.price || S.broom.owned.includes(p.id)) return; S.gold -= p.price; S.broom.owned.push(p.id); sfx('equip'); hooks.toast(`${p.name} bought. Fit it at the broom rack at home.`, 'good'); }
      rerender(); hooks.hud(); return; }
    if (d.sell !== undefined) { const i = Number(d.sell); const st = S.inv[i]; if (!st || !ITEMS[st.id].sellable) return; S.gold += sellPrice(st.id, st.q); removeAt(i); sfx('coin'); rerender(); hooks.hud(); return; }
    if (d.sellgear) { const i = S.bag.findIndex(g => g.uid === Number(d.sellgear)); if (i >= 0) { S.gold += Math.round(S.bag[i].price * 0.4); S.bag.splice(i, 1); sfx('coin'); } rerender(); hooks.hud(); return; }
    // board
    if (d.order !== undefined) { const o = S.orders[Number(d.order)]; if (o && !o.done && countItem('p_' + o.potion, o.minTier) >= o.n) { removeItem('p_' + o.potion, o.n, o.minTier); o.done = true; S.gold += o.reward; sfx('coin'); hooks.toast(`Delivered! +${o.reward}g`, 'good'); } rerender(); hooks.hud(); return; }
    if (d.act === 'bounty') { if (S.bosses.mags && !S.flags.magsPaid) { S.flags.magsPaid = true; S.gold += 250; sfx('coin'); hooks.toast('Bounty paid: 250g', 'good'); } rerender(); hooks.hud(); return; }
    if (d.learn) { const id = d.learn as CraftId; if (!S.crafts[id] && S.gold >= CRAFT_LEARN_PRICE) { S.gold -= CRAFT_LEARN_PRICE; S.crafts[id] = { lvl: 1, xp: 0 }; sfx('level'); hooks.toast(`You learned the ${CRAFTS[id].name} Craft. Switch to it from the Witch tab (Esc).`, 'good'); } rerender(); hooks.hud(); return; }
    // sleep / options
    if (d.act === 'sleep') { $('modal').hidden = true; game.modal = false; view = null; sleep(false); return; }
    if (d.act === 'mute') { audio.muted = !audio.muted; rerender(); return; }
    if (d.act === 'save') { saveNow(); hooks.toast('Saved.', 'good'); return; }
    if (d.act === 'title') { saveNow(); $('modal').hidden = true; game.modal = false; view = null; showTitle(); return; }
    if (d.act === 'delete') { confirmDelete = true; rerender(); return; }
    if (d.act === 'nodelete') { confirmDelete = false; rerender(); return; }
    if (d.act === 'delete2') { confirmDelete = false; deleteSave(); $('modal').hidden = true; game.modal = false; view = null; game.playing = false; showTitle(); return; }
  });
  void saveGame; void isNight; void ASPECTS; void TIER_MULT; void companion; void hasTal;
}
export function currentView() { return view; }
