import { game } from './state';
import { W, interact, useSelected, toggleBroom, usePotion, hooks } from '../world/world';
import { castSkill } from '../world/combat';
import { S } from '../core/state';
import { audio } from '../core/audio';
import { POTION } from '../data/brewing';

export const keys: Record<string, boolean> = {};
let handlers: { menu: (tab?: string) => void; close: () => void; advance: () => void; modalKey: (k: string) => boolean } = { menu: () => {}, close: () => {}, advance: () => {}, modalKey: () => false };
export function setInputHandlers(h: typeof handlers) { handlers = h; }

function quickHeal() {
  let best = -1, bestScore = -1;
  S.inv.forEach((st, i) => { if (!st || !st.id.startsWith('p_')) return; const id = st.id.slice(2); if (!['healing', 'clarity', 'stoneheart'].includes(id)) return; const sc = st.q * 10 + (id === 'healing' ? 1 : 0); if (sc > bestScore) { bestScore = sc; best = i; } });
  if (best < 0) { hooks.toast('No healing potions. Brew some at your cauldron.', 'dim'); return; }
  usePotion(best);
}
export function initInput() {
  addEventListener('keydown', e => {
    const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (game.playing && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    const wasDown = keys[k]; keys[k] = true;
    if (!game.playing) return;
    if (game.dialog) { if (!wasDown && (k === 'e' || k === ' ' || k === 'enter' || k === 'escape')) handlers.advance(); return; }
    if (game.modal) { if (handlers.modalKey(k)) return; if (k === 'escape' || k === 'tab' || k === 'i') handlers.close(); return; }
    if (wasDown && !['j', 'k', 'l'].includes(k)) return;
    if (W.P.dead > 0) return;
    if (k === 'j') castSkill(0); else if (k === 'k') castSkill(1); else if (k === 'l') castSkill(2);
    else if (k === 'e' || k === ' ') interact();
    else if (k === 'c') useSelected();
    else if (k === 'b') toggleBroom();
    else if (k === 'h') quickHeal();
    else if (/^[0-9]$/.test(k)) { S.sel = k === '0' ? 9 : Number(k) - 1; hooks.hud(); }
    else if (k === 'tab' || k === 'i') handlers.menu('bag');
    else if (k === 'f') handlers.menu('fams');
    else if (k === 'g') handlers.menu('grimoire');
    else if (k === 'q') handlers.menu('quest');
    else if (k === 'escape') handlers.menu('witch');
    else if (k === 'm') { audio.muted = !audio.muted; hooks.toast(audio.muted ? 'Sound off' : 'Sound on', 'dim'); }
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  game.pollInput = () => {
    let x = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + stick.x;
    let y = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) + stick.y;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) { if (!p) continue; const ax = p.axes[0] || 0, ay = p.axes[1] || 0; if (Math.hypot(ax, ay) > 0.2) { x += ax; y += ay; } padButtons(p); break; }
    W.input.x = x; W.input.y = y;
  };
}
export const stick = { x: 0, y: 0 };
const padPrev: boolean[] = [];
function padButtons(p: Gamepad) {
  const pressed = (i: number) => { const b = !!p.buttons[i]?.pressed; const was = padPrev[i]; padPrev[i] = b; return b && !was; };
  if (pressed(0)) castSkill(0); if (pressed(2)) castSkill(1); if (pressed(3)) castSkill(2); if (pressed(1)) interact();
  if (pressed(5)) { S.sel = (S.sel + 1) % 10; hooks.hud(); } if (pressed(4)) { S.sel = (S.sel + 9) % 10; hooks.hud(); }
  if (pressed(7)) useSelected(); if (pressed(6)) toggleBroom(); if (pressed(9)) handlers.menu('bag'); if (pressed(8)) handlers.menu('fams');
  void POTION;
}
