import type { Element } from './familiars';
import { ELEMENTS, ELEMENT_INFO } from './familiars';
import { R, Rng, pick } from '../core/util';

export type Slot = 'hat' | 'robe' | 'boots' | 'weapon' | 'charm';
export const SLOTS: Slot[] = ['hat', 'robe', 'boots', 'weapon', 'charm'];
export const SLOT_NAMES: Record<Slot, string> = { hat: 'Hat', robe: 'Robe', boots: 'Boots', weapon: 'Wand/Staff', charm: 'Charm' };
export type StatKey = 'pow' | 'ward' | 'vig' | 'mana' | 'haste' | 'crit';
export const STAT_NAMES: Record<StatKey, string> = { pow: 'Power', ward: 'Ward', vig: 'Vigor', mana: 'Mana', haste: 'Haste', crit: 'Crit %' };
export type Affix = Element | 'garden' | 'forage' | 'brew';
export const AFFIX_INFO: Record<Affix, { pre?: string; suf?: string; d: (v: number) => string }> = {
  ember: { suf: 'of Embers', d: v => `+${v}% damage with an Ember companion` },
  tide: { suf: 'of Tides', d: v => `+${v}% damage with a Tide companion` },
  stone: { suf: 'of Stone', d: v => `+${v}% damage with a Stone companion` },
  gale: { suf: 'of Gales', d: v => `+${v}% damage with a Gale companion` },
  spirit: { suf: 'of Souls', d: v => `+${v}% damage with a Spirit companion` },
  garden: { pre: "Gardener's", d: v => `+${v}% chance of higher crop quality` },
  forage: { pre: "Forager's", d: v => `+${v}% chance to forage double` },
  brew: { pre: "Brewer's", d: v => `+${(v / 10).toFixed(1)} brew quality points` },
};
export type HatStyle = 'pointed' | 'wide' | 'crooked' | 'flower' | 'spire';
export interface Gear {
  uid: number; slot: Slot; name: string; base: string; lvl: number; rar: number; s: Partial<Record<StatKey, number>>;
  aff?: Affix; affV?: number; hat?: HatStyle; hatCol?: string; wtype?: 'wand' | 'staff'; price: number;
}
export const RARITY = [{ name: 'Common', col: '#cfc6b6', m: 1 }, { name: 'Fine', col: '#7fd1a0', m: 1.35 }, { name: 'Rare', col: '#f2c14e', m: 1.8 }];

const BASES: Record<Slot, [number, string, Partial<Gear>][]> = {
  hat: [[1, 'Pointed Hat', { hat: 'pointed', hatCol: '#2a2140' }], [3, 'Crooked Hat', { hat: 'crooked', hatCol: '#3a2a20' }], [5, 'Wide-Brim Hat', { hat: 'wide', hatCol: '#1e2a3a' }], [7, 'Bloomcrown', { hat: 'flower', hatCol: '#3a6a2a' }], [9, 'Starspire Hat', { hat: 'spire', hatCol: '#2a1a4a' }]],
  robe: [[1, 'Linen Robe', {}], [3, 'Toadskin Robe', {}], [6, 'Bogweave Robe', {}], [9, 'Starcloak', {}]],
  boots: [[1, 'Felt Slippers', {}], [4, 'Bramble Boots', {}], [8, 'Moss Treaders', {}]],
  weapon: [[1, 'Birch Wand', { wtype: 'wand' }], [2, 'Ash Staff', { wtype: 'staff' }], [4, 'Bone Wand', { wtype: 'wand' }], [5, 'Gnarlwood Staff', { wtype: 'staff' }], [8, 'Starglass Wand', { wtype: 'wand' }], [9, 'Moonbough Staff', { wtype: 'staff' }]],
  charm: [[1, 'Acorn Charm', {}], [3, 'Toad Charm', {}], [6, 'Bell Charm', {}], [9, 'Rune Charm', {}]],
};

let uidCounter = 1000;
export function setGearUid(n: number) { uidCounter = Math.max(uidCounter, n); }
export function nextUid() { return ++uidCounter; }

export function makeGear(slot: Slot, lvl: number, rar: number, r: Rng = R, aff?: Affix | null, forceBase?: string): Gear {
  const m = RARITY[rar].m;
  const opts = BASES[slot].filter(b => b[0] <= lvl);
  const pool = slot === 'weapon' ? opts.slice(-2) : opts.slice(-1);
  const baseRow = forceBase ? BASES[slot].find(b => b[1] === forceBase)! : pick(pool, r);
  const [, base, extra] = baseRow;
  const s: Partial<Record<StatKey, number>> = {};
  const L = lvl;
  if (slot === 'weapon') {
    if (extra.wtype === 'staff') { s.pow = Math.round((5 + L * 2.2) * m); }
    else { s.pow = Math.round((3 + L * 1.5) * m); s.haste = Math.round((4 + L * 0.8) * m); }
  }
  if (slot === 'hat') { s.pow = Math.round((1 + L * 0.5) * m); s.mana = Math.round((6 + L * 2.5) * m); }
  if (slot === 'robe') { s.ward = Math.round((2 + L * 1.2) * m); s.vig = Math.round((8 + L * 5) * m); }
  if (slot === 'boots') { s.ward = Math.round((1 + L * 0.5) * m); s.haste = Math.round((2 + L * 0.5) * m); }
  if (slot === 'charm') { s.crit = Math.round((1 + L * 0.3) * m); s.vig = Math.round((4 + L * 2) * m); }
  let a: Affix | undefined = aff ?? undefined;
  if (aff === undefined && rar > 0 && r() < (rar === 2 ? 1 : 0.55)) {
    a = r() < 0.55 ? pick(ELEMENTS, r) : pick(['garden', 'forage', 'brew'] as Affix[], r);
  }
  const affV = a ? (['garden', 'forage', 'brew'].includes(a) ? Math.round((10 + L * 1.5) * (rar === 2 ? 1.5 : 1)) : Math.round((6 + L * 1) * (rar === 2 ? 1.5 : 1))) : undefined;
  const info = a ? AFFIX_INFO[a] : undefined;
  const name = (info?.pre ? info.pre + ' ' : '') + base + (info?.suf ? ' ' + info.suf : '');
  return { uid: nextUid(), slot, name, base, lvl, rar, s, aff: a, affV, hat: extra.hat, hatCol: extra.hatCol, wtype: extra.wtype, price: Math.round((14 + L * 10) * m * m) };
}
export function elementAffixName(e: Element) { return ELEMENT_INFO[e].name; }

export interface BroomPart { id: string; kind: 'handle' | 'bristle' | 'lantern'; name: string; price: number; d: string; stam?: number; regen?: number; spd?: number; light?: number; reveal?: boolean; col: string }
export const BROOM_PARTS: BroomPart[] = [
  { id: 'ash', kind: 'handle', name: 'Ash Handle', price: 0, stam: 100, regen: 8, d: '100 stamina.', col: '#b08a5a' },
  { id: 'yew', kind: 'handle', name: 'Yew Handle', price: 220, stam: 150, regen: 11, d: '150 stamina, faster recovery.', col: '#8a5a3a' },
  { id: 'blackthorn', kind: 'handle', name: 'Blackthorn Handle', price: 520, stam: 230, regen: 15, d: '230 stamina, fastest recovery.', col: '#3a2a2a' },
  { id: 'straw', kind: 'bristle', name: 'Straw Bristles', price: 0, spd: 1.7, d: '1.7× walking speed.', col: '#e0c070' },
  { id: 'heather', kind: 'bristle', name: 'Heather Bristles', price: 260, spd: 2.05, d: '2.05× walking speed.', col: '#b07ac0' },
  { id: 'raven', kind: 'bristle', name: 'Raven-feather Bristles', price: 600, spd: 2.45, d: '2.45× walking speed.', col: '#2a2a3a' },
  { id: 'none', kind: 'lantern', name: 'No Lantern', price: 0, light: 26, d: 'Dim at night.', col: '#000000' },
  { id: 'tallow', kind: 'lantern', name: 'Tallow Lantern', price: 120, light: 62, d: 'A warm light radius at night.', col: '#f2c14e' },
  { id: 'moonglass', kind: 'lantern', name: 'Moonglass Lantern', price: 480, light: 92, reveal: true, d: 'Wide light, and it reveals glimmer forage.', col: '#bcd4ff' },
];
export const BPART: Record<string, BroomPart> = Object.fromEntries(BROOM_PARTS.map(p => [p.id, p]));
export const BROOM_DYES = ['#b08a5a', '#6b3fa0', '#a63a3a', '#2f4f8f', '#3a6a3a', '#e8e8f0'];
