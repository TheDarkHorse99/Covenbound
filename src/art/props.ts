import { mk, OUTLINE } from './pixel';

const cache = new Map<string, HTMLCanvasElement>();
function draw(key: string, w: number, h: number, fn: (p: (c: string, x: number, y: number, w?: number, h?: number) => void) => void): HTMLCanvasElement {
  const hit = cache.get(key); if (hit) return hit;
  const c = mk(w, h), g = c.getContext('2d')!; const p = (col: string, x: number, y: number, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  fn(p); cache.set(key, c); return c;
}
export function cauldron(frame: number, brewing: boolean): HTMLCanvasElement {
  return draw(`cauldron:${frame}:${brewing}`, 20, 18, p => {
    p(OUTLINE, 2, 5, 16, 12); p(OUTLINE, 1, 6, 18, 9); p('#2a2838', 3, 6, 14, 10); p('#3a3850', 2, 7, 16, 7); p('#4a4868', 4, 8, 3, 3); p(OUTLINE, 3, 16, 3, 2); p(OUTLINE, 14, 16, 3, 2);
    p(OUTLINE, 1, 4, 18, 3); p('#5a5878', 2, 5, 16, 1);
    const liq = brewing ? '#8fd14f' : '#5cbf4a'; p(liq, 4, 4, 12, 2); p('#c8ff9a', 5 + frame * 3, 4, 2, 1); p('#c8ff9a', 12 - frame * 2, 5, 1, 1);
    if (frame) { p('#c8ff9a', 7, 1, 2, 2); p('#a8e070', 11, 0, 1, 1); } else { p('#c8ff9a', 10, 2, 2, 2); p('#a8e070', 6, 1, 1, 1); }
    p('#f07a3a', 6, 17, 2, 1); p('#ffd166', 9, 17, 2, 1); p('#f07a3a', 12, 17, 2, 1);
  });
}
export function crate(): HTMLCanvasElement {
  return draw('crate', 16, 14, p => { p(OUTLINE, 0, 0, 16, 14); p('#a07a50', 1, 1, 14, 12); p('#8a6440', 1, 4, 14, 1); p('#8a6440', 1, 9, 14, 1); p('#6e4e30', 1, 1, 2, 12); p('#6e4e30', 13, 1, 2, 12); p('#c09a68', 3, 2, 10, 1); p('#f2c14e', 7, 6, 2, 2); });
}
export function rack(dye: string, bristle: string): HTMLCanvasElement {
  return draw(`rack:${dye}:${bristle}`, 16, 16, p => {
    p(OUTLINE, 1, 3, 3, 13); p(OUTLINE, 12, 3, 3, 13); p('#6e4e30', 2, 4, 1, 12); p('#6e4e30', 13, 4, 1, 12); p(OUTLINE, 0, 6, 16, 3); p('#8a6440', 1, 7, 14, 1);
    p(OUTLINE, 6, 0, 4, 16); p(dye, 7, 1, 2, 10); p(OUTLINE, 4, 10, 8, 6); p(bristle, 5, 11, 6, 4);
  });
}
export function roost(egg: boolean): HTMLCanvasElement {
  return draw(`roost:${egg}`, 40, 28, p => {
    p(OUTLINE, 2, 6, 36, 22); p('#8a6440', 3, 10, 34, 17); p('#6e4e30', 3, 14, 34, 1); p('#6e4e30', 3, 19, 34, 1); p('#6e4e30', 3, 24, 34, 1);
    p(OUTLINE, 0, 2, 40, 9); p('#4a2a6a', 1, 3, 38, 7); p('#6a3a95', 2, 4, 36, 2); p(OUTLINE, 15, 14, 10, 13); p('#2a180e', 16, 15, 8, 12);
    p('#e0c070', 27, 22, 9, 4); p('#c0a050', 28, 23, 7, 2); if (egg) { p(OUTLINE, 29, 18, 5, 6); p('#f4ecd8', 30, 19, 3, 4); p('#f08ac0', 31, 20, 1, 1); }
    p('#f2c14e', 6, 13, 4, 4); p('#ffe9a0', 6, 13, 2, 2);
  });
}
export function board(): HTMLCanvasElement {
  return draw('board', 18, 16, p => { p(OUTLINE, 0, 0, 18, 11); p('#8a6440', 1, 1, 16, 9); p('#e9dfc7', 2, 2, 5, 4); p('#e9dfc7', 8, 3, 4, 5); p('#f4ecd8', 13, 2, 3, 4); p('#a63a3a', 4, 2, 1, 1); p(OUTLINE, 3, 11, 2, 5); p(OUTLINE, 13, 11, 2, 5); p('#6e4e30', 3, 11, 1, 5); p('#6e4e30', 13, 11, 1, 5); });
}
export function well(): HTMLCanvasElement {
  return draw('well', 18, 20, p => { p(OUTLINE, 1, 9, 16, 11); p('#7a748e', 2, 10, 14, 9); p('#8f89a4', 2, 10, 14, 2); p('#234d7a', 4, 11, 10, 2); p(OUTLINE, 2, 0, 2, 10); p(OUTLINE, 14, 0, 2, 10); p('#6e4e30', 2, 1, 1, 9); p('#6e4e30', 14, 1, 1, 9); p(OUTLINE, 0, 0, 18, 3); p('#6a2a34', 1, 0, 16, 2); });
}
export function lightTexture(): HTMLCanvasElement {
  const hit = cache.get('light'); if (hit) return hit; const c = mk(128, 128), g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64); grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.85)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128); cache.set('light', c); return c;
}
