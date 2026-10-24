import {
  S, addItem, removeItem, removeAt, countItem, companion, partyFams, famStat, famName, famNeed, sigVal, witchLv, craftLv, craftNeed, lifeNeed,
  raceDef, deleteSave, Familiar, setJob, craftProg, treePoints, canTakeNode, unlockedAdv, comfort, Stack,
} from '../core/state';
import { W, hooks, refresh, usePotion, sleep, saveNow, Line, refreshOrders, isNight, swapFamiliar } from '../world/world';
import { questTalk, questDef, isReady, stepProgress, turnIn, takeBounty, refreshBounties, activeQ, startDefense, offersFrom } from '../world/quests';
import { spawnWild, skillFor } from '../world/combat';
import { CRAFTS, CRAFT_IDS, CRAFT_LEARN_PRICE, CraftId, RESPEC_PRICE, TIER_LVL } from '../data/crafts';
import { SPECIES, FSTATS, FSTAT_INFO, TALENT, JOB_INFO, Job, EVO, ELEMENT_INFO, BEATS, ELEMENTS } from '../data/familiars';
import { ITEMS, sellPrice } from '../data/items';
import { ING, ASPECT_INFO, POTIONS, POTION, TIER_NAMES, CROPS, Aspect } from '../data/brewing';
import { Gear, SLOTS, SLOT_NAMES, STAT_NAMES, RARITY, AFFIX_INFO, makeGear, BROOM_PARTS, BPART, BROOM_DYES, StatKey, Slot } from '../data/gear';
import { FURNITURE, FURN, WALLPAPER_PRICE, FLOOR_PRICE } from '../data/furniture';
import { NPC_NAMES } from '../data/quests';
import { WALLPAPERS, FLOORS } from '../world/terrain';
import { itemIcon, famSprite, charSprite, icon } from '../art/sprites';
import { furnSprite } from '../art/furniture16';
import { url } from '../art/pixel';
import { esc, rngFrom, pick, clamp, T } from '../core/util';
import { sfx, audio } from '../core/audio';
import { game } from './state';
import { setInputHandlers } from './input';
import { openCauldron, cauldronKey } from './brew';
import { openBind } from './bind';
import { canBreed, layEgg } from '../world/breed';
import { NpcDef, Prop } from '../world/maps';
import { playerLook } from '../scenes/WorldScene';
import { showTitle } from './title';
import type { Enemy } from '../world/combat';

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
  $('modal').hidden = true; game.modal = false; view = null; onModalKey = null; hooks.hud();
}
export function rerender() { if (!view) return; renderView(view); }
function renderView(v: View) {
  switch (v.kind) {
    case 'menu': openModal(menuHTML(v.tab!), v); break;
    case 'roost': openModal(roostHTML(), v); break;
    case 'broom': openModal(broomHTML(), v); break;
    case 'crate': openModal(crateHTML(), v); break;
    case 'chest': openModal(chestHTML(), v); break;
    case 'shop': openModal(shopHTML(v.data as ShopState), v); break;
    case 'board': openModal(boardHTML(), v); break;
    case 'learn': openModal(learnHTML(), v); break;
    case 'shrine': openModal(shrineHTML(v.data as Prop), v); break;
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
function aspectPips(id: string): string {
  const d = ING[id]; if (!d) return ''; const known = S.known[id] || 0;
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
function gearIcon(g: Gear) { const col = RARITY[g.rar].col; const name = g.slot === 'weapon' ? (g.wtype === 'staff' ? 'staff' : 'wand') : g.slot === 'charm' ? 'charmi' : g.slot; return icon(name, g.slot === 'hat' ? (g.hatCol || '#2a2140') : col, col, true, { c: '#a07a50' }); }
function gearRow(g: Gear, actions: string, compare = true) { return `<div class="row-item"><div class="ri-ic">${ic(gearIcon(g))}</div><div class="ri-main"><div class="ri-name" style="color:${RARITY[g.rar].col}">${esc(g.name)}</div><div class="ri-sub">${SLOT_NAMES[g.slot]} · Lv ${g.lvl} · ${RARITY[g.rar].name}</div><div class="ri-sub">${statLine(g)}</div>${compare ? `<div class="ri-sub">${compareLine(g)}</div>` : ''}</div><div class="ri-act">${actions}</div></div>`; }
function bar(f: number, col: string) { return `<div class="mbar"><i style="width:${clamp(f, 0, 1) * 100}%;background:${col}"></i></div>`; }
function header(title: string, extra = '') { return `<div class="whead"><h2>${title}</h2>${extra}<div class="spacer"></div><button class="btn" data-act="close">Close · Esc</button></div>`; }
const elTag = (el: keyof typeof ELEMENT_INFO) => `<span style="color:${ELEMENT_INFO[el].col}">${ELEMENT_INFO[el].name}</span>`;

// ---------- main menu ----------
const TABS: [string, string][] = [['bag', 'Bag'], ['witch', 'Witch'], ['skills', 'Skills'], ['fams', 'Familiars'], ['quest', 'Quests'], ['grimoire', 'Grimoire'], ['options', 'Options']];
export function openMenu(tab = 'bag') { selInv = null; renderView({ kind: 'menu', tab }); }
function menuHTML(tab: string): string {
  let h = `<div class="whead tabs">${TABS.map(([k, n]) => `<button class="btn ${tab === k ? 'on' : ''}" data-tab="${k}">${n}${k === 'skills' && treePoints() > 0 ? ' ★' : ''}</button>`).join('')}<div class="spacer"></div><button class="btn" data-act="close">Close · Esc</button></div>`;
  switch (tab) { case 'bag': h += bagHTML(); break; case 'witch': h += witchHTML(); break; case 'skills': h += skillsHTML(); break; case 'fams': h += famsHTML(); break; case 'grimoire': h += grimoireHTML(); break; case 'quest': h += questHTML(); break; case 'options': h += optionsHTML(); break; }
  return h;
}
function invGrid(inv: (Stack | null)[], clickData = 'inv', filter?: (id: string) => boolean, hotbar = true): string {
  return `<div class="invgrid">${inv.map((st, i) => { const hb = hotbar && i < 10 ? 'hb' : ''; if (!st) return `<button class="islot empty ${hb}" data-${clickData}="${i}"></button>`; const d = ITEMS[st.id]; const dim = filter && !filter(st.id) ? ' dimmed' : '';
    const icn = st.id === 'wand' ? icon(CRAFTS[S.craft].skills[0].icon, CRAFTS[S.craft].col, CRAFTS[S.craft].light) : itemIcon(st.id);
    return `<button class="islot ${hb}${selInv === i && clickData === 'inv' ? ' sel' : ''}${dim}" data-${clickData}="${i}" title="${esc(itemTitle(st.id, st.q))}">${ic(icn)}${d.stack && st.n > 1 ? `<span class="n">${st.n}</span>` : ''}${d.kind === 'potion' ? `<span class="tier t${st.q}">${'◆'.repeat(st.q)}</span>` : d.kind === 'ingredient' ? `<span class="tier q${st.q}">${'★'.repeat(st.q)}</span>` : ''}</button>`; }).join('')}</div>`;
}
function bagHTML(): string {
  let h = `<div class="cols"><div class="col-main"><div class="lbl">Bag · top row is your hotbar (1–0). Click an item, then another slot to swap.</div>${invGrid(S.inv)}`;
  h += `<div class="lbl" style="margin-top:12px">Gear bag (${S.bag.length}/40)</div>`;
  h += S.bag.length ? `<div class="list">${S.bag.slice().sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || b.lvl - a.lvl).map(g => gearRow(g, `<button class="btn" data-equip="${g.uid}" ${witchLv() < g.lvl ? 'disabled' : ''}>${witchLv() < g.lvl ? `Needs Lv ${g.lvl}` : 'Equip'}</button>`)).join('')}</div>` : '<p class="muted">No spare gear. Enemies, bosses and shops have more.</p>';
  h += `</div><div class="col-side">`;
  const st = selInv !== null ? S.inv[selInv] : null;
  if (st) { const d = ITEMS[st.id]; const p = d.kind === 'potion' ? POTION[st.id.slice(2)] : null;
    h += `<div class="detail">${ic(st.id === 'wand' ? icon(CRAFTS[S.craft].skills[0].icon, CRAFTS[S.craft].col, CRAFTS[S.craft].light) : itemIcon(st.id), 'big')}<h3>${esc(itemTitle(st.id, st.q))}</h3><div>${qStars(st.id, st.q)} ${d.stack ? `×${st.n}` : ''}</div><p>${itemDesc(st.id, st.q)}</p>
      ${d.sellable ? `<p class="muted">Sells for ${sellPrice(st.id, st.q)}g each.</p>` : ''}
      <div class="btnrow">${p && p.use === 'drink' ? `<button class="btn go" data-drink="${selInv}">Drink</button>` : ''}${d.sellable ? `<button class="btn" data-trash="${selInv}">Discard 1</button>` : ''}</div></div>`; }
  else h += `<div class="detail muted">Select an item to see what it does.</div>`;
  h += `<div class="lbl">Purse</div><div class="big-num">${S.gold}g</div></div></div>`;
  return h;
}
function witchHTML(): string {
  const st = W.st, race = raceDef(); const cd = CRAFTS[S.craft];
  let h = `<div class="cols"><div class="col-side"><div class="detail center">${ic(charSprite(playerLook(), 'down', 0, 2), 'witch')}<h3>${esc(S.name)}</h3><div class="muted">${race.name} · ${cd.name} Lv ${craftLv()}</div><div class="muted">Witch level ${witchLv()} (highest Craft)</div></div>
    <div class="lbl">Life skills</div>${(['garden', 'forage', 'brew'] as const).map(k => `<div class="kv"><span>${{ garden: 'Gardening', forage: 'Foraging', brew: 'Brewing' }[k]}</span><b>Lv ${S.life[k].lvl}</b></div>${bar(S.life[k].xp / lifeNeed(S.life[k].lvl), '#a8d65a')}`).join('')}
    <div class="lbl">Home</div><div class="kv"><span>Comfort</span><b>${comfort()}</b></div><div class="kv"><span>Energy each morning</span><b>${100 + Math.min(50, comfort())}</b></div></div>
    <div class="col-main"><div class="lbl">Stats</div><dl class="stats">
    <dt>HP</dt><dd>${st.maxHp}</dd><dt>MP</dt><dd>${st.maxMp}</dd><dt>Power</dt><dd>${Math.round(st.pow)}</dd><dt>Ward</dt><dd>${Math.round(st.ward)} <span class="muted">(−${Math.round(100 - 6000 / (60 + st.ward))}% damage)</span></dd>
    <dt>Speed</dt><dd>${Math.round(st.spd)}</dd><dt>Crit</dt><dd>${Math.round(st.crit * 100)}%</dd><dt>Familiar power</dt><dd>×${st.famMult.toFixed(2)}</dd>
    <dt>Element</dt><dd>${st.el ? `${elTag(st.el)} · strong vs ${BEATS[st.el].map(elTag).join(', ')} · weak vs ${ELEMENTS.filter(e => BEATS[e].includes(st.el!)).map(elTag).join(', ')}` : 'None'}</dd>
    <dt>Race</dt><dd>${race.name} <span class="muted">${race.bonus}</span></dd></dl>
    <div class="lbl">Equipped</div><div class="list">${SLOTS.map(s => { const g = S.eq[s]; return g ? gearRow(g, `<button class="btn" data-unequip="${s}">Remove</button>`, false) : `<div class="row-item"><div class="ri-main"><div class="ri-sub">${SLOT_NAMES[s]}: empty</div></div></div>`; }).join('')}</div>
    <div class="lbl">Crafts · swap any time out of combat. Each levels separately.</div><div class="cards">${CRAFT_IDS.map(id => { const c = CRAFTS[id]; const lx = S.crafts[id]; const on = S.craft === id;
      return `<div class="card ${on ? 'sel' : ''}"><div class="t" style="color:${c.col}">${c.name}</div><div class="muted">${c.role}</div>${lx ? `<div>Lv ${lx.lvl}</div>${bar(lx.xp / craftNeed(lx.lvl), c.col)}${on ? '<div class="lbl" style="color:var(--candle)">Active</div>' : `<button class="btn" data-craft="${id}" ${W.P.combat > 0 ? 'disabled' : ''}>Switch</button>`}` : `<div class="muted">${S.flags.crafts ? 'Learn from Grandmother Wren' : 'Locked'}</div>`}</div>`; }).join('')}</div>
    ${W.P.combat > 0 ? '<p class="warn">In combat: you can switch Crafts in a few seconds.</p>' : ''}</div></div>`;
  return h;
}
function skillCard(i: number): string {
  const cd = CRAFTS[S.craft]; const s = skillFor(i); const key = 'JKLU'[i];
  if (!s) return `<div class="card dim"><div class="t"><kbd>${key}</kbd> Advanced slot</div><div class="muted">Learn a tier-3 node in your tree to unlock an advanced skill, then slot it here.</div></div>`;
  const locked = i < 3 && craftLv() < s.lvl;
  return `<div class="card ${locked ? 'dim' : ''}"><div class="t">${ic(icon(s.icon, cd.col, cd.light))} <kbd>${key}</kbd> ${esc(s.name)}</div><div class="small">${esc(s.desc)}</div><div class="muted small">${s.mp ? `${s.mp} MP · ` : ''}${s.cd}s cooldown${locked ? ` · unlocks at Lv ${s.lvl}` : ''}</div></div>`;
}
function skillsHTML(): string {
  const cd = CRAFTS[S.craft]; const cp = craftProg(); const pts = treePoints(); const adv = unlockedAdv();
  let h = `<div class="cols"><div class="col-main"><div class="whead2"><h3 style="color:${cd.col}">${cd.name} · Lv ${cp.lvl}</h3><span class="${pts ? 'hint' : 'muted'}">${pts} skill point${pts === 1 ? '' : 's'} to spend</span></div>
    <p class="muted small">You earn a point each level. Deeper tiers need a higher level and the node above them. Tier 3 of each branch unlocks an advanced skill for your U key. ${cd.passive}</p>
    <div class="tree">${cd.branches.map((bn, b) => `<div class="branch"><div class="lbl">${bn}</div>${[1, 2, 3, 4].map(tier => { const n = cd.tree.find(x => x.branch === b && x.tier === tier)!; const have = cp.nodes.includes(n.id); const why = canTakeNode(n);
      return `<button class="node ${have ? 'have' : why ? 'locked' : 'open'}" data-node="${n.id}" ${have || why ? 'disabled' : ''} title="${esc(why || '')}"><span class="nt">${esc(n.name)}</span><span class="nd">${esc(n.d)}</span><span class="nl">${have ? 'Learned' : `Tier ${tier} · Lv ${TIER_LVL[tier]}`}</span></button>`; }).join('')}</div>`).join('')}</div>
    <p class="muted small">Grandmother Wren can unlearn your tree for ${RESPEC_PRICE} gold.</p></div>
    <div class="col-side"><div class="lbl">Your skills</div>${[0, 1, 2, 3].map(skillCard).join('')}
    <div class="lbl">Advanced skill on U</div><div class="list">${cd.adv.map((s, i) => adv.includes(i) ? `<button class="row-item btnlike ${cp.adv === i ? 'sel' : ''}" data-adv="${i}">${ic(icon(s.icon, cd.col, cd.light))}<div class="ri-main"><div class="ri-name">${esc(s.name)}${cp.adv === i ? ' · slotted' : ''}</div><div class="ri-sub">${esc(s.desc)}</div></div></button>` : `<div class="row-item dim"><div class="ri-main"><div class="ri-name">${esc(s.name)}</div><div class="ri-sub">Locked: ${cd.branches[i === 0 ? 0 : i === 1 ? 1 : 2]} tier 3</div></div></div>`).join('')}</div></div></div>`;
  return h;
}
function famCard(f: Familiar, opts: { jobs?: boolean } = {}): string {
  const sp = SPECIES[f.sp], el = ELEMENT_INFO[sp.el]; const ev = EVO[f.stage]; const ess = countItem('ess_' + sp.el); const party = partyFams(); const active = companion() === f;
  let h = `<div class="card fam ${active ? 'sel' : ''}"><div class="famtop">${ic(famSprite(f.sp, f.stage))}<div><div class="t" style="color:${el.col}">${esc(famName(f))}${active ? ' · active' : f.job === 'party' ? ' · party' : ''}</div><div class="muted">${sp.names[f.stage - 1]} · ${elTag(sp.el)} · Lv ${f.lvl} · Stage ${f.stage}/3</div>${bar(f.xp / famNeed(f.lvl), el.col)}</div></div>`;
  h += `<div class="fstats">${FSTATS.map(k => { const v = famStat(f, k), cap = sp.caps[k]; return `<div class="fs" title="${FSTAT_INFO[k].job}. Potential ${f.pot[k]}% of this species' cap (${cap}).">${FSTAT_INFO[k].name}<b>${v}</b><span class="potbar"><i style="width:${f.pot[k]}%"></i></span><em>${f.pot[k]}%</em></div>`; }).join('')}</div>`;
  h += `<div class="tals"><span class="tal act">◆ ${esc(sp.act.name)} (O): ${esc(sp.act.d)} <span class="muted">${sp.act.cd}s</span></span><span class="tal sig">★ ${sp.sig.name}: ${esc(sp.sig.d(sigVal(f)))}</span><span class="tal ${f.stage >= 3 ? 'sig' : 'muted'}">✦ ${esc(sp.evo.name)}${f.stage >= 3 ? '' : ' (final form)'}: ${esc(sp.evo.d)}</span>${f.tal.map(t => `<span class="tal">${TALENT[t].name}: ${esc(TALENT[t].d)}</span>`).join('')}</div>`;
  if (f.rest > 0) h += `<div class="muted">Resting after breeding: ${f.rest} day${f.rest > 1 ? 's' : ''}</div>`;
  if (opts.jobs) {
    h += `<div class="jobs">${(['party', 'garden', 'forage', 'cauldron', 'rest'] as Job[]).map(j => `<button class="btn sm ${f.job === j ? 'on' : ''}" data-job="${j}" data-fam="${f.uid}" title="${esc(JOB_INFO[j].d)}">${JOB_INFO[j].name}</button>`).join('')}${f.job === 'party' && !active ? `<button class="btn sm go" data-activate="${f.uid}">Make active</button>` : ''}</div>`;
    if (ev) { const can = f.lvl >= ev.lvl && ess >= ev.ess; h += `<button class="btn ${can ? 'go' : ''}" data-evolve="${f.uid}" ${can ? '' : 'disabled'}>Evolve to ${sp.names[f.stage]} <span class="muted">(Lv ${ev.lvl}, ${ev.ess} ${el.name} Essence · have ${ess})</span></button>`; }
    else h += '<div class="muted">Final form</div>';
    if (S.fams.length > 1 && f.job !== 'party') h += `<button class="btn sm ghost" data-release="${f.uid}">Release</button>`;
  }
  void party; return h + '</div>';
}
let confirmRelease = 0;
function famsHTML(): string {
  let h = `<p class="muted">Up to three familiars travel in your <b>party</b>. The active one fights beside you, sets your element, and lends you its ability on <kbd>O</kbd>. Press <kbd>T</kbd> to swap mid-fight. Others can work at home: Garden uses <b>Nurture</b>, Forage <b>Instinct</b>, Cauldron <b>Wit</b>.</p>`;
  h += `<div class="wheel">${ELEMENTS.map(e => `<span>${elTag(e)} beats ${BEATS[e].map(elTag).join(' & ')}</span>`).join('')}</div>`;
  if (confirmRelease) { const f = S.fams.find(x => x.uid === confirmRelease); if (f) h += `<div class="confirm">Release ${esc(famName(f))} back to the wild? It leaves you Familiar Down. <button class="btn" data-release2="${f.uid}">Release</button> <button class="btn" data-cancel="1">Keep</button></div>`; }
  const order = S.fams.slice().sort((a, b) => (a.job === 'party' ? 0 : 1) - (b.job === 'party' ? 0 : 1));
  h += `<div class="cards wide">${order.map(f => famCard(f, { jobs: true })).join('')}</div>`;
  const unseen = Object.keys(SPECIES).filter(s => !S.fams.some(f => f.sp === s));
  if (unseen.length) h += `<div class="lbl">Not yet bound</div><div class="cards">${unseen.map(s => `<div class="card dim">${ic(famSprite(s, 1), 'shadowed')}<div class="t">???</div><div class="muted">${elTag(SPECIES[s].el)} · ${SPECIES[s].where}</div></div>`).join('')}</div>`;
  return h;
}
function grimoireHTML(): string {
  let h = `<div class="cols"><div class="col-main"><div class="lbl">Ingredients · you learn one more aspect of an ingredient each time you brew with it</div><div class="list">`;
  const known = Object.keys(S.known).filter(id => ING[id]);
  for (const id of known) { const d = ING[id]; h += `<div class="row-item"><div class="ri-ic">${ic(itemIcon(id))}</div><div class="ri-main"><div class="ri-name">${d.name} <span class="muted">· ${d.source === 'crop' ? 'garden' : d.source === 'forage' ? (d.glimmer ? 'glimmer forage' : 'forage') : 'drop'}</span></div><div class="ri-sub">${aspectPips(id)}</div></div><div class="ri-act muted">×${countItem(id)}</div></div>`; }
  if (!known.length) h += '<p class="muted">Nothing yet.</p>';
  h += `</div></div><div class="col-side"><div class="lbl">Recipes</div><div class="list">`;
  for (const p of POTIONS) { if (p.id === 'murky') continue; const best = S.recipes[p.id];
    const asp = p.asp.map(a => `<span class="pip" style="--c:${ASPECT_INFO[a].col}">${ASPECT_INFO[a].name}</span>`).join('+');
    h += `<div class="row-item ${best ? '' : 'dim'}"><div class="ri-ic">${ic(itemIcon('p_' + p.id))}</div><div class="ri-main"><div class="ri-name">${best || p.asp.length === 1 ? p.name : '???'}</div><div class="ri-sub">${best || p.asp.length === 1 ? asp : '<span class="pip unk">?</span>+<span class="pip unk">?</span>'}${best ? ` · best: ${TIER_NAMES[best]}` : ''}</div></div></div>`; }
  h += `</div><p class="muted">The strongest aspect decides the brew. If the second is at least 40% as strong, you may get a two-aspect brew instead. Boil purifies; Steep favours the second aspect; Distill strips weak aspects.</p></div></div>`;
  return h;
}
function questHTML(): string {
  let h = `<div class="cols"><div class="col-main"><div class="lbl">Active quests · click one to track it on screen</div>`;
  if (!S.quests.length) h += `<p class="muted">No active quests. Look for <b style="color:var(--candle)">!</b> over villagers' heads.</p>`;
  for (const a of S.quests) { const d = questDef(a.id); if (!d) continue; const ready = isReady(a);
    h += `<button class="qcard ${S.track === a.id ? 'sel' : ''}" data-track="${a.id}"><div class="qh"><span class="qk ${d.kind}">${d.kind === 'main' ? 'Main' : d.kind === 'side' ? 'Side' : 'Bounty'}</span><b>${esc(d.title)}</b><span class="muted">· ${esc(NPC_NAMES[d.giver] || d.giver)}</span></div>
      <div class="small">${esc(d.text)}</div><ul class="steps">${d.steps.map((s, i) => { const p = stepProgress(a, i); return `<li class="${p.done ? 'done' : i === a.step ? 'cur' : ''}">${p.done ? '✓' : i === a.step ? '▸' : '·'} ${esc(s.d)}${p.need > 1 && !p.done ? ` (${p.have}/${p.need})` : ''}</li>`; }).join('')}${ready ? `<li class="cur">▸ Return to ${esc(NPC_NAMES[d.giver] || d.giver)}</li>` : ''}</ul>
      <div class="hint small">${esc(d.hint)}</div></button>`; }
  const avail = Object.keys(NPC_NAMES).filter(n => offersFrom(n).length).map(n => NPC_NAMES[n]);
  if (avail.length) h += `<p class="muted">Quests waiting: ${avail.map(esc).join(', ')}.</p>`;
  h += `<p class="muted">Completed: ${S.qdone.filter(id => !id.startsWith('b:')).length} quests, ${S.qdone.filter(id => id.startsWith('b:')).length} bounties.</p></div>`;
  h += `<div class="col-side"><div class="lbl">Controls</div><div class="ctrl one">
    <div><kbd>WASD</kbd> move · <kbd>Space</kbd> dodge roll</div><div><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd><kbd>U</kbd> Craft skills (aim with the mouse)</div><div><kbd>O</kbd> familiar ability · <kbd>T</kbd> swap familiar</div>
    <div><kbd>Click</kbd> use selected hotbar item · <kbd>E</kbd>/<kbd>Right-click</kbd> talk, pick, harvest, bind</div>
    <div><kbd>1</kbd>–<kbd>0</kbd>/<kbd>Wheel</kbd> hotbar · <kbd>H</kbd> quick heal · <kbd>B</kbd> broom</div><div><kbd>V</kbd> decorate (in your cottage)</div>
    <div><kbd>Tab</kbd> bag · <kbd>F</kbd> familiars · <kbd>N</kbd> skills · <kbd>Q</kbd> quests · <kbd>G</kbd> grimoire</div><div><kbd>M</kbd> sound · gamepads work too</div></div>
    <div class="lbl">Combat</div><p class="small">Enemies flash red and show their reach before they strike. Roll through attacks. Element advantage deals 50% more damage and takes less; bosses wear shields that only the right element cracks quickly. Potions share an 8 second cooldown.</p>
    <div class="lbl">A day</div><p class="small">Days run from 6am to 2am. Sleep in your cottage bed to grow crops, hatch eggs, sell the shipping crate and save. A comfortable home gives more energy.</p></div></div>`;
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
  h += `<div class="cols"><div class="col-main"><div class="lbl">Jobs · party holds 3; one familiar per home job</div><div class="list">${S.fams.map(f => { const sp = SPECIES[f.sp];
    return `<div class="row-item"><div class="ri-ic">${ic(famSprite(f.sp, f.stage))}</div><div class="ri-main"><div class="ri-name" style="color:${ELEMENT_INFO[sp.el].col}">${esc(famName(f))} <span class="muted">Lv ${f.lvl}</span></div><div class="ri-sub">${FSTATS.map(k => `${FSTAT_INFO[k].name} ${famStat(f, k)}`).join(' · ')}</div><div class="jobs">${(['party', 'garden', 'forage', 'cauldron', 'rest'] as Job[]).map(j => `<button class="btn sm ${f.job === j ? 'on' : ''}" data-job="${j}" data-fam="${f.uid}">${JOB_INFO[j].name}</button>`).join('')}</div></div></div>`; }).join('')}</div></div>`;
  h += `<div class="col-side"><div class="lbl">Nest</div>`;
  if (S.egg) { const pa = S.fams.find(f => f.uid === S.egg!.a), pb = S.fams.find(f => f.uid === S.egg!.b); h += `<div class="detail center">${ic(icon('egg', '#f4ecd8', '#f08ac0'), 'big')}<p>An egg from ${pa ? esc(famName(pa)) : '?'} and ${pb ? esc(famName(pb)) : '?'}. It hatches after you sleep.</p></div>`; }
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
  h += `<p class="muted">Press B to fly. Flying passes over trees, water and fences, but you cannot forage, plant or cast while airborne. Your party's best Wing stat adds speed.</p>`;
  for (const [k, n] of kinds) { h += `<div class="lbl">${n}</div><div class="cards">${BROOM_PARTS.filter(p => p.kind === k).map(p => { const owned = S.broom.owned.includes(p.id); const on = S.broom[k] === p.id;
    return `<div class="card ${on ? 'sel' : ''} ${owned ? '' : 'dim'}"><div class="t">${p.name}</div><div class="muted">${p.d}</div>${owned ? (on ? '<div class="lbl" style="color:var(--candle)">Fitted</div>' : `<button class="btn" data-part="${p.id}">Fit</button>`) : `<div class="muted">Sold by Tamsin · ${p.price}g</div>`}</div>`; }).join('')}</div>`; }
  h += `<div class="lbl">Handle dye</div><div class="swatches">${BROOM_DYES.map((c, i) => `<button class="sw ${S.broom.dye === i ? 'sel' : ''}" style="background:${c}" data-dye="${i}" aria-label="Dye ${i + 1}"></button>`).join('')}</div>`;
  return h;
}

// ---------- shipping crate & chest ----------
function crateHTML(): string {
  let h = header('Shipping crate', `<span class="muted">Everything in the crate sells overnight.</span>`);
  const total = S.ship.reduce((s, st) => s + sellPrice(st.id, st.q) * st.n, 0);
  h += `<div class="cols"><div class="col-main"><div class="lbl">Click an item to put the whole stack in the crate</div>${invGrid(S.inv, 'ship', id => ITEMS[id].sellable)}</div>`;
  h += `<div class="col-side"><div class="lbl">In the crate · ${total}g</div><div class="list">${S.ship.map((st, i) => `<div class="row-item"><div class="ri-ic">${ic(itemIcon(st.id))}</div><div class="ri-main"><div class="ri-name">${esc(itemTitle(st.id, st.q))} ×${st.n}</div><div class="ri-sub">${sellPrice(st.id, st.q) * st.n}g</div></div><div class="ri-act"><button class="btn sm" data-unship="${i}">Take back</button></div></div>`).join('') || '<p class="muted">Empty.</p>'}</div></div></div>`;
  return h;
}
function chestHTML(): string {
  return header('Storage chest', '<span class="muted">Click a stack to move it.</span>') + `<div class="lbl">Your bag</div>${invGrid(S.inv, 'tochest', id => ITEMS[id].kind !== 'tool')}<div class="lbl">Chest</div>${invGrid(S.home.chest, 'fromchest', undefined, false)}`;
}

// ---------- shops ----------
type Stock = { t: 'item'; id: string; q: number; price: number } | { t: 'gear'; g: Gear } | { t: 'part'; id: string } | { t: 'furn'; id: string } | { t: 'wall'; i: number } | { t: 'floor'; i: number };
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
  if (cached && cached.day === S.day && id !== 'bram') stock = cached.stock;
  else {
    switch (id) {
      case 'marrow': stock = [...CROPS.filter(c => c.id !== 'sweetbriar' || S.flags.crafts).map(c => ({ t: 'item' as const, id: 'seed_' + c.id, q: 0, price: c.seedPrice })), { t: 'item', id: 'charm', q: 0, price: 25 }, ...(S.qdone.includes('q3') ? [{ t: 'item' as const, id: 'charm2', q: 0, price: 70 }] : [])]; break;
      case 'hettie': stock = gearStock(['hat', 'robe', 'boots'], 7); break;
      case 'corwin': stock = [...gearStock(['weapon', 'charm'], 13), ...(S.qdone.includes('q5') ? [{ t: 'item' as const, id: 'charm3', q: 0, price: 160 }] : [])]; break;
      case 'tamsin': stock = BROOM_PARTS.filter(p => p.price > 0).map(p => ({ t: 'part' as const, id: p.id })); break;
      case 'ysolde': stock = [{ t: 'item', id: 'argentsalt', q: 2, price: 70 }, { t: 'item', id: 'familiardown', q: 2, price: 55 }, { t: 'item', id: 'glowmoss', q: 2, price: 50 }, { t: 'item', id: 'starbloom', q: 2, price: 140 }, { t: 'item', id: 'moonpetal', q: 2, price: 45 }, { t: 'item', id: 'seed_sweetbriar', q: 0, price: 22 }, { t: 'item', id: 'charm2', q: 0, price: 60 }]; break;
      case 'bram': stock = [...FURNITURE.filter(f => f.price > 0).map(f => ({ t: 'furn' as const, id: f.id })), ...WALLPAPERS.map((_, i) => ({ t: 'wall' as const, i })).filter(s => !S.home.walls.includes(s.i)), ...FLOORS.map((_, i) => ({ t: 'floor' as const, i })).filter(s => !S.home.floors.includes(s.i))]; break;
      default: stock = [];
    }
    stockCache[id] = { day: S.day, stock };
  }
  const titles: Record<string, string> = { marrow: "Marrow's Seeds & Sundries", hettie: "Hettie's Hats & Habits", corwin: "Corwin's Wands", tamsin: "Tamsin's Brooms", ysolde: "Ysolde's Hedge Goods", bram: "Bram's Joinery" };
  return { id, title: titles[id], tab: 'buy', stock, gearSell: id === 'hettie' || id === 'corwin' };
}
export function openShop(id: string) { renderView({ kind: 'shop', data: shopFor(id) }); }
function shopHTML(s: ShopState): string {
  let h = header(s.title, `<button class="btn ${s.tab === 'buy' ? 'on' : ''}" data-stab="buy">Buy</button><button class="btn ${s.tab === 'sell' ? 'on' : ''}" data-stab="sell">Sell</button><span class="gold">${S.gold}g</span>`);
  if (s.id === 'bram') h += `<p class="muted">Furniture goes into storage. Enter your cottage and press <kbd>V</kbd> to place it. Comfort now: <b>${comfort()}</b>. Duplicates count for half.</p>`;
  if (s.tab === 'buy') {
    h += `<div class="list">${s.stock.map((st, i) => {
      if (st.t === 'item') { const d = ITEMS[st.id]; return `<div class="row-item"><div class="ri-ic">${ic(itemIcon(st.id))}</div><div class="ri-main"><div class="ri-name">${esc(d.name)} ${qStars(st.id, st.q)} <span class="muted">· have ${countItem(st.id)}</span></div><div class="ri-sub">${itemDesc(st.id, st.q)}</div></div><div class="ri-act"><button class="btn" data-buy="${i}" ${S.gold < st.price ? 'disabled' : ''}>Buy ${st.price}g</button><button class="btn sm" data-buy5="${i}" ${S.gold < st.price * 5 ? 'disabled' : ''}>×5</button></div></div>`; }
      if (st.t === 'gear') return gearRow(st.g, `<button class="btn" data-buy="${i}" ${S.gold < st.g.price ? 'disabled' : ''}>Buy ${st.g.price}g</button>`);
      if (st.t === 'furn') { const f = FURN[st.id]; const have = (S.home.owned[f.id] || 0) + S.home.items.filter(p => p.id === f.id).length; return `<div class="row-item"><div class="ri-ic">${ic(furnSprite(f.id), 'furn')}</div><div class="ri-main"><div class="ri-name">${esc(f.name)} <span class="muted">· Comfort ${f.comfort}${have ? ` · own ${have}` : ''}</span></div><div class="ri-sub">${esc(f.d)}${f.light ? ' Gives light.' : ''}</div></div><div class="ri-act"><button class="btn" data-buy="${i}" ${S.gold < f.price ? 'disabled' : ''}>Buy ${f.price}g</button></div></div>`; }
      if (st.t === 'wall' || st.t === 'floor') { const isW = st.t === 'wall'; const d = isW ? WALLPAPERS[st.i] : FLOORS[st.i]; const price = isW ? WALLPAPER_PRICE : FLOOR_PRICE;
        return `<div class="row-item"><div class="ri-ic"><span class="sw" style="display:block;background:linear-gradient(90deg,${d.a},${d.b},${d.c})"></span></div><div class="ri-main"><div class="ri-name">${esc(d.name)}</div><div class="ri-sub">${isW ? 'Wallpaper' : 'Flooring'} · +3 Comfort when applied</div></div><div class="ri-act"><button class="btn" data-buy="${i}" ${S.gold < price ? 'disabled' : ''}>Buy ${price}g</button></div></div>`; }
      const p = BPART[st.id]; const owned = S.broom.owned.includes(p.id);
      return `<div class="row-item"><div class="ri-ic">${ic(icon(p.kind === 'lantern' ? 'lantern' : 'broom', p.col, p.col === '#000000' ? '#555555' : '#e0c070'))}</div><div class="ri-main"><div class="ri-name">${p.name}</div><div class="ri-sub">${p.d}</div></div><div class="ri-act">${owned ? '<span class="muted">Owned</span>' : `<button class="btn" data-buy="${i}" ${S.gold < p.price ? 'disabled' : ''}>Buy ${p.price}g</button>`}</div></div>`;
    }).join('') || '<p class="muted">Sold out today.</p>'}</div>`;
  } else {
    h += `<div class="lbl">Click an item to sell one</div>${invGrid(S.inv, 'sell', id => ITEMS[id].sellable)}`;
    if (s.gearSell) h += `<div class="lbl">Spare gear</div><div class="list">${S.bag.map(g => gearRow(g, `<button class="btn" data-sellgear="${g.uid}">Sell ${Math.round(g.price * 0.4)}g</button>`)).join('') || '<p class="muted">No spare gear.</p>'}</div>`;
  }
  return h;
}

// ---------- order board ----------
function boardHTML(): string {
  refreshOrders(); refreshBounties();
  let h = header('Hollowmere order board');
  h += `<div class="lbl">Potion orders</div><div class="list">${S.orders.map((o, i) => { const p = POTION[o.potion]; const have = countItem('p_' + o.potion, o.minTier);
    return `<div class="row-item ${o.done ? 'dim' : ''}"><div class="ri-ic">${ic(itemIcon('p_' + o.potion))}</div><div class="ri-main"><div class="ri-name">${o.n}× ${p.name}</div><div class="ri-sub">${TIER_NAMES[o.minTier]} quality or better · you have ${have}</div></div><div class="ri-act">${o.done ? '<span class="muted">Delivered</span>' : `<button class="btn ${have >= o.n ? 'go' : ''}" data-order="${i}" ${have >= o.n ? '' : 'disabled'}>Deliver · ${o.reward}g</button>`}</div></div>`; }).join('')}</div>`;
  h += `<div class="lbl">Today's bounties · hold up to 3</div><div class="list">${S.bounty.list.map((b, i) => { const d = questDef(b.id)!; const a = activeQ(b.id); const done = S.qdone.includes(b.id);
    return `<div class="row-item ${done ? 'dim' : ''}"><div class="ri-main"><div class="ri-name">${esc(d.title)} <span class="muted">· ${d.reward.gold}g</span></div><div class="ri-sub">${esc(d.text)} ${a ? `<b>${esc(d.steps[Math.min(a.step, d.steps.length - 1)].d)}${isReady(a) ? ' ✓' : ''}</b>` : ''}</div></div><div class="ri-act">${done ? '<span class="muted">Paid</span>' : a ? (isReady(a) ? `<button class="btn go" data-bturn="${b.id}">Claim</button>` : '<span class="muted">Taken</span>') : `<button class="btn" data-btake="${i}">Take</button>`}</div></div>`; }).join('')}</div>`;
  const old = S.quests.filter(q => q.id.startsWith('b:') && !S.bounty.list.some(b => b.id === q.id));
  if (old.length) h += `<div class="lbl">Older bounties</div><div class="list">${old.map(a => { const d = questDef(a.id)!; return `<div class="row-item"><div class="ri-main"><div class="ri-name">${esc(d.title)}</div></div><div class="ri-act">${isReady(a) ? `<button class="btn go" data-bturn="${a.id}">Claim ${d.reward.gold}g</button>` : '<span class="muted">In progress</span>'}</div></div>`; }).join('')}</div>`;
  h += `<div class="lbl">Wanted</div><div class="row-item"><div class="ri-main"><div class="ri-name">Mags Redhand, Roadcutter chief</div><div class="ri-sub">Camps south of the King's Road in Brindlewood. An Ember fighter: Tide or Stone breaks her guard. 250 gold.</div></div><div class="ri-act">${S.flags.magsPaid ? '<span class="muted">Paid</span>' : S.bosses.mags ? '<button class="btn go" data-act="bounty">Claim 250g</button>' : '<span class="muted">Wanted</span>'}</div></div>`;
  h += `<p class="muted">New orders and bounties are posted every morning.</p>`;
  return h;
}

// ---------- shrine ----------
const LURES: Record<string, [string, string][]> = { glade: [['glowmoss', 'gloamkit'], ['starbloom', 'wisplet']], pond: [['moonpetal', 'driftjel']] };
function shrineHTML(p: Prop): string {
  let h = header(p.id === 'glade' ? 'Glade shrine' : 'Pond shrine');
  const q8 = activeQ('q8'); const def8 = questDef('q8')!;
  if (p.id === 'glade' && q8 && !isReady(q8) && def8.steps[q8.step]?.t === 'defend') {
    h += W.defend ? '<p>The defense is underway. Hold!</p>' : `<p>Wren's wards need time to take. The rot will come for the shrine in three waves. Stay close and keep them off it.</p><button class="btn go" data-act="defend">Begin the defense</button>`;
    return h;
  }
  if (!S.flags.shrines) return h + `<p>An old witch-shrine, mossy and cold. The stone hums faintly, as if waiting for something.</p>`;
  if (!isNight()) return h + `<p>The shrine is quiet. Spirits answer offerings at night (7pm to 5am).</p>`;
  h += `<p>Lay an offering on the stone. Something wild may answer, and familiars that answer an offering are born with a little more potential (+8%).</p><div class="list">`;
  for (const [lure, sp] of LURES[p.id] || []) { const have = countItem(lure); const s = SPECIES[sp]; const here = W.enemies.some(e => e.wild && e.sp === sp);
    h += `<div class="row-item"><div class="ri-ic">${ic(itemIcon(lure))}</div><div class="ri-main"><div class="ri-name">Offer ${esc(ITEMS[lure].name)}</div><div class="ri-sub">Calls a ${s.names[0]} (${elTag(s.el)}, rare). You have ${have}.</div></div><div class="ri-act"><button class="btn go" data-lure="${lure}|${sp}" ${have && !here ? '' : 'disabled'}>${here ? 'It is here' : 'Offer'}</button></div></div>`; }
  return h + '</div>';
}

// ---------- npcs ----------
const WREN_IDLE = ['The Order calls us wicked. Wicked folk do not water their neighbours\' gardens.', 'A familiar that eats well fights well. Sweetbriar, dear. Always sweetbriar.', 'If you are tired, sleep. The rot will still be there tomorrow, sadly.', 'Mind the wheel. Every element has two it beats and two it fears.'];
const GREET: Record<string, string> = { marrow: 'Seeds, charms, the usual. Mind the Moonpetal, it bites.', hettie: 'A witch is nothing without a good hat, dear.', corwin: 'Wands for quick hands, staves for heavy ones.', tamsin: 'A broom is a living thing. Treat it well and it flies true.', ysolde: 'The Order nearly had me. Anything I have is yours at a fair price.', bram: 'A home is just a house until someone puts a rug in it.', pip: 'Ysolde says I can start my own garden! Do you think Moonpetals would grow here?' };
export function talkTo(n: NpcDef) {
  const ql = questTalk(n.id);
  const after = () => { if (n.id === 'wren') { if (S.flags.crafts) renderView({ kind: 'learn' }); } else if (n.id !== 'pip') openShop(n.id); };
  if (ql.length) { say(ql, () => { hooks.hud(); }); return; }
  if (n.id === 'wren') { say([{ who: 'Grandmother Wren', text: pick(WREN_IDLE) }], after); return; }
  say([{ who: n.name, text: GREET[n.id] || 'Hello.' }], after);
}
function learnHTML(): string {
  let h = header('Grandmother Wren', `<span class="gold">${S.gold}g</span>`);
  h += `<p>Wren can teach you another Craft for ${CRAFT_LEARN_PRICE} gold. New Crafts start at Lv 1, and you can switch between them any time out of combat.</p><div class="cards">`;
  for (const id of CRAFT_IDS) { const c = CRAFTS[id]; const has = !!S.crafts[id];
    h += `<div class="card"><div class="t" style="color:${c.col}">${c.name}</div><div class="muted">${c.role}</div><p>${c.blurb}</p><p class="muted">${c.passive}</p><div class="muted">${c.skills.map(s => s.name).join(' · ')}</div>${has ? '<div class="lbl">Known</div>' : `<button class="btn go" data-learn="${id}" ${S.gold < CRAFT_LEARN_PRICE ? 'disabled' : ''}>Learn · ${CRAFT_LEARN_PRICE}g</button>`}</div>`; }
  h += '</div>';
  const cp = craftProg(); h += `<div class="lbl">Unlearn</div><div class="row-item"><div class="ri-main"><div class="ri-name">Reset your ${CRAFTS[S.craft].name} tree</div><div class="ri-sub">Refunds all ${cp.nodes.length} points so you can spend them differently.</div></div><div class="ri-act"><button class="btn" data-act="respec" ${cp.nodes.length && S.gold >= RESPEC_PRICE ? '' : 'disabled'}>Reset · ${RESPEC_PRICE}g</button></div></div>`;
  return h;
}

// ---------- sleep & morning ----------
export function askSleep() {
  const late = S.time >= 18 * 60;
  openModal(`${header('Your bed')}<p>${late ? 'The fire is low and the bed is warm.' : 'It is still early. Sleeping now skips the rest of the day.'}</p><p class="muted">Sleeping grows your crops, hatches eggs, pays for the shipping crate, refreshes forage, orders and bounties, and saves. Home comfort ${comfort()} gives you ${100 + Math.min(50, comfort())} energy tomorrow.</p><div class="btnrow"><button class="btn go" data-act="sleep">Sleep until morning</button><button class="btn" data-act="close">Stay up</button></div>`, { kind: 'sleep' });
}
export function showMorning(lines: string[]) {
  openModal(`<div class="center"><h2>Day ${S.day}</h2><div class="muted">${S.rain ? 'Rain on the roof.' : 'A clear morning.'}</div></div><div class="list">${lines.map(l => `<div class="row-item"><div class="ri-main">${esc(l)}</div></div>`).join('') || '<p class="muted">A quiet night.</p>'}</div><div class="btnrow center"><button class="btn go" data-act="close">Start the day</button></div>`, { kind: 'morning' });
}

// ---------- events ----------
function moveStack(from: (Stack | null)[], i: number, to: (Stack | null)[]) {
  const st = from[i]; if (!st) return; const left = addItem(st.id, st.q, st.n, to); if (left === st.n) { hooks.toast('No room.', 'dim'); return; }
  if (left > 0) st.n = left; else from[i] = null; sfx('equip');
}
export function initMenus() {
  setInputHandlers({
    menu: (tab?: string) => openMenu(tab), close: () => closeModal(), advance: () => advanceDlg(),
    modalKey: (k: string) => { if (view?.kind === 'cauldron') return cauldronKey(k); if (onModalKey) return onModalKey(k);
      if (view?.kind === 'menu' && ((k === 'f' && view.tab === 'fams') || (k === 'g' && view.tab === 'grimoire') || (k === 'q' && view.tab === 'quest') || (k === 'n' && view.tab === 'skills'))) { closeModal(); return true; } return false; },
  });
  $('dialog').addEventListener('click', advanceDlg);
  $('modal').addEventListener('click', e => { if (e.target === $('modal') && view && !['create', 'title', 'cauldron', 'bind'].includes(view.kind)) closeModal(); });
  hooks.say = say;
  hooks.open = (kind: string, arg?: unknown) => {
    switch (kind) {
      case 'npc': talkTo(arg as NpcDef); break; case 'sleep': askSleep(); break; case 'cauldron': renderView({ kind: 'cauldron' }); break; case 'roost': openRoost(); break;
      case 'broom': renderView({ kind: 'broom' }); break; case 'crate': renderView({ kind: 'crate' }); break; case 'board': renderView({ kind: 'board' }); break;
      case 'chest': renderView({ kind: 'chest' }); break; case 'shrine': renderView({ kind: 'shrine', data: arg }); break; case 'bind': openBind(arg as Enemy); break;
      case 'morning': showMorning((arg as { lines: string[] }).lines); break;
    }
  };
  $('win').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b || b.disabled) return; const d = b.dataset; if (!view) return;
    if (['create', 'title', 'cauldron', 'bind'].includes(view.kind)) return;
    if (d.act === 'close') { closeModal(); return; }
    if (d.tab) { selInv = null; confirmRelease = 0; confirmDelete = false; renderView({ kind: 'menu', tab: d.tab }); return; }
    // bag
    if (d.inv !== undefined) { const i = Number(d.inv); if (selInv !== null && selInv !== i) { const t = S.inv[i]; S.inv[i] = S.inv[selInv]; S.inv[selInv] = t; selInv = null; sfx('equip'); } else selInv = selInv === i ? null : (S.inv[i] ? i : null); rerender(); hooks.hud(); return; }
    if (d.drink !== undefined) { usePotion(Number(d.drink)); if (!S.inv[Number(d.drink)]) selInv = null; rerender(); return; }
    if (d.trash !== undefined) { removeAt(Number(d.trash)); if (!S.inv[Number(d.trash)]) selInv = null; rerender(); hooks.hud(); return; }
    if (d.equip) { const i = S.bag.findIndex(g => g.uid === Number(d.equip)); if (i >= 0) { const g = S.bag[i]; const cur = S.eq[g.slot]; S.bag.splice(i, 1); if (cur) S.bag.push(cur); S.eq[g.slot] = g; sfx('equip'); refresh(); } rerender(); return; }
    if (d.unequip) { const s = d.unequip as Slot; const g = S.eq[s]; if (g) { if (S.bag.length >= 40) { hooks.toast('Gear bag is full.', 'bad'); return; } delete S.eq[s]; S.bag.push(g); refresh(); } rerender(); return; }
    if (d.craft) { if (W.P.combat > 0) return; S.craft = d.craft as CraftId; W.P.cd = [0, 0, 0, 0]; W.P.wild = 0; W.P.circle = 0; W.allies = []; W.zones = W.zones.filter(z => z.own !== 'p'); refresh(); W.P.hp = Math.min(W.P.hp, W.st.maxHp); hooks.toast(`You are now a ${CRAFTS[S.craft].name}.`, 'good'); sfx('buff'); rerender(); return; }
    // skills
    if (d.node) { const n = CRAFTS[S.craft].tree.find(x => x.id === d.node); if (n && !canTakeNode(n)) { craftProg().nodes.push(n.id); const u = n.fx.find(x => x.k === 'unlock'); if (u && u.k === 'unlock' && craftProg().adv < 0) craftProg().adv = u.adv; sfx('level'); hooks.toast(`Learned ${n.name}.`, 'good'); refresh(); saveNow(); } rerender(); return; }
    if (d.adv !== undefined) { craftProg().adv = Number(d.adv); W.P.cd[3] = 0; sfx('equip'); hooks.hud(); rerender(); return; }
    // familiars
    if (d.job && d.fam) { const f = S.fams.find(x => x.uid === Number(d.fam)); if (!f) return; const why = setJob(f, d.job as Job); if (why) hooks.toast(why, 'dim'); else sfx('equip'); refresh(); rerender(); return; }
    if (d.activate) { const i = S.party.indexOf(Number(d.activate)); if (i >= 0) { W.P.swapCd = 0; swapFamiliar(i); } rerender(); return; }
    if (d.evolve) { const f = S.fams.find(x => x.uid === Number(d.evolve)); if (!f) return; const sp = SPECIES[f.sp]; const ev = EVO[f.stage]; if (ev && f.lvl >= ev.lvl && removeItem('ess_' + sp.el, ev.ess)) { const old = sp.names[f.stage - 1]; f.stage++; sfx('evolve'); hooks.banner('EVOLUTION!', `${old} became ${sp.names[f.stage - 1]}`); if (f.stage === 3) hooks.toast(`${sp.names[2]} gained ${sp.evo.name}: ${sp.evo.d}`, 'good'); refresh(); saveNow(); } rerender(); return; }
    if (d.release) { confirmRelease = Number(d.release); rerender(); return; }
    if (d.release2) { const i = S.fams.findIndex(x => x.uid === Number(d.release2)); if (i >= 0) { S.fams.splice(i, 1); addItem('familiardown', 2, 1); hooks.toast('Released. It left some Familiar Down.', 'dim'); } confirmRelease = 0; refresh(); rerender(); return; }
    if (d.cancel) { confirmRelease = 0; rerender(); return; }
    if (d.track) { S.track = d.track; hooks.hud(); rerender(); return; }
    if (d.parent) { const u = Number(d.parent); if (nestA === u) nestA = 0; else if (nestB === u) nestB = 0; else if (!nestA) nestA = u; else nestB = u; rerender(); return; }
    if (d.act === 'lay') { const a = S.fams.find(f => f.uid === nestA), b2 = S.fams.find(f => f.uid === nestB); if (a && b2 && !canBreed(a, b2)) { const tier = layEgg(a, b2); hooks.toast(`An egg! (${TIER_NAMES[tier]} Kinship Draught) It hatches after you sleep.`, 'good'); sfx('bind'); nestA = nestB = 0; saveNow(); } rerender(); return; }
    // broom
    if (d.part) { const p = BPART[d.part]; if (S.broom.owned.includes(p.id)) { (S.broom as unknown as Record<string, string>)[p.kind] = p.id; sfx('equip'); W.P.stam = Math.min(W.P.stam, BPART[S.broom.handle].stam || 100); } rerender(); return; }
    if (d.dye !== undefined) { S.broom.dye = Number(d.dye); rerender(); return; }
    // crate & chest
    if (d.ship !== undefined) { const i = Number(d.ship); const st = S.inv[i]; if (!st || !ITEMS[st.id].sellable) return; const ex = S.ship.find(x => x.id === st.id && x.q === st.q); if (ex) ex.n += st.n; else S.ship.push({ ...st }); S.inv[i] = null; sfx('coin'); rerender(); hooks.hud(); return; }
    if (d.unship !== undefined) { const st = S.ship[Number(d.unship)]; if (st) { const left = addItem(st.id, st.q, st.n); if (left) st.n = left; else S.ship.splice(Number(d.unship), 1); } rerender(); hooks.hud(); return; }
    if (d.tochest !== undefined) { const st = S.inv[Number(d.tochest)]; if (st && ITEMS[st.id].kind !== 'tool') moveStack(S.inv, Number(d.tochest), S.home.chest); rerender(); hooks.hud(); return; }
    if (d.fromchest !== undefined) { moveStack(S.home.chest, Number(d.fromchest), S.inv); rerender(); hooks.hud(); return; }
    // shop
    if (d.stab && view.kind === 'shop') { (view.data as ShopState).tab = d.stab as 'buy' | 'sell'; rerender(); return; }
    if ((d.buy !== undefined || d.buy5 !== undefined) && view.kind === 'shop') { const s = view.data as ShopState; const i = Number(d.buy ?? d.buy5); const st = s.stock[i]; const n = d.buy5 !== undefined ? 5 : 1;
      if (st.t === 'item') { if (S.gold < st.price * n) return; const left = addItem(st.id, st.q, n); if (left === n) { hooks.toast('Your bag is full.', 'bad'); return; } S.gold -= st.price * (n - left); sfx('coin'); }
      else if (st.t === 'gear') { if (S.gold < st.g.price) return; if (S.bag.length >= 40) { hooks.toast('Gear bag is full.', 'bad'); return; } S.gold -= st.g.price; S.bag.push(st.g); s.stock.splice(i, 1); sfx('equip'); hooks.toast(`Bought ${esc(st.g.name)}. Equip it from your Bag (Tab).`, ''); }
      else if (st.t === 'furn') { const f = FURN[st.id]; if (S.gold < f.price) return; S.gold -= f.price; S.home.owned[f.id] = (S.home.owned[f.id] || 0) + 1; sfx('coin'); hooks.toast(`${f.name} is in storage. Press V in your cottage to place it.`, 'good'); }
      else if (st.t === 'wall' || st.t === 'floor') { const price = st.t === 'wall' ? WALLPAPER_PRICE : FLOOR_PRICE; if (S.gold < price) return; S.gold -= price; if (st.t === 'wall') S.home.walls.push(st.i); else S.home.floors.push(st.i); s.stock.splice(i, 1); sfx('coin'); hooks.toast('Bought. Apply it from the decorate panel (V) in your cottage.', 'good'); }
      else { const p = BPART[st.id]; if (S.gold < p.price || S.broom.owned.includes(p.id)) return; S.gold -= p.price; S.broom.owned.push(p.id); sfx('equip'); hooks.toast(`${p.name} bought. Fit it at the broom rack at home.`, 'good'); }
      rerender(); hooks.hud(); return; }
    if (d.sell !== undefined) { const i = Number(d.sell); const st = S.inv[i]; if (!st || !ITEMS[st.id].sellable) return; S.gold += sellPrice(st.id, st.q); removeAt(i); sfx('coin'); rerender(); hooks.hud(); return; }
    if (d.sellgear) { const i = S.bag.findIndex(g => g.uid === Number(d.sellgear)); if (i >= 0) { S.gold += Math.round(S.bag[i].price * 0.4); S.bag.splice(i, 1); sfx('coin'); } rerender(); hooks.hud(); return; }
    // board
    if (d.order !== undefined) { const o = S.orders[Number(d.order)]; if (o && !o.done && countItem('p_' + o.potion, o.minTier) >= o.n) { removeItem('p_' + o.potion, o.n, o.minTier); o.done = true; S.gold += o.reward; sfx('coin'); hooks.toast(`Delivered! +${o.reward}g`, 'good'); } rerender(); hooks.hud(); return; }
    if (d.btake !== undefined) { const why = takeBounty(Number(d.btake)); if (why) hooks.toast(why, 'dim'); rerender(); return; }
    if (d.bturn) { const a = activeQ(d.bturn); if (a) { const lines = turnIn(a); hooks.toast(lines[lines.length - 1].text, 'good'); } rerender(); hooks.hud(); return; }
    if (d.act === 'bounty') { if (S.bosses.mags && !S.flags.magsPaid) { S.flags.magsPaid = true; S.gold += 250; sfx('coin'); hooks.toast('Bounty paid: 250g', 'good'); } rerender(); hooks.hud(); return; }
    // shrine
    if (d.act === 'defend' && view.kind === 'shrine') { const p = view.data as Prop; startDefense(p.x, p.y); closeModal(); return; }
    if (d.lure && view.kind === 'shrine') { const [lure, sp] = d.lure.split('|'); const p = view.data as Prop; if (removeItem(lure, 1)) { const e = spawnWild(sp, { x: p.x + (Math.random() < 0.5 ? -36 : 36), y: p.y + 20 }, true); if (e) { e.home = { x: e.x, y: e.y }; } sfx('evolve'); hooks.toast(`Something stirs at the shrine… a wild ${SPECIES[sp].names[0]}!`, 'good'); } closeModal(); return; }
    // wren
    if (d.learn) { const id = d.learn as CraftId; if (!S.crafts[id] && S.gold >= CRAFT_LEARN_PRICE) { S.gold -= CRAFT_LEARN_PRICE; S.crafts[id] = { lvl: 1, xp: 0, nodes: [], adv: -1 }; sfx('level'); hooks.toast(`You learned the ${CRAFTS[id].name} Craft. Switch to it from the Witch tab (Esc).`, 'good'); } rerender(); hooks.hud(); return; }
    if (d.act === 'respec') { const cp = craftProg(); if (cp.nodes.length && S.gold >= RESPEC_PRICE) { S.gold -= RESPEC_PRICE; cp.nodes = []; cp.adv = -1; refresh(); sfx('buff'); hooks.toast('Your tree is reset. Spend your points again (N).', 'good'); saveNow(); } rerender(); hooks.hud(); return; }
    // sleep / options
    if (d.act === 'sleep') { $('modal').hidden = true; game.modal = false; view = null; sleep(false); return; }
    if (d.act === 'mute') { audio.muted = !audio.muted; rerender(); return; }
    if (d.act === 'save') { saveNow(); hooks.toast('Saved.', 'good'); return; }
    if (d.act === 'title') { saveNow(); $('modal').hidden = true; game.modal = false; view = null; showTitle(); return; }
    if (d.act === 'delete') { confirmDelete = true; rerender(); return; }
    if (d.act === 'nodelete') { confirmDelete = false; rerender(); return; }
    if (d.act === 'delete2') { confirmDelete = false; deleteSave(); $('modal').hidden = true; game.modal = false; view = null; game.playing = false; showTitle(); return; }
  });
  void T;
}
export function currentView() { return view; }
