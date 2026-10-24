import { mk } from '../art/pixel';
import { rngFrom } from '../core/util';

export const TL = {
  GRASS: 0, PATH: 1, TREE: 2, DEEP: 3, SHALLOW: 4, SOIL: 5, TILLED: 6, WET: 7, STONEWALL: 8, FLOOR: 9, FLOWERS: 10, TALL: 11,
  FENCE: 12, HWALL: 13, ROOF: 14, DOOR: 15, COBBLE: 16, EXIT: 17, ROOF_BLUE: 18, BLIGHT: 19, BUSH: 20, ROCK: 21, BRIDGE: 22,
  WINDOW: 23, ROOF_GREEN: 24, DEADTREE: 25, STALL: 26, TENT: 27, CAMPFIRE: 28, LILY: 29, ROOF_PURPLE: 30, HEDGE: 31,
} as const;
export const TILE_COUNT = 32;
const WALK_SOLID = new Set<number>([TL.TREE, TL.DEEP, TL.STONEWALL, TL.FENCE, TL.HWALL, TL.ROOF, TL.DOOR, TL.ROOF_BLUE, TL.BUSH, TL.ROCK, TL.WINDOW, TL.ROOF_GREEN, TL.DEADTREE, TL.STALL, TL.TENT, TL.CAMPFIRE, TL.LILY, TL.ROOF_PURPLE, TL.HEDGE]);
const PROJ_SOLID = new Set<number>([TL.TREE, TL.STONEWALL, TL.HWALL, TL.ROOF, TL.DOOR, TL.ROOF_BLUE, TL.ROCK, TL.WINDOW, TL.ROOF_GREEN, TL.DEADTREE, TL.STALL, TL.TENT, TL.ROOF_PURPLE, TL.HEDGE]);
export const walkSolid = (t: number) => WALK_SOLID.has(t);
export const projSolid = (t: number) => PROJ_SOLID.has(t);
export const isGrassy = (t: number) => t === TL.GRASS || t === TL.FLOWERS || t === TL.TALL;
export const ANIMATED = new Set<number>([TL.DEEP, TL.SHALLOW, TL.CAMPFIRE, TL.LILY]);

/** Paints one 16x16 tile. v = variant 0..3, f = animation frame 0..1 */
export function paintTile(g: CanvasRenderingContext2D, ox: number, oy: number, id: number, v: number, f: number) {
  const r = rngFrom(id * 7919 + v * 131 + 3);
  const p = (col: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(ox + x, oy + y, w, h); };
  const sp = (cols: string[], n: number, x0 = 0, y0 = 0, w = 16, h = 16) => { for (let i = 0; i < n; i++) p(cols[i % cols.length], x0 + Math.floor(r() * w), y0 + Math.floor(r() * h)); };
  const grass = () => { p('#4a8a3c', 0, 0, 16, 16); sp(['#5c9e48', '#3e7533'], 18); };
  const water = () => { p('#234d7a', 0, 0, 16, 16); for (let i = 0; i < 3; i++) p('#3a6ea0', (i * 6 + v * 3 + f * 3) % 12, (i * 5 + v * 2 + f * 2) % 16, 4, 1); };
  const roof = (a: string, b: string, d: string) => { p(a, 0, 0, 16, 16); for (let y = 0; y < 16; y += 4) for (let x = ((y / 4) % 2) * 2; x < 16; x += 4) p(b, x, y, 3, 3); p(d, 0, 15, 16, 1); };
  const plank = () => { p('#8a6440', 0, 0, 16, 16); p('#6e4e30', 0, 4, 16, 1); p('#6e4e30', 0, 9, 16, 1); p('#6e4e30', 0, 14, 16, 1); p('#9c744c', (v * 5) % 14, 1, 2, 1); };
  switch (id) {
    case TL.GRASS: grass(); if (v === 1) { p('#6db556', 3, 5); p('#6db556', 4, 4); p('#6db556', 11, 10); p('#6db556', 12, 9); } break;
    case TL.PATH: case TL.EXIT: p('#9c8158', 0, 0, 16, 16); sp(['#8a7049', '#b0966a'], 22); break;
    case TL.TREE:
      grass(); p('#5a3a22', 6, 11, 4, 5); p('#1f4a22', 2, 2, 12, 10); p('#1f4a22', 3, 1, 10, 12); p('#2f6a2e', 3, 2, 10, 9); p('#2f6a2e', 4, 1, 8, 11); p('#3f8a3a', 4, 2, 5, 4); p('#5aa84a', 5, 3, 2, 2); p('#173a1a', 3, 11, 10, 1);
      if (v === 2) { p('#d84a5a', 9, 6); p('#d84a5a', 6, 8); } if (v === 3) { p('#f2d64e', 10, 4); p('#f2d64e', 5, 7); } break;
    case TL.DEEP: water(); break;
    case TL.LILY: water(); p('#3f8a3a', 4, 5, 7, 5); p('#5aa84a', 5, 5, 4, 2); p('#234d7a', 8, 7, 3, 1); p('#f08ac0', 6, 6, 2, 2); break;
    case TL.SHALLOW: p('#4f93b8', 0, 0, 16, 16); sp(['#6fb3d6', '#3f7fa3'], 10); p('#9fd4ee', (v * 4 + f * 5) % 12, (v * 3 + f * 4) % 14, 3, 1); break;
    case TL.SOIL: p('#7a5a3a', 0, 0, 16, 16); sp(['#6a4a2e', '#8a6a48'], 20); if (v === 3) { p('#5c9e48', 4, 6); p('#5c9e48', 11, 12); } break;
    case TL.TILLED: p('#6a4428', 0, 0, 16, 16); for (let y = 2; y < 16; y += 4) { p('#4e3018', 1, y, 14, 1); p('#8a5e38', 1, y + 1, 14, 1); } break;
    case TL.WET: p('#43281a', 0, 0, 16, 16); for (let y = 2; y < 16; y += 4) { p('#2e1a10', 1, y, 14, 1); p('#5a3a26', 1, y + 1, 14, 1); } p('#6a8aa0', (v * 5) % 12 + 1, 7, 2, 1); break;
    case TL.STONEWALL: p('#3d3852', 0, 0, 16, 16); for (let row = 0; row < 3; row++) { const y = row * 5 + 1, off = (row % 2) * 4; for (let x = -4; x < 16; x += 8) p('#5a5474', x + off, y, 7, 4); p('#6a6486', off + 1, y, 2, 1); } break;
    case TL.FLOOR: p('#5f5a72', 0, 0, 16, 16); p('#544f66', 0, 0, 16, 1); p('#544f66', 0, 0, 1, 16); p('#6a6580', 1, 1, 7, 7); p('#66617c', 8, 8, 7, 7); break;
    case TL.FLOWERS: { grass(); const fc = ['#e86a8a', '#f2d64e', '#c8a0f0', '#ffffff']; for (let i = 0; i < 4; i++) { const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12); p(fc[(i + v) % 4], x, y); p('#2e6a28', x, y + 1); } break; }
    case TL.TALL: grass(); for (let i = 0; i < 5; i++) { const x = 1 + Math.floor(r() * 14), y = 4 + Math.floor(r() * 10); p('#6db556', x, y, 1, 3); p('#2e6a28', x + 1, y + 1, 1, 2); } break;
    case TL.FENCE: grass(); p('#6e4e30', 2, 3, 2, 12); p('#6e4e30', 12, 3, 2, 12); p('#a07a50', 0, 6, 16, 2); p('#a07a50', 0, 11, 16, 2); p('#c09a68', 0, 6, 16, 1); break;
    case TL.HEDGE: grass(); p('#1f4a22', 0, 2, 16, 13); p('#2f6a2e', 1, 2, 14, 10); p('#3f8a3a', 2, 3, 5, 3); p('#3f8a3a', 9, 5, 4, 3); p('#173a1a', 0, 14, 16, 1); break;
    case TL.HWALL: plank(); break;
    case TL.WINDOW: plank(); p('#2a1f43', 4, 3, 8, 8); p('#f2c14e', 5, 4, 6, 6); p('#ffe9a0', 5, 4, 2, 2); p('#6e4e30', 7, 4, 1, 6); p('#6e4e30', 5, 6, 6, 1); break;
    case TL.DOOR: plank(); p('#3a2416', 4, 2, 8, 14); p('#2a180e', 4, 2, 8, 1); p('#4a2e1c', 5, 3, 3, 12); p('#f2c14e', 10, 9); break;
    case TL.ROOF: roof('#6a2a34', '#953a46', '#4a1a24'); break;
    case TL.ROOF_BLUE: roof('#2a3a6a', '#3a5a95', '#1a244a'); break;
    case TL.ROOF_GREEN: roof('#2a5a34', '#3a7a46', '#1a3a24'); break;
    case TL.ROOF_PURPLE: roof('#4a2a6a', '#6a3a95', '#2a1a4a'); break;
    case TL.COBBLE: p('#5f5a50', 0, 0, 16, 16); for (let y = 0; y < 16; y += 5) for (let x = -2 + ((y / 5) % 2) * 3; x < 16; x += 6) { p('#8a847a', x + 1, y + 1, 5, 4); p('#9c968a', x + 1, y + 1, 2, 1); } break;
    case TL.BLIGHT: p('#3a2a44', 0, 0, 16, 16); sp(['#4a3456', '#2a1e34', '#6a3a8a'], 20); if (v % 2) { p('#9a5ad6', 4 + v, 6, 2, 1); p('#c8ff6a', 11, 3 + v); } break;
    case TL.BUSH: grass(); p('#1f4a22', 2, 5, 12, 10); p('#2f6a2e', 3, 4, 10, 9); p('#3f8a3a', 4, 5, 4, 3); p('#173a1a', 2, 14, 12, 1); if (v >= 2) { p('#e0484f', 6, 9); p('#e0484f', 10, 7); p('#e0484f', 8, 11); } break;
    case TL.ROCK: grass(); p('#6d675e', 2, 5, 12, 10); p('#8f897c', 3, 4, 10, 9); p('#a7a092', 4, 5, 5, 3); p('#625d54', 3, 13, 10, 2); break;
    case TL.BRIDGE: water(); for (let y = 0; y < 16; y += 4) { p('#8a6a44', 1, y, 14, 3); p('#a07e52', 1, y, 14, 1); } p('#5a4228', 0, 0, 1, 16); p('#5a4228', 15, 0, 1, 16); break;
    case TL.DEADTREE: p('#3a2a44', 0, 0, 16, 16); sp(['#4a3456'], 8); p('#5e5a66', 7, 4, 3, 12); p('#5e5a66', 3, 5, 4, 1); p('#5e5a66', 10, 3, 4, 1); p('#5e5a66', 3, 3, 1, 2); p('#5e5a66', 13, 1, 1, 2); p('#45424f', 7, 4, 1, 12); p('#9a5ad6', 8, 8); break;
    case TL.STALL: p('#5f5a50', 0, 0, 16, 16); p('#e8e0c8', 0, 2, 16, 6); for (let x = 0; x < 16; x += 4) p(v % 2 ? '#3a8a5a' : '#a63a3a', x, 2, 2, 6); p('#6e4e30', 1, 8, 2, 8); p('#6e4e30', 13, 8, 2, 8); p('#8a6440', 0, 10, 16, 3); p('#f2c14e', 4, 9, 2, 1); p('#e86a8a', 9, 9, 2, 1); break;
    case TL.TENT: grass(); p('#7a6a4a', 1, 4, 14, 12); p('#9a8a5a', 2, 3, 12, 2); p('#3a2a1a', 6, 9, 4, 7); p('#5a4a3a', 7, 2, 2, 2); break;
    case TL.CAMPFIRE: p('#9c8158', 0, 0, 16, 16); p('#5a5048', 3, 10, 10, 4); p('#3a2416', 4, 11, 8, 2); p(f ? '#ffd166' : '#f07a3a', 6, 5 + f, 4, 6 - f); p(f ? '#f07a3a' : '#e0484f', 7, 3, 2, 4); p('#fff1b0', 7, 8, 2, 2); break;
  }
}

export function buildTileset(frame: number, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? mk(16 * 16, 16 * 8); const g = c.getContext('2d')!;
  for (let id = 0; id < TILE_COUNT; id++) for (let v = 0; v < 4; v++) {
    if (canvas && !ANIMATED.has(id)) continue;
    const idx = id * 4 + v; const x = (idx % 16) * 16, y = Math.floor(idx / 16) * 16;
    g.clearRect(x, y, 16, 16); paintTile(g, x, y, id, v, frame);
  }
  return c;
}
export const tileIndex = (id: number, v: number) => id * 4 + (v & 3);
