export type CraftId = 'sigil' | 'poppet' | 'herbal' | 'shape' | 'necro';
export type SkillKind =
  | 'proj' | 'melee' | 'sigil' | 'circle' | 'poppet' | 'thread' | 'flask' | 'snapvine' | 'pounce' | 'wildshape' | 'raise' | 'pulse';
export interface SkillDef {
  name: string; lvl: number; mp: number; cd: number; kind: SkillKind; mult: number; icon: string; desc: string;
  spd?: number; r?: number; pierce?: number; rad?: number; range?: number; dur?: number; mark?: boolean;
}
export interface CraftDef { id: CraftId; name: string; col: string; light: string; role: string; blurb: string; passive: string; skills: [SkillDef, SkillDef, SkillDef]; hpMul: number }

export const CRAFTS: Record<CraftId, CraftDef> = {
  sigil: { id: 'sigil', name: 'Sigilwright', col: '#e0b040', light: '#fff1a8', role: 'Zone control', hpMul: 1,
    blurb: 'Draws runes in the air and circles on the ground. Wins fights before they reach you.',
    passive: 'Sigils last longer the higher your Sigilwright level.',
    skills: [
      { name: 'Rune Bolt', lvl: 1, mp: 0, cd: 0.42, kind: 'proj', mult: 1.0, spd: 220, r: 3, icon: 'rune', desc: 'Fire a glowing rune.' },
      { name: 'Snare Sigil', lvl: 3, mp: 10, cd: 2.5, kind: 'sigil', mult: 2.2, rad: 30, range: 90, dur: 1.5, icon: 'sigil', desc: 'Place a trap at the cursor. It bursts and roots the first enemy to touch it (up to 3).' },
      { name: 'Grand Circle', lvl: 6, mp: 28, cd: 14, kind: 'circle', mult: 0.5, rad: 52, dur: 5, icon: 'circle', desc: 'A circle around you for 5s: damages and slows enemies inside; you take 30% less damage.' },
    ] },
  poppet: { id: 'poppet', name: 'Poppeteer', col: '#d06a8a', light: '#ffc8d8', role: 'Curses', hpMul: 0.95,
    blurb: 'Pins, thread and straw dolls. Hurts enemies by hurting their likeness.',
    passive: 'Marks you apply last 8 seconds.',
    skills: [
      { name: 'Pin', lvl: 1, mp: 0, cd: 0.32, kind: 'proj', mult: 0.7, spd: 300, r: 2, mark: true, icon: 'pin', desc: 'A fast needle. Adds a Mark (stacks to 5).' },
      { name: 'Stitch Poppet', lvl: 3, mp: 14, cd: 9, kind: 'poppet', mult: 0.6, range: 80, dur: 7, icon: 'poppet', desc: 'Place a decoy doll at the cursor. Enemies attack it, and Marked enemies feel every blow.' },
      { name: 'Pull the Thread', lvl: 6, mp: 24, cd: 10, kind: 'thread', mult: 0.9, icon: 'thread', desc: 'Detonate every Mark on screen: damage per stack, and stun.' },
    ] },
  herbal: { id: 'herbal', name: 'Herbalist', col: '#6ac04a', light: '#c8f0a0', role: 'Bruiser', hpMul: 1.15,
    blurb: 'Fights with thorns and flasks, and drinks deeper from every potion.',
    passive: 'Potions you drink are 40% stronger.',
    skills: [
      { name: 'Thornlash', lvl: 1, mp: 0, cd: 0.5, kind: 'melee', mult: 1.35, rad: 30, icon: 'vine', desc: 'Whip a thorny vine in an arc. Knocks enemies back.' },
      { name: 'Flask Toss', lvl: 3, mp: 12, cd: 4, kind: 'flask', mult: 0.55, rad: 28, range: 100, dur: 4, icon: 'flask', desc: 'Lob a flask at the cursor. Leaves a poison cloud for 4s.' },
      { name: 'Overgrowth', lvl: 6, mp: 26, cd: 16, kind: 'snapvine', mult: 1.1, range: 70, dur: 10, icon: 'snap', desc: 'Grow a Snapvine at the cursor for 10s. It bites nearby enemies and heals you while you stand near it.' },
    ] },
  shape: { id: 'shape', name: 'Shapeshifter', col: '#c08a4a', light: '#f0d0a0', role: 'Melee', hpMul: 1.25,
    blurb: 'Borrows the body of your familiar. Fast, close and ferocious.',
    passive: "Your companion's Might counts double for you.",
    skills: [
      { name: 'Claw', lvl: 1, mp: 0, cd: 0.38, kind: 'melee', mult: 1.25, rad: 26, icon: 'claw', desc: 'A quick swipe in front of you.' },
      { name: 'Pounce', lvl: 3, mp: 8, cd: 3, kind: 'pounce', mult: 1.8, range: 80, rad: 26, icon: 'pounce', desc: 'Leap to the cursor and strike where you land. Untouchable mid-air.' },
      { name: 'Wild Shape', lvl: 6, mp: 26, cd: 18, kind: 'wildshape', mult: 0, dur: 10, icon: 'beast', desc: "Become your companion's species for 10s: +40% damage, +25% speed." },
    ] },
  necro: { id: 'necro', name: 'Necromancer', col: '#8a7ad0', light: '#d8d0ff', role: 'Summoner', hpMul: 0.95,
    blurb: 'Calls the fallen back to fight for you. The Order hates this one most.',
    passive: 'Enemies you defeat leave a corpse for 10s.',
    skills: [
      { name: 'Bone Shard', lvl: 1, mp: 0, cd: 0.5, kind: 'proj', mult: 0.95, spd: 200, r: 3, pierce: 1, icon: 'bone', desc: 'A shard of bone that passes through one enemy.' },
      { name: 'Raise Dead', lvl: 3, mp: 18, cd: 10, kind: 'raise', mult: 0.5, range: 110, dur: 15, icon: 'skull', desc: 'Raise up to 2 nearby corpses as allies for 15s. With no corpses, a Bone Thrall rises.' },
      { name: 'Grave Pulse', lvl: 6, mp: 24, cd: 11, kind: 'pulse', mult: 1.8, rad: 56, icon: 'pulse', desc: 'A dark nova that drains life: heals you for 30% of damage dealt.' },
    ] },
};
export const CRAFT_IDS: CraftId[] = ['sigil', 'poppet', 'herbal', 'shape', 'necro'];
export const CRAFT_LEARN_PRICE = 120;

export interface RaceDef { id: string; name: string; blurb: string; hp: number; mp: number; pow: number; spd: number; bonus: string; skins: string[] }
export const RACES: RaceDef[] = [
  { id: 'mossborn', name: 'Mossborn', blurb: 'Stout bog-folk with lichen in their hair.', hp: 1.2, mp: 0.95, pow: 1, spd: 0.95, bonus: '+20% HP, −5% speed', skins: ['#7fae5a', '#5f8f45', '#9ab86a'] },
  { id: 'vesper', name: 'Vesper', blurb: 'Moth-touched night folk. Quick on their feet.', hp: 0.95, mp: 1, pow: 1, spd: 1.15, bonus: '+15% speed, −5% HP', skins: ['#d9c7f0', '#b9a3dd', '#e8dcf8'] },
  { id: 'aetherkin', name: 'Aetherkin', blurb: 'Star-blooded scholars with deep mana.', hp: 0.9, mp: 1.25, pow: 1.12, spd: 1, bonus: '+25% MP, +12% power, −10% HP', skins: ['#8fb8e8', '#6d95cf', '#b4d2f2'] },
  { id: 'hearthfolk', name: 'Hearthfolk', blurb: 'Village witches. A little better at everything.', hp: 1.05, mp: 1.05, pow: 1.05, spd: 1.03, bonus: '+5% HP, MP, power; +3% speed', skins: ['#f1c6a0', '#c98e62', '#8a5a3b'] },
];
export const HAIRS = ['#2a1a1a', '#e8d8a0', '#c0502a', '#e8e8f0', '#7a3a9a', '#3a5a3a'];
export const ROBES = ['#6b3fa0', '#4f7a3a', '#a63a3a', '#2f4f8f', '#b07a2a', '#5a5a6e'];
