// 16×24 four-direction characters assembled from layers: body (per direction) + legs (per walk frame) + hat/hood.
import { shaded, scale2x } from './pix16';
import { mk } from './pixel';

export type Dir = 'down' | 'up' | 'side';
export type HatStyle = 'pointed' | 'wide' | 'crooked' | 'flower' | 'spire' | 'hood' | 'bandana' | 'mitre' | 'none';
export interface Look { hat: HatStyle; hatCol: string; band: string; hair: string; skin: string; robe: string; trim?: string; legs?: string; boots?: string }

const E5 = ['................', '................', '................', '................', '................'];
const BODY: Record<Dir, string[]> = {
  down: [...E5,
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhh..',
    '..hhhhhssshhhh..',
    '..hhsssssssshh..',
    '..hssewssewssh..',
    '..hsseesseessh..',
    '..hhpssmmsspih..',
    '..hhh.ssss.hhh..',
    '..hh..CssC..hh..',
    '..hhaRRjjRRahh..',
    '...aaRRRRRRaa...',
    '..aaRRRRRRRRaa..',
    '..asRRRRRRRRsa..',
    '...sRRRrrRRRs...',
    '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..',
    '..RRRRRRRRRRRR..',
    '.RRRRRRRRRRRRRR.',
    '.rrrrrrrrrrrrrr.'],
  up: [...E5,
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..ahhhhhhhhhha..',
    '..aaRhhhhhhRaa..',
    '..aaRRhhhhRRaa..',
    '..asRRRhhRRRsa..',
    '...sRRRRRRRRs...',
    '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..',
    '..RRRRRRRRRRRR..',
    '.RRRRRRRRRRRRRR.',
    '.rrrrrrrrrrrrrr.'],
  side: [...E5,
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hhhhhhhsss...',
    '...hhhhhhssss...',
    '...hhhhhsssews..',
    '...hhhhhssssss..',
    '...hhhhsssss....',
    '...hhhh.ss......',
    '...hhh.CsC......',
    '....hRRRRRR.....',
    '....RRRRaaR.....',
    '....RRRRaaRR....',
    '....RRRRRsRR....',
    '....RRrrrrRR....',
    '....RRRRRRRR....',
    '...RRRRRRRRRR...',
    '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..',
    '..rrrrrrrrrrrr..'],
};
const LEGS: Record<Dir, string[][]> = {
  down: [['....LL....LL....', '...BBB....BBB...'], ['....LL.....L....', '...BBB.....B....'], ['....L.....LL....', '....B....BBB....']],
  up: [['....LL....LL....', '...BBB....BBB...'], ['....LL.....L....', '...BBB.....B....'], ['....L.....LL....', '....B....BBB....']],
  side: [['.....LL.LL......', '....BBB.BBB.....'], ['....LL...LL.....', '...BBB....BBB...'], ['.....LLLL.......', '.....BBBB.......']],
};
const HATS: Record<HatStyle, string[]> = {
  pointed: ['.........H......', '........HH......', '.......HHH......', '......HHHHH.....', '.....HHHHHH.....', '.....HHHHHHH....', '....HTTTTTTH....', '.HHHHHHHHHHHHHH.', '..HHHHHHHHHHHH..'],
  crooked: ['...HH...........', '....HH..........', '.....HHH........', '......HHHH......', '.....HHHHHH.....', '.....HHHHHHH....', '....HTTTTTTH....', '.HHHHHHHHHHHHHH.', '..HHHHHHHHHHHH..'],
  wide: ['................', '................', '................', '......HHHH......', '.....HHHHHH.....', '.....HHHHHH.....', '.....TTTTTT.....', 'HHHHHHHHHHHHHHHH', '.HHHHHHHHHHHHHH.'],
  spire: ['.......Y........', '.......HH.......', '......HHH.......', '......HHHH......', '.....HHHHH......', '.....HHHHHH.....', '....HTTTTTTH....', '.HHHHHHHHHHHHHH.', '..HHHHHHHHHHHH..'],
  flower: ['................', '................', '................', '................', '....F...F...F...', '...FfF.FfF.FfF..', '................'],
  hood: ['................', '................', '................', '................', '.....HHHHHH.....', '....HHHHHHHH....', '...HHHHHHHHHH...', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HH........HH..', '..HH........HH..', '..HH........HH..', '...HH......HH...', '...HHH....HHH...'],
  bandana: ['................', '................', '................', '................', '................', '....TTTTTTTT....', '...TTTTTTTTTT...', '..TTTTTTTTTTTTT.', '..TTTTTTTTTTTTTT', '..............TT'],
  mitre: ['......HHHH......', '.....HHHHHH.....', '.....HHYYHH.....', '.....HYYYYH.....', '.....HHYYHH.....', '.....HHHHHH.....', '....HHTTTTHH....', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HH........HH..', '..HH........HH..', '..HH........HH..', '...HH......HH...', '...HHH....HHH...'],
  none: [],
};
function sideHat(rows: string[], style: HatStyle): string[] {
  if (style === 'hood' || style === 'mitre') return rows.map((r, i) => i >= 9 ? '..HH' + r.slice(4).replace(/H/g, '.') : r);
  return rows.map((r, i) => { if (i >= 6) return r; const s = Math.ceil((6 - i) / 2.5); return r.slice(s) + '.'.repeat(s); });
}
function overlay(base: string[], over: string[]): string[] {
  return base.map((row, y) => { const o = over[y]; if (!o) return row; let s = ''; for (let x = 0; x < row.length; x++) { const c = o[x]; s += c && c !== '.' ? c : row[x]; } return s; });
}
const cache = new Map<string, HTMLCanvasElement>();
export function charSprite(look: Look, dir: Dir, frame: number, scale = 1): HTMLCanvasElement {
  const key = `${look.hat}|${look.hatCol}|${look.band}|${look.hair}|${look.skin}|${look.robe}|${look.trim}|${look.legs}|${look.boots}|${dir}|${frame}|${scale}`;
  const hit = cache.get(key); if (hit) return hit;
  let rows = BODY[dir].concat(LEGS[dir][frame]);
  let hat = HATS[look.hat]; if (dir === 'side') hat = sideHat(hat, look.hat);
  if (dir === 'up' && look.hat === 'hood') hat = hat.map((r, i) => i >= 9 ? r.replace(/\./g, (m, idx: number) => (idx >= 2 && idx <= 13 ? 'H' : '.')) : r);
  rows = overlay(rows, hat);
  const mats: Record<string, string> = { h: look.hair, s: look.skin, R: look.robe, r: look.trim || shiftDark(look.robe), a: look.robe, C: look.trim || '#e8dcc0', L: look.legs || '#3a2a3a', B: look.boots || '#4a2e1a', H: look.hatCol, T: look.band, F: '#f08ac0', j: '#f2c14e', p: '#f0a0a0', i: '#f0a0a0' };
  let c = shaded('char:' + key, rows, mats, { flat: { e: '#1a1020', w: '#ffffff', m: '#9a4a4a', Y: '#f2c14e', f: '#ffe680' }, noShade: 'pi' });
  if (scale === 2) c = scale2x(c);
  cache.set(key, c); return c;
}
function shiftDark(hex: string) { const n = parseInt(hex.slice(1), 16); const f = 0.62; return '#' + ((1 << 24) | (Math.round((n >> 16) * f) << 16) | (Math.round(((n >> 8) & 255) * f) << 8) | Math.round((n & 255) * f)).toString(16).slice(1); }

/** Witch riding side-saddle on a broom (side view). */
const riderCache = new Map<string, HTMLCanvasElement>();
export function broomRider16(look: Look, handle: string, bristle: string, lantern: string | null, frame: number): HTMLCanvasElement {
  const key = JSON.stringify(look) + handle + bristle + lantern + frame; const hit = riderCache.get(key); if (hit) return hit;
  const body = charSprite(look, 'side', 0); const c = mk(34, body.height + 2); const g = c.getContext('2d')!;
  g.drawImage(body, 0, 0, body.width, body.height - 4, 9, 0, body.width, body.height - 4);
  const y = body.height - 6; const dk = '#1e1418';
  g.fillStyle = dk; g.fillRect(6, y - 1, 26, 4); g.fillStyle = handle; g.fillRect(8, y, 24, 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(8, y, 24, 1);
  g.fillStyle = dk; g.fillRect(0, y - 4, 10, 10); g.fillStyle = bristle; g.fillRect(1, y - 3, 8, 8); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) g.fillRect(1 + ((i * 2 + frame) % 8), y - 3 + i * 2, 3, 1);
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(2, y - 3, 6, 1);
  if (lantern) { g.fillStyle = dk; g.fillRect(28, y + 1, 1, 3); g.fillRect(26, y + 3, 6, 7); g.fillStyle = lantern; g.fillRect(27, y + 4, 4, 5); g.fillStyle = '#ffffff'; g.fillRect(28, y + 5, 1, 2); }
  riderCache.set(key, c); return c;
}
