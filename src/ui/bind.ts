// Binding ritual: a tug-of-will. Hold to raise your binding circle and keep the familiar's spirit inside it.
import { removeItem } from '../core/state';
import { hooks } from '../world/world';
import { Enemy, bindInfo, bindResult } from '../world/combat';
import { SPECIES, ELEMENT_INFO } from '../data/familiars';
import { ITEMS } from '../data/items';
import { famSprite } from '../art/sprites';
import { url } from '../art/pixel';
import { esc } from '../core/util';
import { sfx } from '../core/audio';
import { keys } from './input';
import { openModal, closeModal } from './menus';

const $ = (id: string) => document.getElementById(id)!;
let raf = 0;
export function openBind(w: Enemy) {
  const info = bindInfo(w);
  if (!info.charm) { hooks.toast('You need a Binding Charm. Marrow sells them in Hollowmere.', 'bad'); return; }
  removeItem(info.charm, 1); hooks.hud();
  const sp = SPECIES[w.sp!]; const el = ELEMENT_INFO[sp.el];
  const advTxt = info.adv > 1 ? `<span class="good">Your familiar's element calms it.</span>` : info.adv < 1 ? `<span class="warn">Your familiar's element agitates it.</span>` : '';
  openModal(`<div class="whead"><h2>Binding ritual</h2><span class="muted">${esc(ITEMS[info.charm].name)}</span><div class="spacer"></div><span class="lbl">Esc gives up</span></div>
    <div class="bindwrap">
      <div class="bindinfo"><img class="pix bigfam" alt="" src="${url(famSprite(w.sp!, 1))}"><h3 style="color:${el.col}">${esc(w.def.name)}</h3>
        <div>Temper: <b>${info.label}</b></div><div class="muted small">Rarer, healthier familiars resist harder. Better charms give a wider circle.</div>${advTxt}
        <p>Hold <kbd>Space</kbd> or the mouse to raise your circle; let go to let it sink. Keep the spirit inside until the binding fills.</p></div>
      <div class="bindtrack" id="bTrack"><div class="bzone" id="bZone"></div><img class="pix bspirit" id="bSpirit" alt="" src="${url(famSprite(w.sp!, 1))}"></div>
      <div class="bindprog"><i id="bProg"></i></div>
    </div>`, { kind: 'bind' }, k => { if (k === 'escape') { finish(false); return true; } return true; });
  let hold = false; const down = () => { hold = true; }, up = () => { hold = false; };
  $('win').addEventListener('pointerdown', down); addEventListener('pointerup', up);
  const zone = info.zone, diff = info.diff;
  let zp = 0.3, zv = 0, sp2 = 0.45, tgt = 0.5, tT = 0, prog = 0.3, last = performance.now(), done = false, wobble = 0;
  function finish(ok: boolean) {
    if (done) return; done = true; cancelAnimationFrame(raf); $('win').removeEventListener('pointerdown', down); removeEventListener('pointerup', up);
    const tr = document.getElementById('bTrack'); if (tr) tr.classList.add(ok ? 'won' : 'lost');
    setTimeout(() => { closeModal(); bindResult(w, ok); }, ok ? 650 : 450);
  }
  const step = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t; if (done) return;
    const holding = hold || !!keys[' '];
    zv += (holding ? 2.6 : -2.1) * dt; zv = Math.max(-1.3, Math.min(1.3, zv)); zp += zv * dt;
    if (zp < 0) { zp = 0; zv *= -0.25; } if (zp > 1 - zone) { zp = 1 - zone; zv *= -0.25; }
    tT -= dt; if (tT <= 0) { const dart = Math.random() < 0.16 * diff; tgt = dart ? (sp2 > 0.5 ? Math.random() * 0.3 : 0.7 + Math.random() * 0.3) : Math.random(); tT = (0.7 + Math.random() * 1.2) / Math.sqrt(diff); }
    wobble += dt * 9; sp2 += (tgt - sp2) * Math.min(1, dt * (0.9 + diff * 0.8)) + Math.sin(wobble) * 0.004 * diff; sp2 = Math.max(0.02, Math.min(0.98, sp2));
    const inside = sp2 >= zp && sp2 <= zp + zone;
    prog += inside ? 0.3 * dt : -0.17 * dt * Math.sqrt(diff); prog = Math.min(1, prog);
    const zEl = document.getElementById('bZone'), sEl = document.getElementById('bSpirit'), pEl = document.getElementById('bProg');
    if (zEl) { zEl.style.bottom = (zp * 100) + '%'; zEl.style.height = (zone * 100) + '%'; zEl.classList.toggle('in', inside); }
    if (sEl) sEl.style.bottom = `calc(${sp2 * 100}% - 12px)`;
    if (pEl) { pEl.style.height = (Math.max(0, prog) * 100) + '%'; }
    if (inside && Math.random() < dt * 3) sfx('stir');
    if (prog >= 1) { sfx('bind'); finish(true); return; }
    if (prog <= 0) { finish(false); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
