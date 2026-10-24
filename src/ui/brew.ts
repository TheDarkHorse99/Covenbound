import { S, removeItem, addItem, jobFam, famStat, hasTal, famName, giveFamXp, invFull, gearSum } from '../core/state';
import { hooks, giveLife, saveNow } from '../world/world';
import { questEvent } from '../world/quests';
import { ING, ASPECTS, ASPECT_INFO, METHODS, Method, resolveBrew, POTION, TIER_NAMES, BrewResult, Aspect } from '../data/brewing';
import { ITEMS } from '../data/items';
import { itemIcon } from '../art/sprites';
import { cauldron as cauldronArt } from '../art/props';
import { mix } from '../art/pix16';
import { url } from '../art/pixel';
import { esc } from '../core/util';
import { sfx } from '../core/audio';
import { keys } from './input';
import { closeModal } from './menus';

const $ = (id: string) => document.getElementById(id)!;
interface Pot { id: string; q: number }
type Mark = 'perfect' | 'good' | 'miss';
let pot: Pot[] = []; let method: Method = 'simmer'; let phase: 'pick' | 'game' | 'result' = 'pick';
let result: BrewResult | null = null; let revealed: string[] = []; let newRecipe = false; let marks: Mark[] = []; let summary = '';
let raf = 0; let last = 0; let holdBtn = false;
// per-game state
const G = {
  // distill (stir) + steep (colour)
  round: 0, pos: 0, dir: 1, speed: 0.9, center: 0.5,
  colA: '#ffffff', colB: '#000000', ph: 0,
  // simmer
  heat: 0.2, hv: 0, band: 0.5, time: 0, inBand: 0, dur: 7,
  // boil
  bubbles: [] as { id: number; x: number; y: number; key: string; t: number; life: number }[], spawned: 0, nextT: 0, hits: 0, wrong: 0, bid: 0,
  score: 0,
};

export function openCauldron() {
  if (phase !== 'game') { phase = 'pick'; result = null; }
  $('win').dataset.kind = 'cauldron'; $('win').className = 'win'; render();
}
function bonusPoints(): number {
  const f = jobFam('cauldron'); let b = S.life.brew.lvl * 0.35; if (f) { b += famStat(f, 'wit') / 25; if (hasTal(f, 'steadystir')) b += 1; }
  b += (gearSum().aff.brew || 0) / 10; return b;
}
function available(id: string, q: number) { let n = 0; for (const st of S.inv) if (st && st.id === id && st.q === q) n += st.n; return n - pot.filter(p => p.id === id && p.q === q).length; }
function knownTotals(): { tot: Record<Aspect, number>; unknown: number } {
  const tot = Object.fromEntries(ASPECTS.map(a => [a, 0])) as Record<Aspect, number>; let unknown = 0; const qm = [1, 1, 1.25, 1.5];
  for (const p of pot) { const d = ING[p.id]; const list = (Object.entries(d.asp) as [Aspect, number][]).sort((a, b) => b[1] - a[1]); const k = S.known[p.id] || 1;
    list.forEach(([a, v], i) => { if (i < k) tot[a] += v * qm[p.q]; else unknown++; }); }
  return { tot, unknown };
}
const markName = (m: Mark) => m === 'perfect' ? 'Perfect' : m === 'good' ? 'Good' : 'Miss';
function render() {
  let h = `<div class="whead"><h2>Cauldron</h2><span class="muted">Brewing Lv ${S.life.brew.lvl}${jobFam('cauldron') ? ` · ${esc(famName(jobFam('cauldron')!))} helps (+${(famStat(jobFam('cauldron')!, 'wit') / 25).toFixed(1)})` : ''}</span><div class="spacer"></div><button class="btn" data-bact="close" ${phase === 'game' ? 'disabled' : ''}>Close · Esc</button></div>`;
  if (phase === 'pick') {
    const stacks: Pot[] = []; for (const st of S.inv) if (st && ING[st.id] && !stacks.some(s => s.id === st.id && s.q === st.q)) stacks.push({ id: st.id, q: st.q });
    stacks.sort((a, b) => ITEMS[a.id].name.localeCompare(ITEMS[b.id].name) || b.q - a.q);
    h += `<div class="cols"><div class="col-main"><div class="lbl">Your ingredients · click to add (up to 4)</div><div class="list ing">`;
    h += stacks.map(s => { const n = available(s.id, s.q); const d = ING[s.id]; const list = (Object.entries(d.asp) as [Aspect, number][]).sort((a, b) => b[1] - a[1]); const k = S.known[s.id] || 1;
      return `<button class="row-item btnlike" data-add="${s.id}|${s.q}" ${n <= 0 || pot.length >= 4 ? 'disabled' : ''}><div class="ri-ic"><img class="pix" alt="" src="${url(itemIcon(s.id))}"></div><div class="ri-main"><div class="ri-name">${d.name} <span class="tier q${s.q}">${'★'.repeat(s.q)}</span> <span class="muted">×${n}</span></div><div class="ri-sub asp">${list.map(([a, v], i) => i < k ? `<span class="pip" style="--c:${ASPECT_INFO[a].col}">${ASPECT_INFO[a].name} ${v}</span>` : '<span class="pip unk">?</span>').join('')}</div></div></button>`; }).join('') || '<p class="muted">No ingredients. Grow, forage, or take them from defeated enemies.</p>';
    h += `</div></div><div class="col-side"><div class="potbox"><img class="pix potart" alt="" src="${url(scaleUp(cauldronArt(0, pot.length > 0)))}"><div class="potslots">${[0, 1, 2, 3].map(i => pot[i] ? `<button class="islot" data-rem="${i}" title="Remove"><img class="pix" alt="" src="${url(itemIcon(pot[i].id))}"><span class="tier q${pot[i].q}">${'★'.repeat(pot[i].q)}</span></button>` : '<div class="islot empty"></div>').join('')}</div></div>`;
    const { tot, unknown } = knownTotals(); const max = Math.max(1, ...ASPECTS.map(a => tot[a]));
    h += `<div class="lbl">Known aspects in the pot</div><div class="aspbars">${ASPECTS.filter(a => tot[a] > 0).map(a => `<div class="ab"><span>${ASPECT_INFO[a].name}</span><div class="mbar"><i style="width:${tot[a] / max * 100}%;background:${ASPECT_INFO[a].col}"></i></div><b>${tot[a].toFixed(1)}</b></div>`).join('') || '<p class="muted">Add ingredients.</p>'}${unknown ? `<p class="muted">+ ${unknown} unknown aspect${unknown > 1 ? 's' : ''}</p>` : ''}</div>`;
    h += `<div class="lbl">Method</div><div class="methods">${(Object.keys(METHODS) as Method[]).map(m => `<button class="btn ${method === m ? 'on' : ''}" data-method="${m}" title="${esc(METHODS[m].desc)}">${METHODS[m].name}</button>`).join('')}</div><p class="muted small">${esc(METHODS[method].desc)}</p><p class="hint small">${esc(METHODS[method].game)}</p>`;
    const full = invFull() && !pot.length;
    h += `<button class="btn go wide" data-bact="brew" ${pot.length ? '' : 'disabled'}>Start brewing</button>${full ? '<p class="warn">Your bag is full.</p>' : ''}<p class="muted small">3+ ingredients make 2 potions.</p></div></div>`;
  } else if (phase === 'game') {
    h += gameHTML();
  } else if (result) {
    const p = POTION[result.potion];
    h += `<div class="center result"><img class="pix big" alt="" src="${url(scaleUp(itemIcon('p_' + result.potion, false)))}"><h3>${result.potion === 'murky' ? 'Murky Brew' : `${TIER_NAMES[result.tier]} ${p.name}`} ×${result.count}</h3>
      ${newRecipe ? '<p class="good">New recipe discovered! It is now in your Grimoire.</p>' : ''}<p>${result.potion === 'murky' ? 'The brew curdles. Too weak or too muddled. Try fewer competing aspects, or Boil to purify.' : esc(p.desc(result.tier))}</p>
      <p class="muted">${esc(summary)} · Purity ${Math.round(result.purity * 100)}%</p>
      ${revealed.length ? `<p class="good">You learned more about: ${revealed.map(esc).join(', ')}.</p>` : ''}
      <div class="btnrow center"><button class="btn go" data-bact="again">Brew again</button><button class="btn" data-bact="close">Done</button></div></div>`;
  }
  $('win').innerHTML = h;
}
function gameHTML(): string {
  const mk = `<div class="marks">${marks.map(m => `<span class="mk ${m}">${markName(m)}</span>`).join('')}</div>`;
  switch (method) {
    case 'distill': return `<div class="stirwrap"><p>Stir ${G.round + 1} of 3. Press <kbd>Space</kbd> or click <b>Stir</b> when the spoon is in the gold band.</p>
      <div class="stirbar"><div class="band" style="left:${(G.center - 0.11) * 100}%;width:22%"></div><div class="perfect" style="left:${(G.center - 0.045) * 100}%;width:9%"></div><div class="spoon" id="spoon"></div></div>${mk}<button class="btn go wide" data-bact="act">Stir</button></div>`;
    case 'steep': return `<div class="stirwrap"><p>Pull ${G.round + 1} of 3. The brew shifts colour as it steeps. Press <kbd>Space</kbd> when it matches the target.</p>
      <div class="steeprow"><div><div class="lbl">Target</div><div class="swatch big" style="background:${steepCol(G.center)}"></div></div><div><div class="lbl">Your brew</div><div class="swatch big" id="steepNow"></div></div></div>${mk}<button class="btn go wide" data-bact="act">Pull</button></div>`;
    case 'simmer': return `<div class="stirwrap"><p>Keep the heat inside the band. Hold <kbd>Space</kbd> (or the button) to stoke the fire; let go to let it cool.</p>
      <div class="stirbar heat"><div class="band" id="heatBand"></div><div class="spoon" id="heatNow"></div></div><div class="mbar timebar"><i id="heatTime"></i></div><p class="muted" id="heatPct">In the band: 0%</p><button class="btn go wide" id="stoke">Stoke (hold)</button></div>`;
    case 'boil': return `<div class="stirwrap"><p>Foam rises! Press the key on each bubble (<kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd>) or click it before it bursts.</p>
      <div class="boilpot" id="boilpot"></div><p class="muted" id="boilScore">Skimmed 0 / 10</p></div>`;
  }
}
const bigCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function scaleUp(c: HTMLCanvasElement) { let b = bigCache.get(c); if (b) return b; b = document.createElement('canvas'); b.width = c.width * 4; b.height = c.height * 4; const g = b.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, b.width, b.height); bigCache.set(c, b); return b; }
function steepCol(t: number) { return t < 0.5 ? mix(G.colA, '#f4ecd8', t * 2) : mix('#f4ecd8', G.colB, (t - 0.5) * 2); }

function startGame() {
  if (!pot.length) return;
  phase = 'game'; marks = []; G.round = 0; G.score = 0; G.pos = 0; G.dir = 1; G.speed = 0.85; G.center = 0.3 + Math.random() * 0.4;
  const { tot } = knownTotals(); const order = ASPECTS.slice().sort((a, b) => tot[b] - tot[a]); G.colA = ASPECT_INFO[order[0]].col; G.colB = ASPECT_INFO[order[1]].col; G.ph = Math.random() * 6;
  G.heat = 0.2; G.hv = 0; G.time = 0; G.inBand = 0; G.band = 0.5;
  G.bubbles = []; G.spawned = 0; G.nextT = 0.4; G.hits = 0; G.wrong = 0;
  render(); bindGame(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
}
function bindGame() {
  const st = document.getElementById('stoke'); if (st) { st.onpointerdown = () => { holdBtn = true; }; st.onpointerup = st.onpointerleave = () => { holdBtn = false; }; }
  const bp = document.getElementById('boilpot'); if (bp) bp.onpointerdown = e => { const b = (e.target as HTMLElement).closest('[data-bub]') as HTMLElement | null; if (b) skim(Number(b.dataset.bub)); };
}
function tick(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; if (phase !== 'game') return;
  switch (method) {
    case 'distill': { G.pos += G.dir * G.speed * dt; if (G.pos > 1) { G.pos = 1; G.dir = -1; } if (G.pos < 0) { G.pos = 0; G.dir = 1; } const sp = document.getElementById('spoon'); if (sp) sp.style.left = (G.pos * 100) + '%'; break; }
    case 'steep': { G.ph += dt * G.speed * 2.2; G.pos = (Math.sin(G.ph) + 1) / 2; const el = document.getElementById('steepNow'); if (el) el.style.background = steepCol(G.pos); break; }
    case 'simmer': {
      const hold = holdBtn || !!keys[' ']; G.hv += (hold ? 1.5 : -1.1) * dt; G.hv = Math.max(-0.8, Math.min(0.8, G.hv)); G.heat += G.hv * dt;
      if (G.heat < 0) { G.heat = 0; G.hv = 0; } if (G.heat > 1) { G.heat = 1; G.hv *= -0.3; }
      G.time += dt; G.band = 0.5 + Math.sin(G.time * 0.9) * 0.22 + Math.sin(G.time * 2.3) * 0.06; const w = 0.2;
      if (Math.abs(G.heat - G.band) < w / 2) G.inBand += dt;
      const b = document.getElementById('heatBand'), n = document.getElementById('heatNow'), tm = document.getElementById('heatTime'), pc = document.getElementById('heatPct');
      if (b) { b.style.left = ((G.band - w / 2) * 100) + '%'; b.style.width = (w * 100) + '%'; } if (n) n.style.left = (G.heat * 100) + '%'; if (tm) tm.style.width = (G.time / G.dur * 100) + '%';
      if (pc) pc.textContent = `In the band: ${Math.round(G.inBand / Math.max(0.01, G.time) * 100)}%`;
      if (Math.random() < dt * 4) sfx('bubble');
      if (G.time >= G.dur) { const f = G.inBand / G.dur; G.score = 3 * Math.min(1, f / 0.8); marks = [f >= 0.75 ? 'perfect' : f >= 0.5 ? 'good' : 'miss']; summary = `Heat held ${Math.round(f * 100)}% of the time`; finishBrew(); return; }
      break; }
    case 'boil': {
      G.nextT -= dt; if (G.spawned < 10 && G.nextT <= 0 && G.bubbles.length < 3) { G.spawned++; G.nextT = 0.55 + Math.random() * 0.4 - G.spawned * 0.02; G.bubbles.push({ id: G.bid++, x: 8 + Math.random() * 84, y: 15 + Math.random() * 65, key: 'asdf'[Math.floor(Math.random() * 4)], t: 0, life: 1.7 - G.spawned * 0.06 }); }
      for (const b of G.bubbles.slice()) { b.t += dt; if (b.t >= b.life) { G.bubbles.splice(G.bubbles.indexOf(b), 1); sfx('fail'); } }
      const bp = document.getElementById('boilpot'); if (bp) bp.innerHTML = G.bubbles.map(b => { const k = 1 - b.t / b.life; return `<button class="bub" data-bub="${b.id}" style="left:${b.x}%;top:${b.y}%;transform:translate(-50%,-50%) scale(${0.6 + k * 0.6});opacity:${0.4 + k * 0.6}">${b.key.toUpperCase()}</button>`; }).join('');
      const sc = document.getElementById('boilScore'); if (sc) sc.textContent = `Skimmed ${G.hits} / 10${G.wrong ? ` · ${G.wrong} fumbled` : ''}`;
      if (G.spawned >= 10 && !G.bubbles.length) { const s = Math.max(0, G.hits - G.wrong * 0.5); G.score = 3 * Math.min(1, s / 9); marks = [s >= 9 ? 'perfect' : s >= 6 ? 'good' : 'miss']; summary = `Skimmed ${G.hits} of 10 bubbles`; finishBrew(); return; }
      break; }
  }
  raf = requestAnimationFrame(tick);
}
function skim(id: number) { const b = G.bubbles.find(x => x.id === id); if (!b) return; G.bubbles.splice(G.bubbles.indexOf(b), 1); G.hits++; sfx('perfect'); }
function boilKey(k: string) { const b = G.bubbles.filter(x => x.key === k).sort((a, c) => (c.t / c.life) - (a.t / a.life))[0]; if (b) skim(b.id); else { G.wrong++; sfx('fail'); } }
function act() {
  if (phase !== 'game') return;
  if (method === 'distill' || method === 'steep') {
    const d = Math.abs(G.pos - G.center); const tight = method === 'steep' ? [0.06, 0.14] : [0.045, 0.11];
    const m: Mark = d <= tight[0] ? 'perfect' : d <= tight[1] ? 'good' : 'miss'; marks.push(m); G.score += m === 'perfect' ? 1 : m === 'good' ? 0.5 : 0; sfx(m === 'perfect' ? 'perfect' : m === 'good' ? 'stir' : 'fail');
    G.round++; if (G.round >= 3) { cancelAnimationFrame(raf); summary = `${method === 'steep' ? 'Pulls' : 'Stirs'}: ${marks.map(markName).join(', ')}`; finishBrew(); return; }
    G.center = method === 'steep' ? 0.12 + Math.random() * 0.76 : 0.25 + Math.random() * 0.5; G.speed += 0.35; render(); bindGame();
  }
}
function finishBrew() {
  cancelAnimationFrame(raf); holdBtn = false;
  const f = jobFam('cauldron'); const extra = f && hasTal(f, 'alembic') ? 0.25 : 0;
  const r = resolveBrew(pot, method, G.score, bonusPoints(), extra);
  for (const p of pot) removeItem(p.id, 1, p.q, p.q);
  const left = addItem('p_' + r.potion, r.tier, r.count);
  if (left > 0) { S.ship.push({ id: 'p_' + r.potion, q: r.tier, n: left }); hooks.toast('Bag full: the extra potions went into your shipping crate.', 'dim'); }
  revealed = []; const extraReveal = S.life.brew.lvl >= 5 ? 1 : 0;
  for (const id of Array.from(new Set(pot.map(p => p.id)))) { const n = Object.keys(ING[id].asp).length; const k = S.known[id] || 1; if (k < n) { S.known[id] = Math.min(n, k + 1 + extraReveal); revealed.push(ING[id].name); } }
  newRecipe = r.potion !== 'murky' && !S.recipes[r.potion];
  if (r.potion !== 'murky') { S.recipes[r.potion] = Math.max(S.recipes[r.potion] || 0, r.tier); S.brewed[r.potion] = (S.brewed[r.potion] || 0) + 1; for (let k = 0; k < r.count; k++) questEvent({ t: 'brew', potion: r.potion, tier: r.tier }); }
  giveLife('brew', r.potion === 'murky' ? 3 : 8 + r.tier * 4); if (f) giveFamXp(f, 12);
  result = r; phase = 'result'; pot = []; sfx(r.potion === 'murky' ? 'fail' : 'evolve'); saveNow(); hooks.hud(); render();
}
export function cauldronKey(k: string): boolean {
  if (phase === 'game') { if (method === 'boil') { if ('asdf'.includes(k) && k.length === 1) boilKey(k); return true; } if ((k === ' ' || k === 'enter' || k === 'e') && method !== 'simmer') act(); return true; }
  if (k === 'escape' || k === 'tab') { close(); return true; }
  return false;
}
function close() { if (phase === 'game') return; phase = 'pick'; result = null; $('win').dataset.kind = ''; closeModal(); }
export function initBrewUI() {
  $('win').addEventListener('click', e => {
    if ($('win').dataset.kind !== 'cauldron') return;
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b || b.disabled) return; const d = b.dataset;
    if (d.add) { const [id, q] = d.add.split('|'); if (pot.length < 4 && available(id, Number(q)) > 0) { pot.push({ id, q: Number(q) }); sfx('bubble'); } render(); return; }
    if (d.rem !== undefined) { pot.splice(Number(d.rem), 1); render(); return; }
    if (d.method) { method = d.method as Method; render(); return; }
    if (d.bact === 'brew') { startGame(); return; }
    if (d.bact === 'act') { act(); return; }
    if (d.bact === 'again') { phase = 'pick'; result = null; render(); return; }
    if (d.bact === 'close') { close(); return; }
  });
}
