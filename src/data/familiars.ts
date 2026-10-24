export type Element = 'ember' | 'tide' | 'stone' | 'gale';
export const ELEMENTS: Element[] = ['ember', 'tide', 'stone', 'gale'];
export const ELEMENT_INFO: Record<Element, { name: string; col: string; light: string; infuse: string }> = {
  ember: { name: 'Ember', col: '#f07a3a', light: '#ffd166', infuse: 'Your skills can set enemies ablaze.' },
  tide: { name: 'Tide', col: '#3fa7d6', light: '#a6e4ff', infuse: 'Your skills slow enemies, and your familiar mends you.' },
  stone: { name: 'Stone', col: '#c09a60', light: '#ead2a2', infuse: 'Your skills knock enemies back; you gain Ward.' },
  gale: { name: 'Gale', col: '#7fd1a0', light: '#d6ffe6', infuse: 'Your skills crit more often, and you move faster.' },
};

export const FSTATS = ['might', 'nurture', 'instinct', 'wit', 'wing'] as const;
export type FStat = typeof FSTATS[number];
export const FSTAT_INFO: Record<FStat, { name: string; job: string }> = {
  might: { name: 'Might', job: 'Companion damage' },
  nurture: { name: 'Nurture', job: 'Garden: plots watered, crop quality' },
  instinct: { name: 'Instinct', job: 'Forage: items found, rarity' },
  wit: { name: 'Wit', job: 'Cauldron: brew quality' },
  wing: { name: 'Wing', job: 'Broom speed as companion' },
};

export interface SpeciesDef {
  id: string; el: Element; names: [string, string, string]; shape: string; pal: Record<string, string>;
  caps: Record<FStat, number>; sig: { name: string; vals: [number, number, number]; d: (v: number) => string };
  where: string; fly: boolean;
}
export const SPECIES: Record<string, SpeciesDef> = {
  sparkit: { id: 'sparkit', el: 'ember', names: ['Sparkit', 'Cinderfox', 'Pyrevix'], shape: 'fox', pal: { a: '#e8682c', b: '#ffe0b0', c: '#3a1a10' }, fly: false,
    caps: { might: 80, nurture: 30, instinct: 55, wit: 50, wing: 45 }, sig: { name: 'Kindle', vals: [20, 30, 40], d: v => `${v}% chance on hit to set enemies ablaze.` }, where: 'Brindlewood clearings' },
  wickmoth: { id: 'wickmoth', el: 'ember', names: ['Wickmoth', 'Lanternmoth', 'Solarwing'], shape: 'moth', pal: { a: '#f5a142', b: '#fff1a8', c: '#5a2a12' }, fly: true,
    caps: { might: 50, nurture: 40, instinct: 45, wit: 80, wing: 70 }, sig: { name: 'Ashfeed', vals: [4, 7, 10], d: v => `Each kill restores ${v} MP.` }, where: 'Brindlewood, at night' },
  puddlewog: { id: 'puddlewog', el: 'tide', names: ['Puddlewog', 'Rillhopper', 'Deluge Toad'], shape: 'frog', pal: { a: '#3fa7d6', b: '#bfeeff', c: '#123a55' }, fly: false,
    caps: { might: 45, nurture: 85, instinct: 45, wit: 55, wing: 30 }, sig: { name: 'Mire Mend', vals: [0.6, 1, 1.5], d: v => `Regenerate ${v}% of max HP per second.` }, where: 'Near water in Brindlewood' },
  driftjel: { id: 'driftjel', el: 'tide', names: ['Driftjel', 'Glimmerjel', 'Abyssal Bell'], shape: 'jelly', pal: { a: '#8a7ff0', b: '#d8d2ff', c: '#2b2466' }, fly: true,
    caps: { might: 55, nurture: 60, instinct: 40, wit: 75, wing: 55 }, sig: { name: 'Numbing Sting', vals: [1.5, 2.5, 3.5], d: v => `Hits slow enemies by 45% for ${v}s.` }, where: 'Rare: Brindlewood ponds at night' },
  pebbleshell: { id: 'pebbleshell', el: 'stone', names: ['Pebbleshell', 'Mossback', 'Cairnback'], shape: 'turtle', pal: { a: '#8f8a7a', b: '#79a94f', c: '#2e2a22' }, fly: false,
    caps: { might: 70, nurture: 75, instinct: 35, wit: 40, wing: 15 }, sig: { name: 'Brambleshell', vals: [25, 40, 60], d: v => `Reflect ${v}% of melee damage to attackers.` }, where: 'Brindlewood, by the road' },
  dirtnib: { id: 'dirtnib', el: 'stone', names: ['Dirtnib', 'Delvemole', 'Quakemaw'], shape: 'mole', pal: { a: '#7a5638', b: '#f0b6a0', c: '#2a1a10' }, fly: false,
    caps: { might: 55, nurture: 60, instinct: 85, wit: 35, wing: 15 }, sig: { name: 'Prospector', vals: [30, 50, 75], d: v => `+${v}% gold, and more gear drops.` }, where: 'Brindlewood' },
  fluffowl: { id: 'fluffowl', el: 'gale', names: ['Fluffowl', 'Galehoot', 'Stormstrix'], shape: 'owl', pal: { a: '#cfc2a0', b: '#fff6dc', c: '#3a3020' }, fly: true,
    caps: { might: 55, nurture: 30, instinct: 75, wit: 50, wing: 80 }, sig: { name: 'Keen Eye', vals: [8, 13, 20], d: v => `+${v}% critical hit chance.` }, where: 'Brindlewood' },
  flitbat: { id: 'flitbat', el: 'gale', names: ['Flitbat', 'Duskflit', 'Nightsquall'], shape: 'bat', pal: { a: '#5b4a7a', b: '#c9a8ff', c: '#1a1226' }, fly: true,
    caps: { might: 75, nurture: 25, instinct: 55, wit: 45, wing: 85 }, sig: { name: 'Leech Wing', vals: [5, 8, 12], d: v => `Heal for ${v}% of damage you deal.` }, where: 'Rare: Brindlewood, at night' },
};
export const STARTERS = ['sparkit', 'puddlewog', 'pebbleshell', 'fluffowl'];
export const EVO = [null, { lvl: 6, ess: 2 }, { lvl: 12, ess: 4 }] as const;

export interface TalentDef { id: string; name: string; d: string; job: 'combat' | 'garden' | 'forage' | 'cauldron' | 'broom' | 'any' }
export const TALENTS: TalentDef[] = [
  { id: 'greenpaw', name: 'Green Paw', d: 'Garden job: +1 crop quality chance.', job: 'garden' },
  { id: 'rainmaker', name: 'Rainmaker', d: 'Garden job: waters 2 extra plots.', job: 'garden' },
  { id: 'truffle', name: 'Truffle Snout', d: 'Forage job: rare finds more often.', job: 'forage' },
  { id: 'packrat', name: 'Pack Rat', d: 'Forage job: +1 item each morning.', job: 'forage' },
  { id: 'steadystir', name: 'Steady Stir', d: 'Cauldron job: +1 brew quality point.', job: 'cauldron' },
  { id: 'alembic', name: 'Alembic Mind', d: 'Cauldron job: 25% chance of an extra potion.', job: 'cauldron' },
  { id: 'tailwind', name: 'Tailwind', d: 'Companion: +12% broom speed.', job: 'broom' },
  { id: 'featherweight', name: 'Featherweight', d: 'Companion: broom stamina drains 25% slower.', job: 'broom' },
  { id: 'fierce', name: 'Fierce', d: 'Companion: +15% damage (yours and its).', job: 'combat' },
  { id: 'thickhide', name: 'Thick Hide', d: 'Companion: +8 Ward.', job: 'combat' },
  { id: 'brighteyes', name: 'Bright Eyes', d: 'Companion: +25% light radius at night.', job: 'any' },
  { id: 'lucky', name: 'Lucky', d: 'Companion: +15% gold from enemies.', job: 'combat' },
  { id: 'quickstudy', name: 'Quick Study', d: 'Earns 30% more XP in any role.', job: 'any' },
  { id: 'fertile', name: 'Fertile', d: 'Breeding: better potential rolls and mutation odds.', job: 'any' },
];
export const TALENT: Record<string, TalentDef> = Object.fromEntries(TALENTS.map(t => [t.id, t]));

export type Job = 'companion' | 'garden' | 'forage' | 'cauldron' | 'rest';
export const JOB_INFO: Record<Job, { name: string; stat?: FStat; d: string }> = {
  companion: { name: 'Companion', stat: 'might', d: 'Travels and fights with you, rides your broom.' },
  garden: { name: 'Garden', stat: 'nurture', d: 'Waters plots every morning and raises crop quality.' },
  forage: { name: 'Forage', stat: 'instinct', d: 'Brings back ingredients every morning.' },
  cauldron: { name: 'Cauldron', stat: 'wit', d: 'Helps you brew: adds quality points.' },
  rest: { name: 'Resting', d: 'Naps in the roost.' },
};
