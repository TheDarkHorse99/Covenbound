import { shaded, scale2x } from './pix16';
import { FAM_ART, FAM_FLAT } from './familiars16';
import { ENEMY_ART } from './enemies16';
import { charSprite, broomRider16, Look, Dir } from './chars16';
import { ENEMIES } from '../data/enemies';
import { ING, CROP, POTION } from '../data/brewing';
import { ELEMENT_INFO, Element } from '../data/familiars';
export type { Look, Dir } from './chars16';
export { charSprite, broomRider16 };

// ---------- familiars & enemies ----------
export function famSprite(sp: string, stage: number, scale = 1): HTMLCanvasElement {
  const a = FAM_ART[sp][Math.max(0, Math.min(2, stage - 1))];
  return shaded(`fam:${sp}:${stage}`, pad(a.rows), a.mats, { flat: FAM_FLAT }, scale);
}
export function enemySprite(id: string, dir: Dir = 'down', frame = 0): HTMLCanvasElement {
  const d = ENEMIES[id];
  if (d.look) { return charSprite(d.look, dir, frame, d.scale === 2 ? 2 : 1); }
  const a = ENEMY_ART[d.art!]; const c = shaded(`en:${d.art}`, pad(a.rows), a.mats, { flat: a.flat });
  return d.scale === 2 ? scale2x(c) : c;
}
export function enemyFacesLeft(id: string): boolean { const d = ENEMIES[id]; return !!(d.art && ENEMY_ART[d.art].faceLeft); }
export function witchPortrait(look: Look): HTMLCanvasElement { return charSprite(look, 'down', 0); }
function pad(rows: string[]): string[] { const w = Math.max(...rows.map(r => r.length)); return rows.map(r => r.padEnd(w, '.')); }

// ---------- icons (8×8 grids, shaded and Scale2x-smoothed to 20×20) ----------
export const ICON_SHAPES: Record<string, string[]> = {
  root: ['...bb...', '..b..b..', '...aa...', '..aaaa..', '..aaaa..', '...aa...', '...a....', '....a...'],
  petal: ['..a..a..', '.aaaaaa.', '..abba..', '.aabbaa.', '..abba..', '.aaaaaa.', '..a..a..', '........'],
  leaf: ['......a.', '....aaa.', '...aaba.', '..aabaa.', '.aabaa..', '.abaa...', 'b.aa....', 'b.......'],
  thistle: ['..a.a.a.', '...aaa..', '..aaaaa.', '...aaa..', '....b...', '...bb...', '....b...', '....b...'],
  berry: ['....bb..', '...b....', '.aa.aa..', 'aaaaaaa.', 'aaa.aaa.', '.a...a..', '........', '........'],
  mushroom: ['..aaaa..', '.aaaaaa.', 'aaaaaaaa', '..bbbb..', '...bb...', '...bb...', '..bbbb..', '........'],
  flower: ['...b....', '...bb...', '..aaa...', '.aaaaa..', '.a.a.a..', '...b....', '..bb....', '...b....'],
  fern: ['...a....', '..aaa...', '.a.a.a..', '..aaa...', '.a.a.a..', '..aaa...', '...b....', '...b....'],
  moss: ['........', '........', '..a.a...', '.aabaa..', 'aaaaaaa.', 'aaaaaaa.', 'bbbbbbb.', '........'],
  star: ['...a....', '...a....', 'aaabaaa.', '.abbba..', '..aba...', '.aa.aa..', 'a.....a.', '........'],
  gel: ['........', '..aaa...', '.aaaaa..', 'aaaaaaa.', 'aabaaaa.', 'aaaaaaa.', '.aaaaa..', '........'],
  quill: ['......a.', '.....aa.', '....aa..', '...ba...', '..ba....', '.ba.....', 'b.......', '........'],
  sap: ['...a....', '...a....', '..aaa...', '.aaaaa..', '.aaaaa..', '.aaaaa..', '..aaa...', '........'],
  salt: ['........', '...a....', '..aaa...', '.aaaaa..', 'aabaaba.', 'aaaaaaa.', '........', '........'],
  spice: ['...bb...', '..b..b..', '..aaaa..', '.aaaaaa.', '.aabbaa.', '.aaaaaa.', '..aaaa..', '........'],
  down: ['........', '..a.a...', '.aaaaa..', 'aaaaaaa.', '.aaaaa..', '..aba...', '........', '........'],
  heart: ['........', '.aa.aa..', 'aaaaaaa.', 'aaaaaaa.', '.aaaaa..', '..aaa...', '...a....', '........'],
  potion: ['...cc...', '...gg...', '..g..g..', '.gaaaag.', '.gaaaag.', '.gaaaag.', '..gggg..', '........'],
  flaskthrow: ['...cc...', '...gg...', '...gg...', '..gaag..', '.gaaaag.', '.gaaaag.', '..gggg..', '........'],
  seed: ['.cccccc.', '.caaaac.', '.cabbac.', '.caaaac.', '.cbbbbc.', '.cccccc.', '........', '........'],
  hoe: ['........', '.aaa....', '..ab....', '...b....', '....b...', '.....b..', '......b.', '.......b'],
  can: ['........', '...aaa..', '..a...a.', 'aa.aaaa.', '.aaaaaaa', '.aaaaaa.', '.aaaaaa.', '........'],
  wand: ['.......y', '......yx', '.....bx.', '....b...', '...b....', '..b.....', '.b......', 'b.......'],
  staff: ['......yy', '.....yxy', '......y.', '.....b..', '....b...', '...b....', '..b.....', '.b......'],
  charmi: ['...cc...', '..c..c..', '...aa...', '..aaaa..', '.aabbaa.', '..aaaa..', '...aa...', '........'],
  essence: ['...a....', '..aaa...', '.aabaa..', 'aabbbaa.', '.aabaa..', '..aaa...', '...a....', '........'],
  hat: ['....a...', '...aa...', '...aa...', '..aaaa..', '..bbbb..', 'aaaaaaaa', '........', '........'],
  robe: ['..a..a..', '.aaaaaa.', 'aaaaaaaa', 'a.aaaa.a', '..aaaa..', '..abba..', '.aaaaaa.', '........'],
  boots: ['........', '..aa....', '..aa....', '..aa..aa', '..aaa.aa', '.aaaa.aa', '.bbbbaaa', '......bb'],
  broom: ['......aa', '.....a..', '....a...', '...a....', 'bba.....', 'bbb.....', 'bbb.....', '.b......'],
  lantern: ['...cc...', '..c..c..', '.cccccc.', '.caaaac.', '.cabbac.', '.caaaac.', '.cccccc.', '........'],
  rune: ['..aaaa..', '.a.b..a.', 'a..bb..a', 'a..b.b.a', 'a..b...a', 'a..b...a', '.a....a.', '..aaaa..'],
  sigil: ['...a....', '..a.a...', 'aaaaaaa.', '.aa.aa..', '.a.a.a..', 'a.a.a.a.', 'aa...aa.', '........'],
  circle: ['..aaaa..', '.a....a.', 'a..bb..a', 'a.b..b.a', 'a.b..b.a', 'a..bb..a', '.a....a.', '..aaaa..'],
  pin: ['.......a', '......a.', '.....a..', '....a...', '...a....', '..a.....', '.bb.....', '.bb.....'],
  poppet: ['..aaaa..', '.akaaka.', '..aaaa..', '...bb...', '.aaaaaa.', 'a.aaaa.a', '..a..a..', '.aa..aa.'],
  thread: ['a.......', '.a..a...', '..aa.a..', '..a...a.', '.a.a..a.', 'a...aa..', '...a..a.', '..a....a'],
  vine: ['......aa', '.....a.a', '....a...', '...ab...', '..a.....', '.ab.....', 'a.......', 'a.......'],
  flask: ['...cc...', '...gg...', '..gaag..', '.gaaaag.', '.gaaaag.', '.gaaaag.', '..gggg..', '........'],
  snap: ['..aaaa..', '.abbbba.', 'abkbbkba', 'awbwbwba', '.abbbba.', '...aa...', '...a....', '..a.....'],
  claw: ['a...a...', '.a...a..', '..a...a.', '..a...a.', '.a...a..', 'a...a...', '........', '........'],
  pounce: ['......aa', '.....aa.', '....aa..', 'a..aa...', '.aaa....', '..a.....', '.a.a....', '........'],
  beast: ['.a....a.', '.aa..aa.', '.aaaaaa.', 'aakaakaa', 'aaaaaaaa', '.aawwaa.', '..aaaa..', '........'],
  bone: ['aa......', 'aaa.....', '.aaa....', '..aaa...', '...aaa..', '....aaa.', '.....aaa', '......aa'],
  skull: ['..aaaa..', '.aaaaaa.', 'aakaakaa', 'aakaakaa', 'aaaaaaaa', '.aaaaaa.', '..a.a.a.', '........'],
  pulse: ['a..a..a.', '.a.a.a..', '..aaa...', 'aaabaaa.', '..aaa...', '.a.a.a..', 'a..a..a.', '........'],
  runestorm: ['a.....a.', '.a...a..', '..aba...', 'aaabaaa.', '..aba...', '.a...a..', 'a.....a.', '........'],
  ward: ['..aaaa..', '.abbbba.', 'abaaaaba', 'abaaaaba', 'abaaaaba', '.abaaba.', '..abba..', '...aa...'],
  seal: ['aaaaaaaa', 'a.b..b.a', 'a..bb..a', 'a.bbbb.a', 'a..bb..a', 'a.b..b.a', 'aaaaaaaa', '........'],
  needles: ['a..a..a.', 'a..a..a.', 'a..a..a.', 'a..a..a.', 'b..b..b.', '........', 'bbbbbbb.', '........'],
  strings: ['aaaaaaaa', '.a..a..a', '.a..a..a', '.a..a..a', '.b..b..b', '.b..b..b', 'bbb.bbb.', '........'],
  hexdoll: ['..aaaa..', '.akaaka.', '..aaaa..', 'b..bb..b', '.baaaab.', '..aaaa..', '..a..a..', '.bb..bb.'],
  thornring: ['a..a..a.', '.aaaaa..', 'aa...aa.', 'a..b..a.', 'aa...aa.', '.aaaaa..', 'a..a..a.', '........'],
  spore: ['..a..a..', '.aabbaa.', 'aabbbbaa', 'abbbbbba', 'aabbbbaa', '.aabbaa.', '..a..a..', '........'],
  surge: ['...a....', '..aaa...', '.aabaa..', 'aabbbaa.', '...b....', '...b....', '..bbb...', '........'],
  frenzy: ['a.a.a...', '.a.a.a..', '..a.a.a.', '...a.a.a', '..a.a.a.', '.a.a.a..', 'a.a.a...', '........'],
  roar: ['..aaaa..', '.a....a.', 'a.akka.a', 'a.awwa.a', 'a.aaaa.a', '.a....a.', '..aaaa..', '........'],
  leap: ['......a.', '....aaa.', '..aa..a.', '.a......', 'a..bbb..', '..bbbbb.', '.bbbbbbb', '........'],
  spear: ['.......a', '......aa', '.....aa.', '....aa..', '...aa...', '..aa....', '.bb.....', 'bb......'],
  corpse: ['a..a..a.', '.aaaaa..', 'aakaaka.', '.aaaaa..', '..a.a...', 'b.....b.', '.b...b..', '..bbb...'],
  siphon: ['a.....a.', '.a...a..', '..a.a...', '...b....', '..bbb...', '.bbbbb..', '..bbb...', '........'],
  dodge: ['......a.', '.....aa.', 'bb..aa..', '.bbaa...', '..aab...', '.aa..bb.', '.a....b.', '........'],
  swap: ['..aaa...', '.a...a.b', 'a.....bb', 'a....bbb', 'bbb....a', 'bb.....a', 'b.a...a.', '...aaa..'],
  flamedash: ['......aa', '....aaab', '..aaabb.', 'aaabb...', '..aaabb.', '....aaab', '......aa', '........'],
  swarm: ['.a....a.', 'aba..aba', '.a....a.', '...a....', '..aba...', '...a....', '........', '........'],
  bubble: ['..aaaa..', '.a....a.', 'a.bb...a', 'a.b....a', 'a......a', 'a......a', '.a....a.', '..aaaa..'],
  lash: ['a.......', 'aa......', '.aa.....', '..aaa...', '....aaa.', '......ab', '.......b', '........'],
  bastion: ['.aaaaaa.', 'aabbbbaa', 'abaaaaba', 'abaaaaba', 'abaaaaba', 'aabbbbaa', '.aaaaaa.', '........'],
  burrow: ['........', '...a....', '..aaa...', '.a.a.a..', '...a....', 'bbbbbbbb', 'b.b.b.b.', '........'],
  dive: ['a.......', '.a......', '..aa....', '...aaa..', '....aaab', '.....bbb', '......bb', '........'],
  screech: ['a..a..a.', '.a.a.a..', '........', 'aaabaaa.', '........', '.a.a.a..', 'a..a..a.', '........'],
  phase: ['a.a.....', '.a.a....', 'a.a.a...', '...aaa..', '....aaab', '.....bbb', '......b.', '........'],
  lanterni: ['...bb...', '..aaaa..', '.abbbba.', '.abwwba.', '.abbbba.', '..aaaa..', '...aa...', '........'],
  bag: ['..aaaa..', '.a....a.', 'aaaaaaaa', 'abbbbbba', 'abbaabba', 'abbbbbba', 'aaaaaaaa', '........'],
  egg: ['...aa...', '..aaaa..', '.aaaaaa.', '.abaaba.', 'aaaaaaaa', 'aabaaaba', '.aaaaaa.', '..aaaa..'],
  house: ['...a....', '..aaa...', '.aaaaa..', 'aaaaaaa.', '.bbbbb..', '.bccbb..', '.bccbb..', '........'],
};
const ICON_FLAT = { k: '#160c1c', w: '#ffffff' };
export function icon(name: string, a: string, b: string, big = true, extra: Record<string, string> = {}): HTMLCanvasElement {
  const mats: Record<string, string> = { a, b, c: '#e9dfc7', g: '#cfe0f0', x: '#ffffff', y: '#f2c14e', r: '#e0484f', ...extra };
  const c = shaded(`ic:${name}:${a}:${b}:${JSON.stringify(extra)}`, ICON_SHAPES[name] || ICON_SHAPES.bag, mats, { flat: ICON_FLAT });
  return big ? scale2x(c) : c;
}
export function itemIcon(id: string, big = true): HTMLCanvasElement {
  if (ING[id]) { const d = ING[id]; return icon(d.icon, d.a, d.b, big); }
  if (id.startsWith('seed_')) { const c = CROP[id.slice(5)]; return icon('seed', c.fruit, c.leaf, big); }
  if (id.startsWith('p_')) { const p = POTION[id.slice(2)]; return icon(p.use === 'throw' ? 'flaskthrow' : 'potion', p.col, '#ffffff', big, { c: '#a07a50' }); }
  if (id.startsWith('ess_')) { const el = ELEMENT_INFO[id.slice(4) as Element]; return icon('essence', el ? el.col : '#fff', el ? el.light : '#fff', big); }
  switch (id) {
    case 'hoe': return icon('hoe', '#a0a0b0', '#8a6440', big);
    case 'can': return icon('can', '#5a8ab0', '#a6e4ff', big);
    case 'wand': return icon('wand', '#f2c14e', '#a07a50', big);
    case 'charm': return icon('charmi', '#c8a060', '#8a6a40', big, { c: '#a07a50' });
    case 'charm2': return icon('charmi', '#d8dce8', '#8a90a8', big, { c: '#a07a50' });
    case 'charm3': return icon('charmi', '#bcd4ff', '#b06aff', big, { c: '#f2c14e' });
  }
  return icon('bag', '#a294bd', '#2a1f43', big);
}

// ---------- crops ----------
const SPROUT = ['..........', '..........', '..........', '..........', '..........', '..........', '...l..l...', '....ll....', '....l.....', '....l.....'];
const YOUNG = ['..........', '..........', '..........', '..l....l..', '..ll..ll..', '...llll...', '.l..ll..l.', '.ll.l..ll.', '..lll.ll..', '....ll....'];
const MATURE: Record<string, string[]> = {
  root: ['..........', '..l....l..', '.lll..lll.', '..llllll..', '...llll...', '..l.ll.l..', '...ffff...', '..ffffff..', '...ffff...', '....ff....'],
  flower: ['...ffff...', '..ffgff...', '..fffff...', '...ff.....', '....l.ff..', '..l.lfgff.', '..lll.ff..', '...ll.l...', '....lll...', '....l.....'],
  leaf: ['..........', '.f..l..f..', '.ff.l.ff..', '..fflff...', '..flllf...', '.ffflfff..', '..fflff...', '...lll....', '....l.....', '....l.....'],
  thistle: ['..f.f.f...', '...fff....', '..ffgff...', '...fff....', '....l.....', '..l.l.l...', '...lll....', '..l.l.l...', '....l.....', '....l.....'],
  berry: ['..........', '..llllll..', '.llfllfll.', '.lfgllllf.', '.llllfgll.', '.lfllllll.', '..llfgll..', '...llll...', '....ll....', '....l.....'],
};
const CROP_SHAPE: Record<string, string> = { mandrake: 'root', sunroot: 'root', moonpetal: 'flower', bitterleaf: 'leaf', ironthistle: 'thistle', sweetbriar: 'berry' };
export function cropSprite(crop: string, stage: number): HTMLCanvasElement {
  const c = CROP[crop];
  if (stage <= 0) return shaded('crop:seed', ['..........', '..........', '...k..k...', '....kk....'], { k: '#5a3a20' }, { outline: false });
  const rows = stage === 1 ? SPROUT : stage === 2 ? YOUNG : MATURE[CROP_SHAPE[crop]];
  return shaded(`crop:${crop}:${stage}`, rows, { l: c.leaf, f: c.fruit }, { flat: { g: '#ffffff' } });
}

// ---------- misc world sprites ----------
export const MISC: Record<string, string[]> = {
  thrall: ['...bbbb...', '..bkbbkb..', '..bbbbbb..', '...b..b...', '....bb....', '..bbbbbb..', '.b.bbbb.b.', '...bbbb...', '....bb....', '...b..b...', '...b..b...', '..bb..bb..'],
  poppet: ['...yyyy...', '..ykyyky..', '..yyyyyy..', '...yrry...', '..yyyyyy..', '.yyyyyyyy.', 'y.yyyyyy.y', '..yyyyyy..', '..yy..yy..', '..yy..yy..', '.yy....yy.'],
  snapvine: ['...gggg...', '..gGGGGg..', '.gGkGGkGg.', '.gGGGGGGg.', '.gwGwGwGg.', '..gGGGGg..', '....gg....', '...gg.....', '....g.....', '..gg.gg...', '.gg...gg..', 'gg.....gg.'],
  egg: ['....aa....', '...abaa...', '..aaaaaa..', '..abaaba..', '.aaaaaaaa.', '.aabaaaba.', '.aaaaaaaa.', '..aaaaaa..', '...aaaa...'],
  lanternw: ['...yy...', '..mmmm..', '.mgggm..'.padEnd(8, '.'), '.mgwgm..'.padEnd(8, '.'), '.mgggm..'.padEnd(8, '.'), '..mmmm..', '...mm...', '...mm...', '..mmmm..'],
  waystone: ['...ss...', '..ssss..', '..sxss..', '..ssss..', '..sxxs..', '..ssss..', '.ssssss.', 'ssssssss'],
  pip: [],
};
export function miscSprite(name: string, pal: Record<string, string>): HTMLCanvasElement {
  const flat: Record<string, string> = { k: '#160c1c', w: '#ffffff' };
  return shaded(`misc:${name}:${JSON.stringify(pal)}`, pad(MISC[name]), pal, { flat });
}
export function elCol(el?: Element) { return el ? ELEMENT_INFO[el].col : '#e9dfc7'; }
