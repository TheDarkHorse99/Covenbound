import { sprite, merge, mk, OUTLINE } from './pixel';
import { SPECIES } from '../data/familiars';
import { ENEMIES } from '../data/enemies';
import { ING, CROP, POTION } from '../data/brewing';
import { shade } from '../core/util';
import type { HatStyle } from '../data/gear';

// ---------- creature shapes (12x12) ----------
export const SHAPES: Record<string, string[]> = {
  fox: ["............", ".a........a.", ".aa......aa.", ".aba....aba.", ".aaaaaaaaaa.", ".aakaaaakaa.", "..abbccbba..", "...bbbbbb...", "..aaaaaaaa..", "..aaaaaaaa.b", "..aaaaaaaabb", "..cc....cc.."],
  moth: ["............", "...c....c...", "....c..c....", "bb..aaaa..bb", "bba.kaak.abb", "bbbaaaaaabbb", "bbbbaaaabbbb", ".bbbaaaabbb.", "..bbcaacbb..", "...b.aa.b...", ".....aa.....", "............"],
  frog: ["............", "............", "..aa....aa..", ".aeka..akea.", ".aaaaaaaaaa.", "aaaaaaaaaaaa", "aaccccccccaa", "aabbbbbbbbaa", ".abbbbbbbba.", "..aaaaaaaa..", ".aa.a..a.aa.", "............"],
  jelly: ["............", "....aaaa....", "..aabbbbaa..", ".abbbbbbbba.", ".abkbbbbkba.", ".abbbbbbbba.", ".aaaaaaaaaa.", "..b.b..b.b..", "..a.b..b.a..", "...a.bb.a...", "..a..b..a...", "...a.b.a...."],
  turtle: ["............", "............", "...bbbbbb...", "..bbabbabb..", ".bbaaabaaab.", ".bbbbbbbbbaa", ".bbbbbbbbbka", ".ccccccccaa.", "..aa....aa..", "..aa....aa..", "............", "............"],
  mole: ["............", "............", "...aaaaaa...", "..aaaaaaaa..", ".aakaaaakaa.", ".aaaabbaaaa.", ".aaabbbbaaa.", ".aaaaaaaaaa.", "bbaaaaaaaabb", "bb.aaaaaa.bb", "...cc..cc...", "............"],
  owl: ["............", "..a......a..", "..aa....aa..", "..aaaaaaaa..", ".abbbaabbba.", ".abkbaabkba.", ".abbbccbbba.", ".aaaaccaaaa.", ".aabbbbbbaa.", "..abbbbbba..", "...aaaaaa...", "...cc..cc..."],
  bat: ["............", "....a..a....", "....aaaa....", "a...abba...a", "aa..aaaa..aa", "aaa.acca.aaa", "aaaaaaaaaaaa", "aaa.aaaa.aaa", "a.a..aa..a.a", ".....aa.....", "............", "............"],
  slime: ["............", "............", "............", "....aaaa....", "...abbada...", "..abbaaaaa..", ".aaakaakada.", ".adaaaaaaaa.", "aaaaaccaaada", "aaaaaaaaaaaa", ".cccccccccc.", "............"],
  rat: ["............", "............", "............", "..aa..b..b..", ".abaabbbbb..", "kaaaaaaaaab.", "aaaaaaaaaaa.", ".aaaaaaaaaaa", "..a.a..a.a.c", "..c.c..c.c..", "............", "............"],
  stump: ["...bb..bb...", "..bbbbbbbb..", "...aaaaaa...", "..aaaaaaaa..", "..akkaakka..", "..aaaaaaaa..", "..acccccca..", "..aaaaaaaa..", ".aaaaaaaaaa.", "aa.aa..aa.aa", "a...a..a...a", "............"],
  crow: ["............", "............", "....aaa.....", "...aaaaa....", "..bakaaa....", ".bbaaaaaa...", "...aaaaaaaa.", "..aaaaaaaaaa", "..aaaaaaa.a.", "....c..c....", "...cc.cc....", "............"],
};
const STAGE_OVER = [null,
  ["......x.....", ".....xx.....", "............", "............", "............", "............", "............", ".....yy.....", "............", "............", "............", "............"],
  ["...y.yy.y...", "...yyyyyy...", "............", "............", "............", "............", "............", "....xyyx....", "............", "............", "............", "............"]];
export const LEFT_FACING = new Set(['rat', 'crow']);

export function famSprite(sp: string, stage: number, scale = 1): HTMLCanvasElement {
  const f = SPECIES[sp]; const el = { ember: ['#f07a3a', '#ffd166'], tide: ['#3fa7d6', '#a6e4ff'], stone: ['#c09a60', '#ead2a2'], gale: ['#7fd1a0', '#d6ffe6'] }[f.el];
  let rows = SHAPES[f.shape]; if (stage > 1) rows = merge(rows, STAGE_OVER[stage - 1]!);
  const pal: Record<string, string> = { ...f.pal, k: '#120a18', e: '#ffffff', x: el[0], y: el[1] };
  if (stage === 3) pal.b = shade(el[1], 0.1);
  if (stage === 2) pal.a = shade(f.pal.a, 0.08);
  return sprite(`fam:${sp}:${stage}`, rows, pal, scale);
}

// ---------- humans ----------
const HUMAN = ["..............", "..............", ".....HHHH.....", "....HHHHHH....", "...HHHHHHHH...", "...HHSSSSHH...", "...HSSkSSkH...", "...HSSSSSSH...", "....HTTTTH....", "...TTTTTTTT...", "..TTTWTTWTTT..", "..STTTTTTTTS..", "...TTWWWWTT...", "...TTTTTTTT...", "...LLL..LLL...", "...LLL..LLL...", "..bbb....bbb.."];
const SHIELD = ["..............", "..............", "..............", "..............", "..............", "..............", "..............", "..............", "..........ww..", ".........wWWw.", ".........wWyW.", ".........wWWw.", ".........wWWw.", "..........ww..", "..............", "..............", ".............."];
export function enemySprite(id: string, scale = 1): HTMLCanvasElement {
  const d = ENEMIES[id];
  if (d.sprite === 'human') {
    let rows = HUMAN; const pal: Record<string, string> = { k: '#120a18', b: '#2a1d14', ...d.pal, w: '#8a8aa0', y: '#f2c14e' };
    if (id === 'warden') rows = merge(HUMAN, SHIELD);
    return sprite(`en:${id}`, rows, pal, scale);
  }
  const pal: Record<string, string> = { k: '#120a18', e: '#ffffff', d: d.pal.a, ...d.pal };
  return sprite(`en:${id}`, SHAPES[d.sprite], pal, scale);
}

// ---------- witch ----------
const BODY = ["....hSSSSh....", "...hhSSkSk....", "...hhSSSSh....", "...hhRRRR.....", "....RRRRRR....", "...RRrRRrRR...", "...RRRRRRRR...", "..RRRRRRRRRR..", "..rrrrrrrrrr.."];
const LEGS = ["....bb..bb....", "...bb....bb..."];
export const HATS: Record<HatStyle, string[]> = {
  pointed: ["........HH....", ".......HHH....", "......HHHH....", ".....HHHHH....", "....HHHHHH....", "....HBBBBH....", "..HHHHHHHHHH.."],
  crooked: [".........HH...", "........HH....", "......HHH.....", ".....HHHH.....", "....HHHHHH....", "....HBBBBH....", "..HHHHHHHHHH.."],
  wide: ["..............", "..............", ".....HHHH.....", "....HHHHHH....", "....HBBBBH....", ".HHHHHHHHHHHH.", "HHHHHHHHHHHHHH"],
  flower: ["..............", "..............", "..............", ".....hhhh.....", "....hhhhhh....", "...fhBhhfhB...", "...hhhhhhhh..."],
  spire: ["......B.......", ".....HH.......", ".....HHH......", "....HHHHH.....", "....HHHHHH....", "....HBBBBH....", "..HHHHHHHHHH.."],
};
export interface Look { hat: HatStyle; hatCol: string; band: string; hair: string; skin: string; robe: string }
export function witchSprite(look: Look, frame: number, scale = 1): HTMLCanvasElement {
  const rows = HATS[look.hat].concat(BODY, [LEGS[frame]]);
  const pal = { H: look.hatCol, B: look.band, f: '#f08ac0', h: look.hair, S: look.skin, k: '#120a18', R: look.robe, r: shade(look.robe, -0.35), b: '#2a1d14' };
  return sprite(`w:${look.hat}:${look.hatCol}:${look.band}:${look.hair}:${look.skin}:${look.robe}:${frame}`, rows, pal, scale);
}
/** Witch seated sideways on a broom (no legs), broom drawn beneath. */
export function broomRider(look: Look, handle: string, bristle: string, lantern: string | null, frame: number): HTMLCanvasElement {
  const key = `broom:${look.hat}:${look.hatCol}:${look.band}:${look.hair}:${look.skin}:${look.robe}:${handle}:${bristle}:${lantern}:${frame}`;
  const hit = riderCache.get(key); if (hit) return hit;
  const w = witchSprite(look, 0); const c = mk(30, w.height + 4); const g = c.getContext('2d')!;
  g.drawImage(w, 8, 0, w.width, w.height - 3, 8, 0, w.width, w.height - 3);
  const y = w.height - 3;
  g.fillStyle = OUTLINE; g.fillRect(1, y - 1, 28, 4);
  g.fillStyle = handle; g.fillRect(7, y, 22, 2);
  g.fillStyle = shade(handle, 0.25); g.fillRect(7, y, 22, 1);
  g.fillStyle = OUTLINE; g.fillRect(0, y - 3, 9, 8);
  g.fillStyle = bristle; g.fillRect(1, y - 2, 7, 6);
  g.fillStyle = shade(bristle, -0.3); for (let i = 0; i < 3; i++) g.fillRect(1 + (i * 2 + frame) % 7, y - 2 + i * 2, 3, 1);
  if (lantern) { g.fillStyle = OUTLINE; g.fillRect(25, y + 1, 5, 6); g.fillStyle = lantern; g.fillRect(26, y + 2, 3, 4); g.fillStyle = '#ffffff'; g.fillRect(27, y + 3, 1, 1); }
  riderCache.set(key, c); return c;
}
const riderCache = new Map<string, HTMLCanvasElement>();

// ---------- icons (8x8) ----------
export const ICON_SHAPES: Record<string, string[]> = {
  root: ["...bb...", "..b..b..", "...aa...", "..aaaa..", "..abaa..", "...aa...", "...a....", "....a..."],
  petal: ["..a..a..", ".aaaaaa.", "..abba..", ".aabbaa.", "..abba..", ".aaaaaa.", "..a..a..", "........"],
  leaf: ["......a.", "....aaa.", "...aaba.", "..aabaa.", ".aabaa..", ".abaa...", "b.aa....", "b......."],
  thistle: ["..a.a.a.", "...aaa..", "..aabaa.", "...aaa..", "....b...", "...bb...", "....b...", "....b..."],
  berry: ["....bb..", "...b....", ".aa.aa..", "aaaaaaa.", "aba.aba.", ".a...a..", "........", "........"],
  mushroom: ["..aaaa..", ".abaaba.", "aaaaaaaa", "..bbbb..", "...bb...", "...bb...", "..bbbb..", "........"],
  flower: ["...b....", "...bb...", "..aaa...", ".aaaaa..", ".a.a.a..", "...b....", "..bb....", "...b...."],
  fern: ["...a....", "..aaa...", ".a.a.a..", "..aaa...", ".a.a.a..", "..aaa...", "...b....", "...b...."],
  moss: ["........", "........", "..a.a...", ".aabaa..", "aaaaaaa.", "abaaaba.", "bbbbbbb.", "........"],
  star: ["...a....", "...a....", "aaabaaa.", ".abbba..", "..aba...", ".aa.aa..", "a.....a.", "........"],
  gel: ["........", "..aaa...", ".abaaa..", "aaaaaaa.", "aabaaaa.", "aaaaaaa.", ".aaaaa..", "........"],
  quill: ["......a.", ".....aa.", "....aa..", "...ba...", "..ba....", ".ba.....", "b.......", "........"],
  sap: ["...a....", "...a....", "..aaa...", ".aabaa..", ".aaaba..", ".aaaaa..", "..aaa...", "........"],
  salt: ["........", "...a....", "..aba...", ".aaaaa..", "aabaaba.", "aaaaaaa.", "........", "........"],
  spice: ["...bb...", "..b..b..", "..aaaa..", ".aaaaaa.", ".aabbaa.", ".aaaaaa.", "..aaaa..", "........"],
  down: ["........", "..a.a...", ".aaaaa..", "aaabaaa.", ".aaaaa..", "..aba...", "........", "........"],
  heart: ["........", ".aa.aa..", "aaaaaaa.", "aabaaaa.", ".aaaaa..", "..aaa...", "...a....", "........"],
  potion: ["...cc...", "...gg...", "..g..g..", ".gaaaag.", ".gabaag.", ".gaaaag.", "..gggg..", "........"],
  flaskthrow: ["...cc...", "...gg...", "...gg...", "..gaag..", ".gaabag.", ".gaaaag.", "..gggg..", "........"],
  seed: [".cccccc.", ".caaaac.", ".cabbac.", ".caaaac.", ".cbbbbc.", ".cccccc.", "........", "........"],
  hoe: ["........", ".aaa....", "..ab....", "...b....", "....b...", ".....b..", "......b.", ".......b"],
  can: ["........", "...aaa..", "..a...a.", "aa.aaaa.", ".aaaaaaa", ".aabaaa.", ".aaaaaa.", "........"],
  wand: [".......y", "......yx", ".....bx.", "....b...", "...b....", "..b.....", ".b......", "b......."],
  staff: ["......yy", ".....yxy", "......y.", ".....b..", "....b...", "...b....", "..b.....", ".b......"],
  charmi: ["...cc...", "..c..c..", "...aa...", "..aaaa..", ".aabbaa.", "..aaaa..", "...aa...", "........"],
  essence: ["...a....", "..aba...", ".abbba..", "aabbbaa.", ".abbba..", "..aba...", "...a....", "........"],
  hat: ["....a...", "...aa...", "...aa...", "..aaaa..", "..abba..", "aaaaaaaa", "........", "........"],
  robe: ["..a..a..", ".aaaaaa.", "aaaaaaaa", "a.aaaa.a", "..aaaa..", "..abba..", ".aaaaaa.", "........"],
  boots: ["........", "..aa....", "..aa....", "..aa..aa", "..aaa.aa", ".aaaa.aa", ".bbbbaaa", "......bb"],
  broom: ["......aa", ".....a..", "....a...", "...a....", "bba.....", "bbb.....", "bbb.....", ".b......"],
  lantern: ["...cc...", "..c..c..", ".cccccc.", ".caaaac.", ".cabbac.", ".caaaac.", ".cccccc.", "........"],
  // skills
  rune: ["..aaaa..", ".a.b..a.", "a..bb..a", "a..b.b.a", "a..b...a", "a..b...a", ".a....a.", "..aaaa.."],
  sigil: ["...a....", "..a.a...", "aaaaaaa.", ".aa.aa..", ".a.a.a..", "a.a.a.a.", "aa...aa.", "........"],
  circle: ["..aaaa..", ".a....a.", "a..bb..a", "a.b..b.a", "a.b..b.a", "a..bb..a", ".a....a.", "..aaaa.."],
  pin: [".......a", "......a.", ".....a..", "....a...", "...a....", "..a.....", ".bb.....", ".bb....."],
  poppet: ["..aaaa..", ".abaaba.", "..aaaa..", "...cc...", ".aaaaaa.", "a.aaaa.a", "..a..a..", ".aa..aa."],
  thread: ["a.......", ".a..a...", "..aa.a..", "..a...a.", ".a.a..a.", "a...aa..", "...a..a.", "..a....a"],
  vine: ["......aa", ".....a.a", "....a...", "...ab...", "..a.....", ".ab.....", "a.......", "a......."],
  flask: ["...cc...", "...gg...", "..gaag..", ".gaaaag.", ".gabaag.", ".gaaaag.", "..gggg..", "........"],
  snap: ["..aaaa..", ".abbbba.", "abkbbkba", "awbwbwba", ".abbbba.", "...aa...", "...a....", "..a....."],
  claw: ["a...a...", ".a...a..", "..a...a.", "..a...a.", ".a...a..", "a...a...", "........", "........"],
  pounce: ["......aa", ".....aa.", "....aa..", "a..aa...", ".aaa....", "..a.....", ".a.a....", "........"],
  beast: [".a....a.", ".aa..aa.", ".aaaaaa.", "aakaakaa", "aaaaaaaa", ".aawwaa.", "..aaaa..", "........"],
  bone: ["aa......", "aaa.....", ".aaa....", "..aaa...", "...aaa..", "....aaa.", ".....aaa", "......aa"],
  skull: ["..aaaa..", ".aaaaaa.", "aakaakaa", "aakaakaa", "aaaaaaaa", ".aaaaaa.", "..a.a.a.", "........"],
  pulse: ["a..a..a.", ".a.a.a..", "..aaa...", "aaabaaa.", "..aaa...", ".a.a.a..", "a..a..a.", "........"],
  bag: ["..aaaa..", ".a....a.", "aaaaaaaa", "abbbbbba", "abbaabba", "abbbbbba", "aaaaaaaa", "........"],
  egg: ["...aa...", "..abaa..", ".aaaaaa.", ".abaaba.", "aaaaaaaa", "aabaaaba", ".aaaaaa.", "..aaaa.."],
  sleep: ["........", "aaaa....", "...a....", "..a..bb.", ".a....b.", "aaaa.b..", ".....bb.", "........"],
};
export function icon(name: string, a: string, b: string, scale = 3, extra: Record<string, string> = {}): HTMLCanvasElement {
  const pal: Record<string, string> = { a, b, c: '#e9dfc7', g: '#cfe0f0', x: '#ffffff', y: '#f2c14e', k: '#120a18', w: '#ffffff', ...extra };
  return sprite(`ic:${name}:${a}:${b}:${JSON.stringify(extra)}`, ICON_SHAPES[name], pal, scale);
}
export function itemIcon(id: string, scale = 3): HTMLCanvasElement {
  if (ING[id]) { const d = ING[id]; return icon(d.icon, d.a, d.b, scale); }
  if (id.startsWith('seed_')) { const c = CROP[id.slice(5)]; return icon('seed', c.fruit, c.leaf, scale); }
  if (id.startsWith('p_')) { const p = POTION[id.slice(2)]; const thr = p.use === 'throw'; return icon(thr ? 'flaskthrow' : 'potion', p.col, '#ffffff', scale, { c: '#a07a50' }); }
  if (id.startsWith('ess_')) { const col = { ember: '#f07a3a', tide: '#3fa7d6', stone: '#c09a60', gale: '#7fd1a0' }[id.slice(4)] || '#fff'; return icon('essence', col, '#ffffff', scale); }
  switch (id) {
    case 'hoe': return icon('hoe', '#a0a0b0', '#8a6440', scale);
    case 'can': return icon('can', '#5a8ab0', '#a6e4ff', scale);
    case 'wand': return icon('wand', '#f2c14e', '#a07a50', scale);
    case 'charm': return icon('charmi', '#f2c14e', '#b06aff', scale, { c: '#a07a50' });
  }
  return icon('bag', '#a294bd', '#2a1f43', scale);
}

// ---------- crops ----------
const SPROUT = ["..........", "..........", "..........", "..........", "..........", "..........", "...l..l...", "....ll....", "....l.....", "....l....."];
const YOUNG = ["..........", "..........", "..........", "..l....l..", "..ll..ll..", "...llll...", ".l..ll..l.", ".ll.l..ll.", "..lll.ll..", "....ll...."];
const MATURE: Record<string, string[]> = {
  root: ["..........", "..l....l..", ".lll..lll.", "..llllll..", "...llll...", "..l.ll.l..", "...ffff...", "..ffgfff..", "...ffff...", "....ff...."],
  flower: ["...ffff...", "..ffgff...", "..fffff...", "...ff.....", "....l.ff..", "..l.lfgff.", "..lll.ff..", "...ll.l...", "....lll...", "....l....."],
  leaf: ["..........", ".f..l..f..", ".ff.l.ff..", "..fflff...", "..flllf...", ".ffflfff..", "..fflff...", "...lll....", "....l.....", "....l....."],
  thistle: ["..f.f.f...", "...fff....", "..ffgff...", "...fff....", "....l.....", "..l.l.l...", "...lll....", "..l.l.l...", "....l.....", "....l....."],
  berry: ["..........", "..llllll..", ".llfllfll.", ".lfgllllf.", ".llllfgll.", ".lfllllll.", "..llfgll..", "...llll...", "....ll....", "....l....."],
};
const CROP_SHAPE: Record<string, string> = { mandrake: 'root', sunroot: 'root', moonpetal: 'flower', bitterleaf: 'leaf', ironthistle: 'thistle', sweetbriar: 'berry' };
export function cropSprite(crop: string, stage: number): HTMLCanvasElement {
  const c = CROP[crop]; const pal = { l: c.leaf, f: c.fruit, g: '#ffffff' };
  if (stage <= 0) return sprite('crop:seed', ["..........", "..........", "..........", "..........", "..........", "..........", "..........", "...k..k...", "....kk....", ".........."], { k: '#3a2416' }, 1, false);
  const rows = stage === 1 ? SPROUT : stage === 2 ? YOUNG : MATURE[CROP_SHAPE[crop]];
  return sprite(`crop:${crop}:${stage}`, rows, pal, 1);
}

// ---------- props ----------
export const MISC = {
  thrall: ["...bbbb...", "..bkbbkb..", "..bbbbbb..", "...b..b...", "....bb....", "..bbbbbb..", ".b.bbbb.b.", "...bbbb...", "....bb....", "...b..b...", "...b..b...", "..bb..bb.."],
  poppet: ["...yyyy...", "..ykyyky..", "..yyyyyy..", "...yrry...", "..yyyyyy..", ".yyyyyyyy.", "y.yyyyyy.y", "..yyyyyy..", "..yy..yy..", "..yy..yy..", ".yy....yy."],
  snapvine: ["...gggg...", "..gGGGGg..", ".gGkGGkGg.", ".gGGGGGGg.", ".gwGwGwGg.", "..gGGGGg..", "....gg....", "...gg.....", "....g.....", "..gg.gg...", ".gg...gg..", "gg.....gg."],
  egg: ["....aa....", "...abaa...", "..aaaaaa..", "..abaaba..", ".aaaaaaaa.", ".aabaaaba.", ".aaaaaaaa.", "..aaaaaa..", "...aaaa..."],
};
export function miscSprite(name: keyof typeof MISC, pal: Record<string, string>): HTMLCanvasElement {
  return sprite(`misc:${name}:${JSON.stringify(pal)}`, MISC[name], { k: '#120a18', w: '#ffffff', ...pal }, 1);
}
