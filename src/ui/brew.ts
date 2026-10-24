import { S, countItem, removeItem, addItem, jobFam, famStat, hasTal, famName, giveFamXp, invFull, gearSum } from '../core/state';
import { hooks, giveLife, checkQuest, saveNow, W } from '../world/world';
import { ING, ASPECTS, ASPECT_INFO, METHODS, Method, resolveBrew, POTION, TIER_NAMES, BrewResult, Aspect } from '../data/brewing';
import { ITEMS } from '../data/items';
import { itemIcon } from '../art/sprites';
import { cauldron as cauldronArt } from '../art/props';
import { url } from '../art/pixel';
import { esc } from '../core/util';
import { sfx } from '../core/audio';
import { game } from './state';
import { closeModal } from './menus';

const $ = (id: string) => document.getElementById(id)!;
interface Pot { id: string; q: number }
let pot: Pot[] = []; let method: Method = 'simmer'; let phase: 'pick' | 'stir' | 'result' = 'pick';
let stir = { round: 0, pos: 0, dir: 1, speed: 0.9, center: 0.5, score: 0, marks: [] as string[], raf: 0, last: 0 };
let result: BrewResult | null = null; let revealed: string[] = []; let newRecipe = false;

/** Called by menus.ts after it marks the modal as the cauldron view. */
export function openCauldron() {
  if (phase !== 'stir') { phase = 'pick'; result = null; }
  $('win').dataset.kind = 'cauldron'; $('win').className = 'win'; render(); void game;
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
function render() {
  let h = `<div class="whead"><h2>Cauldron</h2><span class="muted">Brewing Lv ${S.life.brew.lvl}${jobFam('cauldron') ? ` · ${esc(famName(jobFam('cauldron')!))} helps stir (+${(famStat(jobFam('cauldron')!, 'wit') / 25).toFixed(1)})` : ''}</span><div class="spacer"></div><button class="btn" data-bact="close" ${phase === 'stir' ? 'disabled' : ''}>Close · Esc</button></div>`;
  if (phase === 'pick') {
    const stacks: Pot[] = []; for (const st of S.inv) if (st && ING[st.id] && !stacks.some(s => s.id === st.id && s.q === st.q)) stacks.push({ id: st.id, q: st.q });
    stacks.sort((a, b) => ITEMS[a.id].name.localeCompare(ITEMS[b.id].name) || b.q - a.q);
    h += `<div class="cols"><div class="col-main"><div class="lbl">Your ingredients · click to add (up to 4)</div><div class="list ing">`;
    h += stacks.map(s => { const n = available(s.id, s.q); const d = ING[s.id]; const list = (Object.entries(d.asp) as [Aspect, number][]).sort((a, b) => b[1] - a[1]); const k = S.known[s.id] || 1;
      return `<button class="row-item btnlike" data-add="${s.id}|${s.q}" ${n <= 0 || pot.length >= 4 ? 'disabled' : ''}><div class="ri-ic"><img class="pix" alt="" src="${url(itemIcon(s.id, 3))}"></div><div class="ri-main"><div class="ri-name">${d.name} <span class="tier q${s.q}">${'★'.repeat(s.q)}</span> <span class="muted">×${n}</span></div><div class="ri-sub asp">${list.map(([a, v], i) => i < k ? `<span class="pip" style="--c:${ASPECT_INFO[a].col}">${ASPECT_INFO[a].name} ${v}</span>` : '<span class="pip unk">?</span>').join('')}</div></div></button>`; }).join('') || '<p class="muted">No ingredients. Grow, forage, or take them from defeated enemies.</p>';
    h += `</div></div><div class="col-side"><div class="potbox"><img class="pix potart" alt="" src="${url(scaleUp(cauldronArt(0, pot.length > 0)))}"><div class="potslots">${[0, 1, 2, 3].map(i => pot[i] ? `<button class="islot" data-rem="${i}" title="Remove">${`<img class="pix" alt="" src="${url(itemIcon(pot[i].id, 3))}">`}<span class="tier q${pot[i].q}">${'★'.repeat(pot[i].q)}</span></button>` : '<div class="islot empty"></div>').join('')}</div></div>`;
    const { tot, unknown } = knownTotals(); const max = Math.max(1, ...ASPECTS.map(a => tot[a]));
    h += `<div class="lbl">Known aspects in the pot</div><div class="aspbars">${ASPECTS.filter(a => tot[a] > 0).map(a => `<div class="ab"><span>${ASPECT_INFO[a].name}</span><div class="mbar"><i style="width:${tot[a] / max * 100}%;background:${ASPECT_INFO[a].col}"></i></div><b>${tot[a].toFixed(1)}</b></div>`).join('') || '<p class="muted">Add ingredients.</p>'}${unknown ? `<p class="muted">+ ${unknown} unknown aspect${unknown > 1 ? 's' : ''}</p>` : ''}</div>`;
    h += `<div class="lbl">Method</div><div class="methods">${(Object.keys(METHODS) as Method[]).map(m => `<button class="btn ${method === m ? 'on' : ''}" data-method="${m}" title="${esc(METHODS[m].desc)}">${METHODS[m].name}</button>`).join('')}</div><p class="muted small">${esc(METHODS[method].desc)}</p>`;
    const full = invFull() && !pot.length;
    h += `<button class="btn go wide" data-bact="brew" ${pot.length ? '' : 'disabled'}>Start stirring</button>${full ? '<p class="warn">Your bag is full.</p>' : ''}<p class="muted small">3+ ingredients make 2 potions.</p></div></div>`;
  } else if (phase === 'stir') {
    h += `<div class="stirwrap"><p>Stir ${stir.round + 1} of 3. Press <kbd>Space</kbd> or click <b>Stir</b> when the spoon is in the gold band.</p>
      <div class="stirbar" id="stirbar"><div class="band" style="left:${(stir.center - 0.11) * 100}%;width:22%"></div><div class="perfect" style="left:${(stir.center - 0.045) * 100}%;width:9%"></div><div class="spoon" id="spoon"></div></div>
      <div class="marks">${stir.marks.map(m => `<span class="mk ${m}">${m === 'perfect' ? 'Perfect' : m === 'good' ? 'Good' : 'Miss'}</span>`).join('')}</div>
      <button class="btn go wide" data-bact="stir">Stir</button></div>`;
  } else if (result) {
    const p = POTION[result.potion];
    h += `<div class="center result"><img class="pix big" alt="" src="${url(itemIcon('p_' + result.potion, 8))}"><h3>${result.potion === 'murky' ? 'Murky Brew' : `${TIER_NAMES[result.tier]} ${p.name}`} ×${result.count}</h3>
      ${newRecipe ? '<p class="good">New recipe discovered! It is now in your Grimoire.</p>' : ''}<p>${result.potion === 'murky' ? 'The brew curdles. Too weak or too muddled. Try fewer competing aspects, or Boil to purify.' : esc(p.desc(result.tier))}</p>
      <p class="muted">Stirs: ${stir.marks.map(m => m === 'perfect' ? 'Perfect' : m === 'good' ? 'Good' : 'Miss').join(', ')} · Purity ${Math.round(result.purity * 100)}%</p>
      ${revealed.length ? `<p class="good">You learned more about: ${revealed.map(esc).join(', ')}.</p>` : ''}
      <div class="btnrow center"><button class="btn go" data-bact="again">Brew again</button><button class="btn" data-bact="close">Done</button></div></div>`;
  }
  $('win').innerHTML = h;
}
const bigCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function scaleUp(c: HTMLCanvasElement) { let b = bigCache.get(c); if (b) return b; b = document.createElement('canvas'); b.width = c.width * 4; b.height = c.height * 4; const g = b.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, b.width, b.height); bigCache.set(c, b); return b; }

function startStir() {
  if (!pot.length) return;
  phase = 'stir'; stir = { round: 0, pos: 0, dir: 1, speed: 0.85, center: 0.3 + Math.random() * 0.4, score: 0, marks: [], raf: 0, last: performance.now() };
  render(); animate();
}
function animate() {
  cancelAnimationFrame(stir.raf);
  const step = (t: number) => { const dt = Math.min(0.05, (t - stir.last) / 1000); stir.last = t; stir.pos += stir.dir * stir.speed * dt; if (stir.pos > 1) { stir.pos = 1; stir.dir = -1; } if (stir.pos < 0) { stir.pos = 0; stir.dir = 1; }
    const sp = document.getElementById('spoon'); if (sp) sp.style.left = (stir.pos * 100) + '%'; if (phase === 'stir') stir.raf = requestAnimationFrame(step); };
  stir.raf = requestAnimationFrame(step);
}
function doStir() {
  if (phase !== 'stir') return; const d = Math.abs(stir.pos - stir.center);
  const m = d <= 0.045 ? 'perfect' : d <= 0.11 ? 'good' : 'miss'; stir.marks.push(m); stir.score += m === 'perfect' ? 1 : m === 'good' ? 0.5 : 0; sfx(m === 'perfect' ? 'perfect' : m === 'good' ? 'stir' : 'fail');
  stir.round++; if (stir.round >= 3) { cancelAnimationFrame(stir.raf); finishBrew(); return; }
  stir.center = 0.25 + Math.random() * 0.5; stir.speed += 0.35; render(); animate();
}
function finishBrew() {
  const f = jobFam('cauldron'); const extra = f && hasTal(f, 'alembic') ? 0.25 : 0;
  const r = resolveBrew(pot, method, stir.score, bonusPoints(), extra);
  for (const p of pot) removeItem(p.id, 1, p.q, p.q);
  const left = addItem('p_' + r.potion, r.tier, r.count);
  if (left > 0) { S.ship.push({ id: 'p_' + r.potion, q: r.tier, n: left }); hooks.toast('Bag full: the extra potions went into your shipping crate.', 'dim'); }
  revealed = []; const extraReveal = S.life.brew.lvl >= 5 ? 1 : 0;
  for (const id of Array.from(new Set(pot.map(p => p.id)))) { const n = Object.keys(ING[id].asp).length; const k = S.known[id] || 1; if (k < n) { S.known[id] = Math.min(n, k + 1 + extraReveal); revealed.push(ING[id].name); } }
  newRecipe = r.potion !== 'murky' && !S.recipes[r.potion];
  if (r.potion !== 'murky') { S.recipes[r.potion] = Math.max(S.recipes[r.potion] || 0, r.tier); S.brewed[r.potion] = (S.brewed[r.potion] || 0) + 1; }
  giveLife('brew', r.potion === 'murky' ? 3 : 8 + r.tier * 4); if (f) giveFamXp(f, 12);
  result = r; phase = 'result'; pot = []; sfx(r.potion === 'murky' ? 'fail' : 'evolve'); checkQuest(); saveNow(); hooks.hud(); render();
}
export function cauldronKey(k: string): boolean {
  if (phase === 'stir') { if (k === ' ' || k === 'enter' || k === 'e') { doStir(); return true; } return true; }
  if (k === 'escape' || k === 'tab') { close(); return true; }
  return false;
}
function close() { if (phase === 'stir') return; phase = 'pick'; result = null; $('win').dataset.kind = ''; closeModal(); }
export function initBrewUI() {
  $('win').addEventListener('click', e => {
    if ($('win').dataset.kind !== 'cauldron') return;
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b || b.disabled) return; const d = b.dataset;
    if (d.add) { const [id, q] = d.add.split('|'); if (pot.length < 4 && available(id, Number(q)) > 0) { pot.push({ id, q: Number(q) }); sfx('bubble'); } render(); return; }
    if (d.rem !== undefined) { pot.splice(Number(d.rem), 1); render(); return; }
    if (d.method) { method = d.method as Method; render(); return; }
    if (d.bact === 'brew') { startStir(); return; }
    if (d.bact === 'stir') { doStir(); return; }
    if (d.bact === 'again') { phase = 'pick'; result = null; render(); return; }
    if (d.bact === 'close') { close(); return; }
  });
  void countItem; void W;
}
