import { S, newGame, readSave, setState, GameState, saveGame, hasOldSave } from '../core/state';
import { W, makePlayer, refresh, enterMap, hooks, boxSolid } from '../world/world';
import { acceptQuest } from '../world/quests';
import { CRAFTS, CRAFT_IDS, RACES, HAIRS, ROBES, CraftId } from '../data/crafts';
import { SPECIES, STARTERS, ELEMENT_INFO, FSTATS, FSTAT_INFO } from '../data/familiars';
import { charSprite, famSprite, icon } from '../art/sprites';
import { url } from '../art/pixel';
import { esc } from '../core/util';
import { game } from './state';
import { showHud } from './hud';
import { openModal, say } from './menus';

const $ = (id: string) => document.getElementById(id)!;
const cr = { name: '', race: 'vesper', skin: '', hair: HAIRS[2], robe: ROBES[0], craft: 'sigil' as CraftId, fam: 'sparkit' };

export function showTitle() {
  game.playing = false; showHud(false); setState(null);
  const sv = readSave();
  openModal(`<div class="title-wrap"><h1 class="title-art">COVENBOUND</h1>
    <p class="tagline">Grow, forage and brew. Raise and breed familiars. Defend the valley from the rot, the roads from bandits, and your kind from the Argent Order.</p>
    <div class="btnrow center">${sv ? `<button class="btn go" id="tContinue">Continue · ${esc(sv.name)}, Day ${sv.day}</button>` : ''}<button class="btn ${sv ? '' : 'go'}" id="tNew">New witch</button></div>
    ${!sv && hasOldSave() ? '<p class="warn small center">Your v0.2 witch cannot make the trip to v0.3: the world was rebuilt. A fresh start awaits.</p>' : ''}<p class="muted small center">Vertical slice · v0.3 · saves in this browser</p></div>`, { kind: 'title' });
  if (sv) $('tContinue').onclick = () => startGame(sv, false);
  $('tNew').onclick = () => showCreate();
}
function showCreate() {
  const race = RACES.find(r => r.id === cr.race)!; if (!race.skins.includes(cr.skin)) cr.skin = race.skins[0];
  const look = { hat: 'pointed' as const, hatCol: '#2a2140', band: '#6a5a80', hair: cr.hair, skin: cr.skin, robe: cr.robe };
  const c = CRAFTS[cr.craft], sp = SPECIES[cr.fam];
  openModal(`<div class="whead"><h2>Create your witch</h2><div class="spacer"></div><button class="btn" id="cBack">Back</button><button class="btn go" id="cGo">Begin</button></div>
  <div class="create">
    <div class="preview"><img class="pix" alt="Your witch" src="${url(charSprite(look, 'down', 0, 2))}"><img class="pix fam" alt="" src="${url(famSprite(cr.fam, 1))}">
      <div class="lbl" style="color:var(--candle)">${race.name} ${c.name}</div><div class="muted small">with ${sp.names[0]}</div></div>
    <div class="create-main">
      <label class="lbl" for="cName">Name</label><input type="text" id="cName" maxlength="14" placeholder="Name your witch" value="${esc(cr.name)}" autocomplete="off"><span class="warn" id="cErr"></span>
      <div class="lbl">Race</div><div class="cards four">${RACES.map(r => `<button class="card ${r.id === cr.race ? 'sel' : ''}" data-race="${r.id}"><span class="t">${r.name}</span><span>${r.blurb}</span><span class="muted small">${r.bonus}</span></button>`).join('')}</div>
      <div class="swrow"><div><div class="lbl">Skin</div><div class="swatches">${race.skins.map(col => `<button class="sw ${col === cr.skin ? 'sel' : ''}" style="background:${col}" data-skin="${col}" aria-label="Skin"></button>`).join('')}</div></div>
        <div><div class="lbl">Hair</div><div class="swatches">${HAIRS.map(col => `<button class="sw ${col === cr.hair ? 'sel' : ''}" style="background:${col}" data-hair="${col}" aria-label="Hair"></button>`).join('')}</div></div>
        <div><div class="lbl">Robe</div><div class="swatches">${ROBES.map(col => `<button class="sw ${col === cr.robe ? 'sel' : ''}" style="background:${col}" data-robe="${col}" aria-label="Robe"></button>`).join('')}</div></div></div>
    </div>
  </div>
  <div class="lbl">Craft · your class. You can learn the others later; each levels separately.</div>
  <div class="cards five">${CRAFT_IDS.map(id => { const k = CRAFTS[id]; return `<button class="card ${id === cr.craft ? 'sel' : ''}" data-craft="${id}"><span class="t" style="color:${k.col}">${k.name}</span><span class="muted small">${k.role}</span><span class="small">${k.blurb}</span><span class="skillrow">${k.skills.map(s => `<img class="pix" alt="" title="${esc(s.name)}" src="${url(icon(s.icon, k.col, k.light))}">`).join('')}</span><span class="muted small">${k.skills.map(s => s.name).join(' · ')}</span></button>`; }).join('')}</div>
  <div class="lbl">First familiar · its element infuses your skills. Each familiar rolls its own stats.</div>
  <div class="cards four">${STARTERS.map(id => { const f = SPECIES[id], el = ELEMENT_INFO[f.el]; const best = FSTATS.slice().sort((a, b) => f.caps[b] - f.caps[a]).slice(0, 2);
    return `<button class="card ${id === cr.fam ? 'sel' : ''}" data-fam="${id}"><img class="pix fam" alt="" src="${url(famSprite(id, 1))}"><span class="t" style="color:${el.col}">${f.names[0]}</span><span class="small"><span style="color:${el.col}">${el.name}</span>: ${el.infuse}</span><span class="small"><b style="color:var(--candle);font-weight:normal">${f.sig.name}:</b> ${f.sig.d(f.sig.vals[0])}</span><span class="muted small">Best at: ${best.map(b => FSTAT_INFO[b].name).join(', ')}</span><span class="muted small">${f.names.join(' > ')}</span></button>`; }).join('')}</div>`, { kind: 'create' });
  const nm = $('cName') as HTMLInputElement; nm.oninput = () => { cr.name = nm.value; };
  $('win').onclick = e => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b) return; const d = b.dataset;
    if (d.race) { cr.race = d.race; showCreate(); } else if (d.skin) { cr.skin = d.skin; showCreate(); } else if (d.hair) { cr.hair = d.hair; showCreate(); } else if (d.robe) { cr.robe = d.robe; showCreate(); }
    else if (d.craft) { cr.craft = d.craft as CraftId; showCreate(); } else if (d.fam) { cr.fam = d.fam; showCreate(); }
    else if (b.id === 'cBack') { $('win').onclick = null; showTitle(); }
    else if (b.id === 'cGo') { const name = cr.name.trim(); if (!name) { $('cErr').textContent = 'Give your witch a name first.'; nm.focus(); return; } $('win').onclick = null; startGame(newGame({ ...cr, name }), true); } };
}
export function startGame(save: GameState, isNew: boolean) {
  setState(save); W.P = makePlayer(); W.st = null as never; refresh();
  const P = W.P; P.hp = save.hp > 0 ? save.hp : W.st.maxHp; P.mp = save.mp >= 0 ? save.mp : W.st.maxMp; P.stam = 100;
  $('modal').hidden = true; game.modal = false; game.playing = true; showHud(true);
  const sx = save.x, sy = save.y; enterMap(isNew ? 'cottage' : S.map || 'home', isNew ? 'bed' : undefined);
  if (!isNew && sx) { P.x = sx; P.y = sy; if (boxSolid(P.x, P.y, P.hw, P.hh, 'walk')) { const e = W.map.entries.door || W.map.entries.w; P.x = e.x; P.y = e.y; } W.F.x = P.x - 12; W.F.y = P.y; }
  refresh(); hooks.hud();
  if (isNew) { acceptQuest('q1', true);
    say([{ who: '', text: 'A letter waits on your pillow, tied with twine.' },
      { who: 'Grandmother Wren', text: `Welcome to Thistledown, ${S.name}. The cottage is yours now, and so is the field behind the fence. Hollowmere is just east, when you want company.` },
      { who: 'Grandmother Wren', text: 'Mind the Brindlewood beyond the village. Something is rotting it. And if you see silver robes on the road, the Argent Order, do not let them see you first.' },
      { who: 'Grandmother Wren', text: 'Start with the garden. Till the soil with your hoe, plant, water. Bring me three crops when they come in.' },
      { who: '', text: 'WASD to move, Space to dodge. Number keys pick a hotbar slot; click to use it. E talks and harvests. Tab opens your bag, F your familiars, Q your quests. Walk out the door at the bottom of the room.' }], () => saveGame());
  }
}
