export type CraftId = 'sigil' | 'poppet' | 'herbal' | 'shape' | 'necro';
export type SkillKind =
  | 'proj' | 'melee' | 'sigil' | 'circle' | 'poppet' | 'thread' | 'flask' | 'snapvine' | 'pounce' | 'wildshape' | 'raise' | 'pulse'
  | 'fan' | 'wardzone' | 'delayaoe' | 'pull' | 'curse' | 'nova' | 'heal' | 'multi' | 'corpseboom' | 'drain';
export interface SkillDef {
  id: string; name: string; lvl: number; mp: number; cd: number; kind: SkillKind; mult: number; icon: string; desc: string;
  spd?: number; r?: number; pierce?: number; rad?: number; range?: number; dur?: number; mark?: boolean; stun?: number; root?: number; n?: number; delay?: number;
}
export type NodeFx =
  | { k: 'skill'; s: number; dmg?: number; cd?: number; mp?: number }
  | { k: 'stat'; hp?: number; pow?: number; crit?: number; ward?: number; spd?: number; mana?: number }
  | { k: 'unlock'; adv: number }
  | { k: 'flag'; f: string };
export interface TreeNode { id: string; name: string; tier: number; branch: number; d: string; fx: NodeFx[] }
export interface CraftDef {
  id: CraftId; name: string; col: string; light: string; role: string; blurb: string; passive: string; hpMul: number;
  skills: [SkillDef, SkillDef, SkillDef]; adv: [SkillDef, SkillDef, SkillDef]; branches: [string, string, string]; tree: TreeNode[];
}
export const TIER_LVL = [0, 2, 4, 7, 10];
const N = (id: string, tier: number, branch: number, name: string, d: string, ...fx: NodeFx[]): TreeNode => ({ id, name, tier, branch, d, fx });

export const CRAFTS: Record<CraftId, CraftDef> = {
  sigil: { id: 'sigil', name: 'Sigilwright', col: '#e0b040', light: '#fff1a8', role: 'Zone control', hpMul: 1,
    blurb: 'Draws runes in the air and circles on the ground. Wins fights before they reach you.', passive: 'Sigils last longer the higher your level.',
    skills: [
      { id: 's1', name: 'Rune Bolt', lvl: 1, mp: 0, cd: 0.45, kind: 'proj', mult: 1.0, spd: 220, r: 3, icon: 'rune', desc: 'Fire a glowing rune.' },
      { id: 's2', name: 'Snare Sigil', lvl: 3, mp: 10, cd: 2.5, kind: 'sigil', mult: 2.0, rad: 30, range: 90, root: 1.5, icon: 'sigil', desc: 'Place a trap at the cursor. It bursts and roots the first enemy to touch it (up to 3).' },
      { id: 's3', name: 'Grand Circle', lvl: 6, mp: 28, cd: 15, kind: 'circle', mult: 0.45, rad: 52, dur: 5, icon: 'circle', desc: 'A circle around you for 5s: damages and slows enemies inside; you take 30% less damage.' }],
    adv: [
      { id: 'a1', name: 'Rune Storm', lvl: 1, mp: 22, cd: 9, kind: 'fan', mult: 0.9, n: 5, spd: 200, r: 3, icon: 'runestorm', desc: 'Fan of five runes toward the cursor.' },
      { id: 'a2', name: 'Warding Glyph', lvl: 1, mp: 24, cd: 16, kind: 'wardzone', mult: 0, rad: 40, dur: 6, icon: 'ward', desc: 'A glyph that destroys enemy projectiles inside it for 6s.' },
      { id: 'a3', name: 'Seal of Binding', lvl: 1, mp: 26, cd: 14, kind: 'delayaoe', mult: 2.4, rad: 40, range: 110, delay: 0.8, root: 2.5, icon: 'seal', desc: 'After a short delay, a seal slams down at the cursor, rooting everything inside.' }],
    branches: ['Inscription', 'Warding', 'Binding'],
    tree: [
      N('i1', 1, 0, 'Keen Runes', 'Rune Bolt deals 20% more damage.', { k: 'skill', s: 0, dmg: 0.2 }),
      N('i2', 2, 0, 'Twin Runes', 'Rune Bolt fires two runes.', { k: 'flag', f: 'twin_bolt' }),
      N('i3', 3, 0, 'Rune Storm', 'Unlocks Rune Storm.', { k: 'unlock', adv: 0 }),
      N('i4', 4, 0, 'Runic Overflow', 'Critical hits refund 3 MP.', { k: 'flag', f: 'crit_mp' }),
      N('w1', 1, 1, 'Steady Hand', '+10% max HP.', { k: 'stat', hp: 0.1 }),
      N('w2', 2, 1, 'Ward Knot', '+8 Ward.', { k: 'stat', ward: 8 }),
      N('w3', 3, 1, 'Warding Glyph', 'Unlocks Warding Glyph.', { k: 'unlock', adv: 1 }),
      N('w4', 4, 1, 'Grand Ward', 'Grand Circle lasts 2s longer and blocks 50% of damage.', { k: 'flag', f: 'grand_ward' }),
      N('b1', 1, 2, 'Sticky Sigils', 'Snare Sigil roots for 0.8s longer.', { k: 'flag', f: 'snare_root' }),
      N('b2', 2, 2, 'Trap Ring', 'Keep up to 5 Snare Sigils.', { k: 'flag', f: 'sigil5' }),
      N('b3', 3, 2, 'Seal of Binding', 'Unlocks Seal of Binding.', { k: 'unlock', adv: 2 }),
      N('b4', 4, 2, 'Deep Snare', 'Snare Sigil deals 60% more damage.', { k: 'skill', s: 1, dmg: 0.6 }),
    ] },
  poppet: { id: 'poppet', name: 'Poppeteer', col: '#d06a8a', light: '#ffc8d8', role: 'Curses', hpMul: 0.95,
    blurb: 'Pins, thread and straw dolls. Hurts enemies by hurting their likeness.', passive: 'Marks you apply last 8 seconds.',
    skills: [
      { id: 's1', name: 'Pin', lvl: 1, mp: 0, cd: 0.32, kind: 'proj', mult: 0.7, spd: 300, r: 2, mark: true, icon: 'pin', desc: 'A fast needle. Adds a Mark (stacks to 5).' },
      { id: 's2', name: 'Stitch Poppet', lvl: 3, mp: 14, cd: 9, kind: 'poppet', mult: 0.6, range: 80, dur: 7, icon: 'poppet', desc: 'Place a decoy doll at the cursor. Enemies attack it, and Marked enemies feel every blow.' },
      { id: 's3', name: 'Pull the Thread', lvl: 6, mp: 24, cd: 10, kind: 'thread', mult: 0.9, stun: 1, icon: 'thread', desc: 'Detonate every Mark on screen: damage per stack, and stun.' }],
    adv: [
      { id: 'a1', name: 'Needle Rain', lvl: 1, mp: 20, cd: 10, kind: 'delayaoe', mult: 1.2, rad: 36, range: 110, delay: 0.6, mark: true, icon: 'needles', desc: 'Needles rain on the cursor area, adding two Marks.' },
      { id: 'a2', name: 'Puppet Strings', lvl: 1, mp: 18, cd: 12, kind: 'pull', mult: 0.6, range: 160, icon: 'strings', desc: 'Yank every Marked enemy toward the cursor.' },
      { id: 'a3', name: 'Hex Doll', lvl: 1, mp: 22, cd: 14, kind: 'curse', mult: 0, range: 140, dur: 8, icon: 'hexdoll', desc: 'Curse the enemy nearest the cursor: it takes 35% more damage for 8s.' }],
    branches: ['Needlework', 'Effigy', 'Malice'],
    tree: [
      N('n1', 1, 0, 'Fine Needles', 'Pin deals 20% more damage.', { k: 'skill', s: 0, dmg: 0.2 }),
      N('n2', 2, 0, 'Through and Through', 'Pins pass through one enemy.', { k: 'flag', f: 'pin_pierce' }),
      N('n3', 3, 0, 'Needle Rain', 'Unlocks Needle Rain.', { k: 'unlock', adv: 0 }),
      N('n4', 4, 0, 'Pincushion', 'Marks stack to 7.', { k: 'flag', f: 'mark7' }),
      N('e1', 1, 1, 'Sturdy Straw', 'Poppets have 50% more health.', { k: 'flag', f: 'poppet_hp' }),
      N('e2', 2, 1, 'Quick Stitch', 'Stitch Poppet recharges 30% faster.', { k: 'skill', s: 1, cd: 0.3 }),
      N('e3', 3, 1, 'Puppet Strings', 'Unlocks Puppet Strings.', { k: 'unlock', adv: 1 }),
      N('e4', 4, 1, 'Burning Effigy', 'Poppets explode when they break or expire.', { k: 'flag', f: 'poppet_explode' }),
      N('m1', 1, 2, 'Spite', '+8% power.', { k: 'stat', pow: 0.08 }),
      N('m2', 2, 2, 'Unravel', 'Pull the Thread refunds 2 MP per Mark.', { k: 'flag', f: 'thread_refund' }),
      N('m3', 3, 2, 'Hex Doll', 'Unlocks Hex Doll.', { k: 'unlock', adv: 2 }),
      N('m4', 4, 2, 'Snap', 'Pull the Thread deals 50% more damage.', { k: 'skill', s: 2, dmg: 0.5 }),
    ] },
  herbal: { id: 'herbal', name: 'Herbalist', col: '#6ac04a', light: '#c8f0a0', role: 'Bruiser', hpMul: 1.15,
    blurb: 'Fights with thorns and flasks, and drinks deeper from every potion.', passive: 'Potions you drink are 40% stronger.',
    skills: [
      { id: 's1', name: 'Thornlash', lvl: 1, mp: 0, cd: 0.5, kind: 'melee', mult: 1.35, rad: 30, icon: 'vine', desc: 'Whip a thorny vine in an arc. Knocks enemies back.' },
      { id: 's2', name: 'Flask Toss', lvl: 3, mp: 12, cd: 4, kind: 'flask', mult: 0.55, rad: 28, range: 100, dur: 4, icon: 'flask', desc: 'Lob a flask at the cursor. Leaves a poison cloud for 4s.' },
      { id: 's3', name: 'Overgrowth', lvl: 6, mp: 26, cd: 16, kind: 'snapvine', mult: 1.1, range: 70, dur: 10, icon: 'snap', desc: 'Grow a Snapvine at the cursor for 10s. It bites nearby enemies and heals you while you stand near it.' }],
    adv: [
      { id: 'a1', name: 'Thorn Ring', lvl: 1, mp: 18, cd: 9, kind: 'nova', mult: 1.6, rad: 44, icon: 'thornring', desc: 'Thorns burst out around you, knocking enemies away.' },
      { id: 'a2', name: 'Spore Burst', lvl: 1, mp: 22, cd: 12, kind: 'delayaoe', mult: 1.4, rad: 46, range: 110, delay: 0.7, icon: 'spore', desc: 'A spore pod bursts at the cursor, leaving a huge poison cloud.' },
      { id: 'a3', name: 'Verdant Surge', lvl: 1, mp: 30, cd: 22, kind: 'heal', mult: 0.25, dur: 6, icon: 'surge', desc: 'Heal 25% of your HP, then regenerate for 6s.' }],
    branches: ['Thorn', 'Alchemy', 'Grove'],
    tree: [
      N('t1', 1, 0, 'Barbed Vines', 'Thornlash makes enemies bleed.', { k: 'flag', f: 'lash_bleed' }),
      N('t2', 2, 0, 'Long Lash', 'Thornlash reaches 30% farther and hits 15% harder.', { k: 'skill', s: 0, dmg: 0.15 }, { k: 'flag', f: 'long_lash' }),
      N('t3', 3, 0, 'Thorn Ring', 'Unlocks Thorn Ring.', { k: 'unlock', adv: 0 }),
      N('t4', 4, 0, 'Bramble Hide', '+12 Ward and reflect 15% of melee damage.', { k: 'stat', ward: 12 }, { k: 'flag', f: 'bramble' }),
      N('a1', 1, 1, 'Steady Hands', 'Potion cooldown is 40% shorter.', { k: 'flag', f: 'potion_cd' }),
      N('a2', 2, 1, 'Double Toss', 'Flask Toss throws two flasks.', { k: 'flag', f: 'flask_twin' }),
      N('a3', 3, 1, 'Spore Burst', 'Unlocks Spore Burst.', { k: 'unlock', adv: 1 }),
      N('a4', 4, 1, 'Caustic', 'Poison clouds deal 60% more damage.', { k: 'flag', f: 'caustic' }),
      N('g1', 1, 2, 'Deep Roots', '+12% max HP.', { k: 'stat', hp: 0.12 }),
      N('g2', 2, 2, 'Perennial', 'Snapvine lasts 5s longer.', { k: 'flag', f: 'snap_long' }),
      N('g3', 3, 2, 'Verdant Surge', 'Unlocks Verdant Surge.', { k: 'unlock', adv: 2 }),
      N('g4', 4, 2, 'Wildwood', 'Overgrowth grows two Snapvines.', { k: 'flag', f: 'snap_two' }),
    ] },
  shape: { id: 'shape', name: 'Shapeshifter', col: '#c08a4a', light: '#f0d0a0', role: 'Melee', hpMul: 1.25,
    blurb: 'Borrows the body of your familiar. Fast, close and ferocious.', passive: "Your active familiar's Might counts double for you.",
    skills: [
      { id: 's1', name: 'Claw', lvl: 1, mp: 0, cd: 0.38, kind: 'melee', mult: 1.25, rad: 26, icon: 'claw', desc: 'A quick swipe in front of you.' },
      { id: 's2', name: 'Pounce', lvl: 3, mp: 8, cd: 3, kind: 'pounce', mult: 1.8, range: 80, rad: 26, icon: 'pounce', desc: 'Leap to the cursor and strike where you land. Untouchable mid-air.' },
      { id: 's3', name: 'Wild Shape', lvl: 6, mp: 26, cd: 18, kind: 'wildshape', mult: 0, dur: 10, icon: 'beast', desc: "Become your familiar's species for 10s: +40% damage, +25% speed." }],
    adv: [
      { id: 'a1', name: 'Rending Frenzy', lvl: 1, mp: 16, cd: 8, kind: 'multi', mult: 0.9, n: 4, rad: 28, icon: 'frenzy', desc: 'Four rapid slashes in front of you.' },
      { id: 'a2', name: 'Primal Roar', lvl: 1, mp: 20, cd: 14, kind: 'nova', mult: 0.6, rad: 60, stun: 1.6, icon: 'roar', desc: 'A roar that stuns everything around you.' },
      { id: 'a3', name: 'Beast Leap', lvl: 1, mp: 18, cd: 10, kind: 'pounce', mult: 3, range: 130, rad: 44, icon: 'leap', desc: 'A huge leap that crashes down on a wide area.' }],
    branches: ['Fang', 'Hunt', 'Wild'],
    tree: [
      N('f1', 1, 0, 'Sharp Claws', 'Claw deals 20% more damage.', { k: 'skill', s: 0, dmg: 0.2 }),
      N('f2', 2, 0, 'Combo', 'Every third Claw hits twice as hard.', { k: 'flag', f: 'claw_combo' }),
      N('f3', 3, 0, 'Rending Frenzy', 'Unlocks Rending Frenzy.', { k: 'unlock', adv: 0 }),
      N('f4', 4, 0, 'Bloodthirst', 'Heal for 6% of damage dealt.', { k: 'flag', f: 'shape_lifesteal' }),
      N('h1', 1, 1, 'Fleet', '+8% move speed.', { k: 'stat', spd: 0.08 }),
      N('h2', 2, 1, 'Second Wind', 'Pounce resets when it defeats an enemy.', { k: 'flag', f: 'pounce_reset' }),
      N('h3', 3, 1, 'Beast Leap', 'Unlocks Beast Leap.', { k: 'unlock', adv: 2 }),
      N('h4', 4, 1, 'Predator', '+10% critical hit chance.', { k: 'stat', crit: 0.1 }),
      N('wl1', 1, 2, 'Thick Pelt', '+10 Ward.', { k: 'stat', ward: 10 }),
      N('wl2', 2, 2, 'Long Shape', 'Wild Shape lasts 5s longer and heals 20% when it starts.', { k: 'flag', f: 'wild_long' }),
      N('wl3', 3, 2, 'Primal Roar', 'Unlocks Primal Roar.', { k: 'unlock', adv: 1 }),
      N('wl4', 4, 2, 'Apex', 'In Wild Shape, skills cost no MP.', { k: 'flag', f: 'apex' }),
    ] },
  necro: { id: 'necro', name: 'Necromancer', col: '#8a7ad0', light: '#d8d0ff', role: 'Summoner', hpMul: 0.95,
    blurb: 'Calls the fallen back to fight for you. The Order hates this one most.', passive: 'Enemies you defeat leave a corpse for 10s.',
    skills: [
      { id: 's1', name: 'Bone Shard', lvl: 1, mp: 0, cd: 0.5, kind: 'proj', mult: 0.95, spd: 200, r: 3, pierce: 1, icon: 'bone', desc: 'A shard of bone that passes through one enemy.' },
      { id: 's2', name: 'Raise Dead', lvl: 3, mp: 18, cd: 10, kind: 'raise', mult: 0.5, range: 110, dur: 15, icon: 'skull', desc: 'Raise up to 2 nearby corpses as allies for 15s. With no corpses, a Bone Thrall rises.' },
      { id: 's3', name: 'Grave Pulse', lvl: 6, mp: 24, cd: 11, kind: 'pulse', mult: 1.8, rad: 56, icon: 'pulse', desc: 'A dark nova that drains life: heals you for 30% of damage dealt.' }],
    adv: [
      { id: 'a1', name: 'Bone Spear', lvl: 1, mp: 18, cd: 7, kind: 'proj', mult: 2.4, spd: 260, r: 4, pierce: 6, icon: 'spear', desc: 'A long spear of bone that pierces everything in a line.' },
      { id: 'a2', name: 'Corpse Blast', lvl: 1, mp: 16, cd: 6, kind: 'corpseboom', mult: 2.2, rad: 40, range: 140, icon: 'corpse', desc: 'Detonate every corpse near the cursor.' },
      { id: 'a3', name: 'Soul Siphon', lvl: 1, mp: 24, cd: 13, kind: 'drain', mult: 1.2, range: 100, n: 3, icon: 'siphon', desc: 'Drain the three nearest enemies, healing yourself.' }],
    branches: ['Bone', 'Grave', 'Soul'],
    tree: [
      N('bo1', 1, 0, 'Sharpened Bone', 'Bone Shard deals 20% more damage.', { k: 'skill', s: 0, dmg: 0.2 }),
      N('bo2', 2, 0, 'Splinter', 'Bone Shard splits into three when it stops.', { k: 'flag', f: 'shard_split' }),
      N('bo3', 3, 0, 'Bone Spear', 'Unlocks Bone Spear.', { k: 'unlock', adv: 0 }),
      N('bo4', 4, 0, 'Ossuary', '+10% power and +6 Ward.', { k: 'stat', pow: 0.1, ward: 6 }),
      N('gr1', 1, 1, 'Restless Dead', 'Raised allies last 5s longer.', { k: 'flag', f: 'raise_long' }),
      N('gr2', 2, 1, 'Legion', 'Raise up to 3 corpses, and allies hit harder.', { k: 'flag', f: 'raise3' }),
      N('gr3', 3, 1, 'Corpse Blast', 'Unlocks Corpse Blast.', { k: 'unlock', adv: 1 }),
      N('gr4', 4, 1, 'Final Gift', 'Raised allies explode when they fall.', { k: 'flag', f: 'minion_explode' }),
      N('so1', 1, 2, 'Dark Vigor', '+10% max HP.', { k: 'stat', hp: 0.1 }),
      N('so2', 2, 2, 'Hunger', 'Grave Pulse heals for 50% of damage instead.', { k: 'flag', f: 'pulse_hunger' }),
      N('so3', 3, 2, 'Soul Siphon', 'Unlocks Soul Siphon.', { k: 'unlock', adv: 2 }),
      N('so4', 4, 2, 'Lich Touch', '+20% MP and Grave Pulse recharges 30% faster.', { k: 'stat', mana: 0.2 }, { k: 'skill', s: 2, cd: 0.3 }),
    ] },
};
export const CRAFT_IDS: CraftId[] = ['sigil', 'poppet', 'herbal', 'shape', 'necro'];
export const CRAFT_LEARN_PRICE = 120;
export const RESPEC_PRICE = 100;

export interface RaceDef { id: string; name: string; blurb: string; hp: number; mp: number; pow: number; spd: number; bonus: string; skins: string[] }
export const RACES: RaceDef[] = [
  { id: 'mossborn', name: 'Mossborn', blurb: 'Stout bog-folk with lichen in their hair.', hp: 1.2, mp: 0.95, pow: 1, spd: 0.95, bonus: '+20% HP, −5% speed', skins: ['#9ab87a', '#7fa060', '#b4c890'] },
  { id: 'vesper', name: 'Vesper', blurb: 'Moth-touched night folk. Quick on their feet.', hp: 0.95, mp: 1, pow: 1, spd: 1.15, bonus: '+15% speed, −5% HP', skins: ['#e4d6f4', '#cbb8e4', '#f0e8fc'] },
  { id: 'aetherkin', name: 'Aetherkin', blurb: 'Star-blooded scholars with deep mana.', hp: 0.9, mp: 1.25, pow: 1.12, spd: 1, bonus: '+25% MP, +12% power, −10% HP', skins: ['#a8c8f0', '#8aaee0', '#c4dcf8'] },
  { id: 'hearthfolk', name: 'Hearthfolk', blurb: 'Village witches. A little better at everything.', hp: 1.05, mp: 1.05, pow: 1.05, spd: 1.03, bonus: '+5% HP, MP, power; +3% speed', skins: ['#f4cfa8', '#d49a70', '#9a6a48'] },
];
export const HAIRS = ['#3a2622', '#e8d8a0', '#c0502a', '#e8e8f0', '#7a3a9a', '#3a5a3a', '#2a3a6a'];
export const ROBES = ['#6b3fa0', '#4f7a3a', '#a63a3a', '#2f4f8f', '#b07a2a', '#5a5a6e', '#2a2a3a'];
