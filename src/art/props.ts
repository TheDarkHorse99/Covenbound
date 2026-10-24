// Homestead and village set pieces, drawn through the 16-bit pipeline (pix16.shaded):
// each prop is a grid of material letters built by a small per-pixel function, then auto-shaded and outlined.
import { shaded } from './pix16';
import { mk } from './pixel';

type Px = (x: number, y: number) => string;
function grid(w: number, h: number, f: Px): string[] { const rows: string[] = []; for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += f(x, y) || '.'; rows.push(r); } return rows; }
const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1;

// ---------- cauldron (22×19, two bubble frames) ----------
export function cauldron(frame: number, brewing: boolean): HTMLCanvasElement {
  const rows = grid(22, 19, (x, y) => {
    // bubbles above the rim
    const bub = frame ? [[7, 1], [13, 2], [10, 0]] : [[9, 2], [14, 0], [6, 1]];
    for (const [bx, by] of bub) if (x === bx && y === by) return 'b';
    if (y === 3 && x >= 2 && x <= 19) return 'r';
    if (y === 4) { if (x === 1 || x === 20) return 'r'; if (x >= 2 && x <= 19) return (frame ? (x === 5 || x === 12 || x === 17) : (x === 8 || x === 15)) ? 'b' : 'l'; }
    if (y === 5 && x >= 1 && x <= 20) return 'r';
    if (y >= 6 && y <= 13) { if ((x === 0 || x === 21) && (y === 7 || y === 8)) return 'h'; if (inEllipse(x, y, 10.5, 7.5, 10.2, 7)) return y === 9 && x > 3 && x < 18 ? 'n' : 'i'; }
    if (y === 14 && ((x >= 4 && x <= 5) || (x >= 16 && x <= 17))) return 'i';
    if (y >= 15 && y <= 16) { const f2 = (x + frame) % 3; if (x >= 7 && x <= 14) return y === 15 ? (f2 === 0 ? 'f' : f2 === 1 ? 'o' : '.') : (f2 === 2 ? 'f' : 'o'); if ((x >= 4 && x <= 5) || (x >= 16 && x <= 17)) return 'i'; }
    if (y >= 17 && x >= 3 && x <= 18) return 'w';
    return '.';
  });
  return shaded(`prop:cauldron:${frame}:${brewing}`, rows, { i: '#4e4c6c', r: '#6c6a90', h: '#3e3c58', n: '#5c5a80', w: '#7a5230', l: brewing ? '#8fd14f' : '#5cbf4a' }, { flat: { b: '#d8ffb0', f: '#ffd166', o: '#ff7a2a' } });
}

// ---------- shipping crate (18×15) ----------
export function crate(): HTMLCanvasElement {
  const rows = grid(18, 15, (x, y) => {
    if (y === 0 || y === 14 || x === 0 || x === 17) return 'd';
    if (y === 4 || y === 13) return 'd';
    if (y >= 1 && y <= 3) return y === 2 && (x === 4 || x === 13) ? 'm' : 'l';
    if (x === 1 || x === 16) return 'd';
    if (Math.abs((x - 1) - (y - 5) * 1.75) < 1 || Math.abs((16 - x) - (y - 5) * 1.75) < 1) return 'd'; // X brace
    if (y >= 7 && y <= 9 && x >= 7 && x <= 10) return y === 8 && (x === 8 || x === 9) ? 'g' : 'c';
    return 'p';
  });
  return shaded('prop:crate', rows, { d: '#6a4628', p: '#a87c50', l: '#bc9262', m: '#8a8aa0', c: '#e8dcc0' }, { flat: { g: '#c8a040' } });
}

// ---------- broom rack (18×18) ----------
export function rack(dye: string, bristle: string): HTMLCanvasElement {
  const rows = grid(18, 18, (x, y) => {
    const post = x === 1 || x === 2 || x === 15 || x === 16;
    if (y === 3 && x >= 0 && x <= 17 && !(x === 8 || x === 9)) return 'w';
    if (y >= 1 && y <= 16 && post) return 'w';
    if (y === 17 && (x <= 3 || x >= 14)) return 'w';
    if (y <= 9 && (x === 8 || x === 9)) return 'h';
    if (y === 10 && x >= 7 && x <= 10) return 'c';
    if (y >= 11 && y <= 16) { const half = 2 + Math.floor((y - 11) * 0.7); if (Math.abs(x - 8.5) <= half) return y === 16 && (x + y) % 2 ? '.' : 'b'; }
    return '.';
  });
  return shaded(`prop:rack:${dye}:${bristle}`, rows, { w: '#7a5634', h: dye, c: '#c8a040', b: bristle });
}

// ---------- familiar roost (40×30) ----------
export function roost(egg: boolean): HTMLCanvasElement {
  const rows = grid(40, 30, (x, y) => {
    // pitched roof
    if (y <= 7) { const half = 6 + y * 2.3; if (Math.abs(x - 19.5) <= half) return y === 7 ? 'T' : (y % 3 === 2 && (x + y) % 4 === 0 ? 'S' : 'R'); return '.'; }
    if (y === 8 && x >= 2 && x <= 37) return 'T';
    // nest of straw in front, with an egg when one is laid
    if (egg && inEllipse(x, y, 31.5, 23.2, 2.3, 3.1)) return y === 22 && x === 31 ? 'k' : 'e';
    if (y >= 24 && inEllipse(x, y, 31.5, 26.5, 6.5, 2.6)) return (x + y) % 3 === 0 ? 'z' : 's';
    // walls
    if (y >= 9 && y <= 26 && x >= 3 && x <= 36) {
      if (x >= 16 && x <= 23 && y >= 14 && inEllipse(x, y, 19.5, 20, 4.2, 6.5)) return 'D';
      if (y >= 11 && y <= 14 && ((x >= 6 && x <= 10) || (x >= 29 && x <= 33))) return x === 8 || x === 31 || y === 12 ? 'F' : 'y';
      if (x === 3 || x === 36) return 'P';
      return (y - 9) % 4 === 3 ? 'P' : 'W';
    }
    // perch & nest in front
    if (y >= 23 && y <= 26 && ((x >= 0 && x <= 2) || (x >= 37))) return '.';
    if (y >= 27 && x >= 3 && x <= 25) return 'B';
    return '.';
  });
  return shaded(`prop:roost:${egg}`, rows, { R: '#6a3a95', S: '#5a2e82', T: '#4a2a6a', W: '#9a6a40', P: '#74502e', F: '#5a3a22', s: '#e0c070', z: '#b8964a', e: '#f4ecd8', B: '#7a6a5a' }, { flat: { D: '#2a180e', y: '#f2c14e', k: '#f08ac0' } });
}

// ---------- order board (22×20) ----------
export function board(): HTMLCanvasElement {
  const rows = grid(22, 20, (x, y) => {
    if (y <= 1) return x >= 1 && x <= 20 ? 'T' : '.';
    if (y >= 2 && y <= 12) {
      if (x === 1 || x === 20 || y === 12 || y === 2) return x >= 1 && x <= 20 ? 'F' : '.';
      if (x < 1 || x > 20) return '.';
      if (x >= 3 && x <= 7 && y >= 4 && y <= 8) return x === 5 && y === 4 ? 'r' : (y === 6 && x > 3 && x < 7 ? 'i' : 'P');
      if (x >= 9 && x <= 13 && y >= 3 && y <= 10) return x === 11 && y === 3 ? 'r' : (y % 2 === 0 && x > 9 && x < 13 ? 'i' : 'Q');
      if (x >= 15 && x <= 18 && y >= 5 && y <= 9) return x === 16 && y === 5 ? 'r' : 'P';
      return 'C';
    }
    if ((x === 4 || x === 5 || x === 16 || x === 17) && y <= 19) return 'F';
    return '.';
  });
  return shaded('prop:board', rows, { T: '#8a3a46', F: '#6e4e30', C: '#a07a50', P: '#ece2c8', Q: '#e0d4b4' }, { flat: { r: '#e0484f', i: '#9a8e7a' } });
}

// ---------- well (22×24) ----------
export function well(): HTMLCanvasElement {
  const rows = grid(22, 24, (x, y) => {
    if (y <= 3) { const half = 6 + y * 1.6; return Math.abs(x - 10.5) <= half ? (y === 3 ? 'T' : 'R') : '.'; }
    if (y >= 4 && y <= 12) { if (x === 3 || x === 4 || x === 17 || x === 18) return 'w'; if (y === 6 && x > 4 && x < 17) return 'w';
      if (x === 10 && y >= 7 && y <= 10) return 'c'; if (y >= 10 && y <= 12 && x >= 9 && x <= 12) return 'b'; return '.'; }
    if (y >= 13 && y <= 14 && x >= 2 && x <= 19) return y === 13 ? 'K' : (x >= 4 && x <= 17 ? 'A' : 'K');
    if (y >= 15 && y <= 23 && x >= 2 && x <= 19) { const row = Math.floor((y - 15) / 3); return ((y - 15) % 3 === 2 || (x + row * 3) % 6 === 0) ? 'M' : 'K'; }
    return '.';
  });
  return shaded('prop:well', rows, { R: '#9a3a46', T: '#6a2a34', w: '#7a5634', c: '#c8b088', b: '#8a6440', K: '#8e887c', M: '#6a6458' }, { flat: { A: '#2c5f94' } });
}

export function lightTexture(): HTMLCanvasElement {
  const c = mk(128, 128), g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64); grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.85)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128); return c;
}
