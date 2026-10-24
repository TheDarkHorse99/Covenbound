import { shaded } from '../art/pix16';
import { FAM_ART, FAM_FLAT } from '../art/familiars16';
import { ENEMY_ART } from '../art/enemies16';
import { charSprite, broomRider16, HatStyle } from '../art/chars16';
import { Terrain, findRoofs } from '../world/terrain';
import { getMap } from '../world/maps';
const out = document.getElementById('out')!;
function show(c: HTMLCanvasElement, s = 4, label = '') { const d = document.createElement('span'); d.style.display = 'inline-block'; d.style.margin = '4px'; d.style.verticalAlign = 'bottom'; const cv = document.createElement('canvas'); cv.width = c.width * s; cv.height = c.height * s; const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, cv.width, cv.height); d.appendChild(cv); if (label) { const l = document.createElement('div'); l.textContent = label; d.appendChild(l); } out.appendChild(d); }
const params = new URLSearchParams(location.search); const what = params.get('w') || 'fam';
if (what === 'fam') { for (const sp in FAM_ART) { FAM_ART[sp].forEach((a, i) => show(shaded(sp + i, a.rows, a.mats, { flat: FAM_FLAT }), Number(params.get('s') || 4), sp + (i + 1))); out.appendChild(document.createElement('br')); } }
if (what === 'enemy') { for (const k in ENEMY_ART) { const a = ENEMY_ART[k]; show(shaded(k, a.rows, a.mats, { flat: a.flat }), Number(params.get('s') || 4), k); } }
if (what === 'char') {
  const look = { hat: 'pointed' as HatStyle, hatCol: '#2a2140', band: '#b06aff', hair: '#c0502a', skin: '#f1c6a0', robe: '#6b3fa0' };
  for (const h of ['pointed', 'crooked', 'wide', 'spire', 'flower', 'hood', 'bandana', 'mitre', 'none'] as HatStyle[]) { for (const d of ['down', 'up', 'side'] as const) for (const f of [0, 1, 2]) show(charSprite({ ...look, hat: h, hatCol: h === 'mitre' || h === 'hood' ? '#e8e8f0' : look.hatCol }, d, f), Number(params.get('s') || 4)); out.appendChild(document.createElement('br')); }
  show(broomRider16(look, '#b08a5a', '#e0c070', '#f2c14e', 0), 4); show(charSprite({ ...look, hat: 'bandana', hatCol: '#a63a3a', band: '#a63a3a', robe: '#6a3a2a' }, 'down', 0, 2), 4);
}
if (what === 'map') {
  const id = params.get('m') || 'village'; const map = getMap(id);
  const t = new Terrain({ w: map.w, h: map.h, m: map.m, v: map.v, id, roofs: findRoofs(map.m, map.w, map.h), home: { wall: 0, floor: 0 } });
  const c = document.createElement('canvas'); c.width = map.w * 16; c.height = map.h * 16; const g = c.getContext('2d')!; g.drawImage(t.ground.canvas, 0, 0); g.drawImage(t.over.canvas, 0, 0); show(c, Number(params.get('s') || 2));
}
