import { shaded } from './pix16';
import { mk } from './pixel';

interface Art { rows: string[]; mats: Record<string, string>; flat?: Record<string, string> }
const WOOD = '#8a5a34', DARK = '#5a3a22';
const ART: Record<string, Art> = {
  bed: { mats: { w: WOOD, d: DARK, p: '#f0ece0', b: '#7a4aa0', t: '#a07ad0' }, rows: [
    '.dddddddddddddd.', 'dwwwwwwwwwwwwwwd', 'dwddddddddddddwd', 'dwwwwwwwwwwwwwwd', 'dppppppppppppppd', 'dppppppppppppppd', 'dppppppppppppppd',
    'dbbbbbbbbbbbbbbd', 'dttttttttttttttd', 'dbbbbbbbbbbbbbbd', 'dbbbbbtbbbtbbbbd', 'dbbbbbbbbbbbbbbd', 'dbbbbbbbbbbbbbbd', 'dbbtbbbbbbbbtbbd', 'dbbbbbbbbbbbbbbd',
    'dbbbbbbbbbbbbbbd', 'dbbbbbbtbbbbbbbd', 'dbbbbbbbbbbbbbbd', 'dbbbbbbbbbbbbbbd', 'dbbtbbbbbbbbtbbd', 'dbbbbbbbbbbbbbbd', 'dttttttttttttttd', 'dwwwwwwwwwwwwwwd', 'dd............dd'] },
  chest: { mats: { w: WOOD, d: DARK, m: '#c8a040' }, rows: [
    '..dddddddddddd..', '.dwwwwwwwwwwwwd.', 'dwwwwwwwwwwwwwwd', 'dmmmmmmmmmmmmmmd', 'dwwwwwwmmwwwwwwd', 'dwwwwwwmmwwwwwwd', 'dwwwwwwwwwwwwwwd', 'dmmmmmmmmmmmmmmd', 'dddddddddddddddd'] },
  table: { mats: { w: '#9a6a3e', d: DARK, c: '#e8e0d0', r: '#b04a4a' }, rows: [
    '.cccccccccccccccccccccccccccccc.', 'cccccccccccccrrcccccccccccccccc', 'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww', 'dddddddddddddddddddddddddddddddd',
    '.dd..........................dd.', '.dd..........................dd.', '.dd..........................dd.', '.dd..........................dd.', '.dd..........................dd.', '.dd..........................dd.'] },
  chair: { mats: { w: WOOD, d: DARK, s: '#c8a060' }, rows: [
    '..dddddddddd..', '..dwwwwwwwwd..', '..dwsswsswsd..', '..dwsswsswsd..', '..dwwwwwwwwd..', '..dssssssssd..', '.dssssssssssd.', '.dwwwwwwwwwwd.', '.dd........dd.', '.dd........dd.', '.dd........dd.'] },
  bookshelf: { mats: { w: WOOD, d: DARK, r: '#a63a3a', g: '#3a7a4a', b: '#3a5a95', y: '#c8a040', p: '#7a4aa0' }, rows: [
    'dddddddddddddddd', 'dwwwwwwwwwwwwwwd', 'dwrgbbyrppgrbywd', 'dwrgbbyrppgrbywd', 'dwrgbbyrppgrbywd', 'dwwwwwwwwwwwwwwd', 'dwpyrgbbrgyppbwd', 'dwpyrgbbrgyppbwd', 'dwpyrgbbrgyppbwd',
    'dwwwwwwwwwwwwwwd', 'dwgbbryy.yrgbbwd', 'dwgbbryy..rgbbwd', 'dwgbbryy...gbbwd', 'dwwwwwwwwwwwwwwd', 'dwwwwwwwwwwwwwwd', 'dddddddddddddddd'] },
  plant: { mats: { g: '#3a8a3a', p: '#b06a3a', d: '#7a4224' }, rows: [
    '....g..g....', '..g.gg.g.g..', '...ggggggg..', '.gggg.ggggg.', 'g.ggggggg.g.', '..ggggggggg.', '.g.ggg.ggg..', '...ppppppp..', '...pdddddp..', '....ppppp...', '....ppppp...'] },
  lamp: { mats: { m: '#5a5a6a', g: '#7aff9a' }, flat: { y: '#e8ffe8' }, rows: [
    '...mmmm...', '..mggggm..', '..mgyygm..', '..mggggm..', '...mmmm...', '....mm....', '....mm....', '....mm....', '....mm....', '....mm....', '...mmmm...', '..mmmmmm..'] },
  candles: { mats: { c: '#f0e8d0', d: '#8a7a6a' }, flat: { f: '#ffd166', o: '#ff8a3a' }, rows: [
    '..f....f....', '..o..f.o....', '..c..o.c..f.', '..c..c.c..o.', '.cc..c.cc.c.', '.cc.cc.cc.c.', 'dddddddddddd'] },
  fireplace: { mats: { s: '#8a8478', d: '#4a4640', k: '#2a2420', w: WOOD }, flat: { f: '#ffd166', o: '#ff7a2a', r: '#e0484f' }, rows: [
    'dddddddddddddddddddddddddddddddd', 'dssssssssssssssssssssssssssssssd', 'dsdssdssdssdssdssdssdssdssdssdsd', 'dssssssssssssssssssssssssssssssd', 'dssssskkkkkkkkkkkkkkkkkkkkksssssd'.slice(0, 32),
    'dssssk....................ksssss'.slice(0, 32), 'dsssk......f.......f.......ksssd'.slice(0, 32), 'dsssk.....fof.....fof......ksssd'.slice(0, 32), 'dsssk.....oro....fooof.....ksssd'.slice(0, 32),
    'dsssk....forof...forof.....ksssd'.slice(0, 32), 'dsssk...wwwwwwwwwwwwwww....ksssd'.slice(0, 32), 'dsssk..wwwwwwwwwwwwwwwww...ksssd'.slice(0, 32), 'dssssddddddddddddddddddddddsssssd'.slice(0, 32), 'dddddddddddddddddddddddddddddddd'] },
  clock: { mats: { w: '#6a3e22', d: '#3a2010', f: '#e8e0c8', m: '#c8a040' }, rows: [
    '..dddddddd..', '.dwwwwwwwwd.', '.dwffffffwd.', '.dwfmffmfwd.', '.dwffmmffwd.', '.dwffffffwd.', '.dwwwwwwwwd.', '.dwddddddwd.', '.dwd.mm.dwd.', '.dwd.mm.dwd.', '.dwd.mm.dwd.', '.dwddmmddwd.', '.dwwwwwwwwd.', '.dwwwwwwwwd.', 'dddddddddddd'] },
  petbed: { mats: { c: '#a63a5a', p: '#f0b0c8', d: '#6a2038' }, rows: [
    '..dddddddddddd..', '.dccccccccccccd.', 'dccppppppppppccd', 'dcppppppppppppcd', 'dccppppppppppccd', '.dccccccccccccd.', '..dddddddddddd..'] },
  dresser: { mats: { w: '#9a6a3e', d: DARK, m: '#c8a040' }, rows: [
    'dddddddddddddddddddddddddddddd', 'dwwwwwwwwwwwwwwwwwwwwwwwwwwwwd', 'dwddddddddddwwddddddddddddwd'.padEnd(30, 'd'), 'dwwwwwmmwwwwwwwwwwwwwmmwwwwwwd', 'dwddddddddddddddddddddddddddwd', 'dwwwwwmmwwwwwwwwwwwwwmmwwwwwwd', 'dwddddddddddddddddddddddddddwd', 'dwwwwwmmwwwwwwwwwwwwwmmwwwwwwd', 'dddddddddddddddddddddddddddddd', '.dd........................dd.'] },
  painting: { mats: { f: '#c8a040', d: '#6a4a1a', s: '#2a3a6a', m: '#f2e6b8', g: '#3a6a3a' }, rows: [
    'dddddddddddddd', 'dffffffffffffd', 'dfssssssssmsfd', 'dfsssssssmmmfd', 'dfssssssssmsfd', 'dfsssgsssssssd'.slice(0, 13) + 'd', 'dfssgggsssggfd', 'dfsgggggsggggd'.slice(0, 13) + 'd', 'dfggggggggggfd', 'dffffffffffffd', 'dddddddddddddd'] },
  wreath: { mats: { g: '#4a8a3a', b: '#a63a3a', y: '#e0c060' }, rows: [
    '....gggggg....', '..ggygggbggg..', '.ggg......ggg.', '.gb........yg.', 'gg..........gg', 'gy..........bg', 'gg..........gg', '.gg........gg.', '.gyg......ggg.', '..gggbggygg...', '....gggggg....', '......bb......', '.....b..b.....'] },
  banner: { mats: { r: '#4a2a6a', d: '#2a1a3a', y: '#e0c060', w: WOOD }, rows: [
    'wwwwwwwwwwww', '.rrrrrrrrrr.', '.rrrrryrrrr.', '.rrrryyyrrr.', '.rrryyrrrrr.', '.rrryrrrrrr.', '.rrryyrrrrr.', '.rrrryyyrrr.', '.ryrrrrrryr.', '.rrrryrrrrr.', '.rrrrrrrrrr.', '.rrrrrrrrrr.', '.rrr.rr.rrr.', '.rr..rr..rr.', '.r...rr...r.'] },
};
const cache = new Map<string, HTMLCanvasElement>();
export function furnSprite(id: string): HTMLCanvasElement {
  const hit = cache.get(id); if (hit) return hit;
  let c: HTMLCanvasElement;
  if (id.startsWith('rug_')) c = rug(id); else { const a = ART[id]; c = shaded('furn:' + id, a.rows.map(r => r.padEnd(Math.max(...a.rows.map(x => x.length)), '.')), a.mats, { flat: a.flat }); }
  cache.set(id, c); return c;
}
function rug(id: string): HTMLCanvasElement {
  const moon = id === 'rug_moon'; const w = moon ? 48 : 32, h = 32; const c = mk(w, h), g = c.getContext('2d')!;
  const base = moon ? '#2a3a6a' : '#8a2a2a', border = moon ? '#c8a040' : '#e0c060', inner = moon ? '#3a4a80' : '#a63a3a';
  g.fillStyle = border; g.fillRect(1, 2, w - 2, h - 4); g.fillStyle = base; g.fillRect(3, 4, w - 6, h - 8); g.fillStyle = inner; g.fillRect(5, 6, w - 10, h - 12);
  for (let x = 2; x < w - 2; x += 3) { g.fillStyle = border; g.fillRect(x, 0, 1, 2); g.fillRect(x, h - 2, 1, 2); }
  if (moon) { g.fillStyle = '#f2e6b8'; g.beginPath(); g.arc(w / 2, h / 2, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = inner; g.beginPath(); g.arc(w / 2 + 3, h / 2 - 2, 6, 0, Math.PI * 2); g.fill(); for (const [x, y] of [[10, 9], [38, 22], [12, 22], [36, 9]]) { g.fillStyle = '#f2e6b8'; g.fillRect(x, y, 1, 1); } }
  else { g.fillStyle = border; for (let i = 0; i < 4; i++) g.fillRect(w / 2 - 1 - i, h / 2 - 4 + i * 2, 2 + i * 2, 1); g.fillRect(w / 2 - 4, h / 2 + 2, 8, 1); }
  return c;
}
