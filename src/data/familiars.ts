export type Element = 'ember' | 'tide' | 'stone' | 'gale' | 'spirit';
export const ELEMENTS: Element[] = ['ember', 'tide', 'stone', 'gale', 'spirit'];
export const ELEMENT_INFO: Record<Element, { name: string; col: string; light: string; infuse: string }> = {
  ember: { name: 'Ember', col: '#f07a3a', light: '#ffd166', infuse: 'Your skills can set enemies ablaze.' },
  tide: { name: 'Tide', col: '#3fa7d6', light: '#a6e4ff', infuse: 'Your skills slow enemies, and your familiar mends you.' },
  stone: { name: 'Stone', col: '#c09a60', light: '#ead2a2', infuse: 'Your skills knock enemies back; you gain Ward.' },
  gale: { name: 'Gale', col: '#7fd1a0', light: '#d6ffe6', infuse: 'Your skills crit more often, and you move faster.' },
  spirit: { name: 'Spirit', col: '#9ad8e8', light: '#ecfcff', infuse: 'Your skills drain a little life and pierce shields.' },
};
/** The element wheel: each element beats two and loses to two. */
export const BEATS: Record<Element, Element[]> = {
  tide: ['ember', 'stone'], ember: ['gale', 'spirit'], stone: ['ember', 'gale'], gale: ['tide', 'spirit'], spirit: ['stone', 'tide'],
};
export const ADV = 1.5, DISADV = 0.67;
export function effMult(att: Element | undefined | null, def: Element | undefined | null): number {
  if (!att || !def) return 1; if (BEATS[att].includes(def)) return ADV; if (BEATS[def].includes(att)) return DISADV; return 1;
}

export const FSTATS = ['might', 'nurture', 'instinct', 'wit', 'wing'] as const;
export type FStat = typeof FSTATS[number];
export const FSTAT_INFO: Record<FStat, { name: string; job: string }> = {
  might: { name: 'Might', job: 'Combat: familiar attacks and its ability' },
  nurture: { name: 'Nurture', job: 'Garden: plots watered, crop quality' },
  instinct: { name: 'Instinct', job: 'Forage: items found, rarity' },
  wit: { name: 'Wit', job: 'Cauldron: brew quality' },
  wing: { name: 'Wing', job: 'Broom speed while in your party' },
};

export type ActiveKind = 'flamedash' | 'swarm' | 'bubble' | 'lash' | 'bastion' | 'burrow' | 'dive' | 'screech' | 'phase' | 'lantern';
export interface ActiveDef { name: string; kind: ActiveKind; cd: number; d: string }
export interface SpeciesDef {
  id: string; el: Element; names: [string, string, string]; caps: Record<FStat, number>;
  sig: { name: string; vals: [number, number, number]; d: (v: number) => string };
  evo: { name: string; d: string }; act: ActiveDef; where: string; fly: boolean; rarity: number; lure?: string;
}
export const SPECIES: Record<string, SpeciesDef> = {
  sparkit: { id: 'sparkit', el: 'ember', names: ['Sparkit', 'Cinderfox', 'Pyrevix'], fly: false, rarity: 1, where: 'Brindlewood clearings',
    caps: { might: 80, nurture: 30, instinct: 55, wit: 50, wing: 45 }, sig: { name: 'Kindle', vals: [20, 30, 40], d: v => `${v}% chance on hit to set enemies ablaze.` },
    evo: { name: 'Pyre Heart', d: 'Burning enemies take 25% more damage from you.' }, act: { name: 'Flame Dash', kind: 'flamedash', cd: 8, d: 'Dash toward the cursor, leaving a trail of fire.' } },
  wickmoth: { id: 'wickmoth', el: 'ember', names: ['Wickmoth', 'Lanternmoth', 'Solarwing'], fly: true, rarity: 2, where: 'Brindlewood, at night',
    caps: { might: 50, nurture: 40, instinct: 45, wit: 80, wing: 70 }, sig: { name: 'Ashfeed', vals: [4, 7, 10], d: v => `Each kill restores ${v} MP.` },
    evo: { name: 'Sunlit Wings', d: 'Light radius +50%, and enemies deal 15% less damage at night.' }, act: { name: 'Ember Swarm', kind: 'swarm', cd: 12, d: 'Release three embers that orbit you and seek enemies.' } },
  puddlewog: { id: 'puddlewog', el: 'tide', names: ['Puddlewog', 'Rillhopper', 'Deluge Toad'], fly: false, rarity: 1, where: 'Near water in Brindlewood',
    caps: { might: 45, nurture: 85, instinct: 45, wit: 55, wing: 30 }, sig: { name: 'Mire Mend', vals: [0.4, 0.7, 1], d: v => `Regenerate ${v}% of max HP per second.` },
    evo: { name: 'Downpour', d: 'All your healing is 30% stronger.' }, act: { name: 'Bubble Ward', kind: 'bubble', cd: 16, d: 'A bubble absorbs damage equal to 30% of your HP for 6s. It bursts and slows when broken.' } },
  driftjel: { id: 'driftjel', el: 'tide', names: ['Driftjel', 'Glimmerjel', 'Abyssal Bell'], fly: true, rarity: 3, where: 'Lured: offer Moonpetal at the pond shrine at night', lure: 'moonpetal',
    caps: { might: 55, nurture: 60, instinct: 40, wit: 75, wing: 55 }, sig: { name: 'Numbing Sting', vals: [1.5, 2.5, 3.5], d: v => `Hits slow enemies by 45% for ${v}s.` },
    evo: { name: 'Pressure', d: 'Slowed enemies take 20% more damage.' }, act: { name: 'Tidal Lash', kind: 'lash', cd: 10, d: 'A tentacle sweep that drags enemies toward you and slows them.' } },
  pebbleshell: { id: 'pebbleshell', el: 'stone', names: ['Pebbleshell', 'Mossback', 'Cairnback'], fly: false, rarity: 1, where: 'Brindlewood, by the road',
    caps: { might: 70, nurture: 75, instinct: 35, wit: 40, wing: 15 }, sig: { name: 'Brambleshell', vals: [25, 40, 60], d: v => `Reflect ${v}% of melee damage to attackers.` },
    evo: { name: 'Bedrock', d: 'Take 12% less damage. Nets and knockback cannot move you.' }, act: { name: 'Shell Bastion', kind: 'bastion', cd: 14, d: 'For 3s you cannot be moved, enemy projectiles shatter on you, and nearby foes are taunted.' } },
  dirtnib: { id: 'dirtnib', el: 'stone', names: ['Dirtnib', 'Delvemole', 'Quakemaw'], fly: false, rarity: 1, where: 'Brindlewood',
    caps: { might: 55, nurture: 60, instinct: 85, wit: 35, wing: 15 }, sig: { name: 'Prospector', vals: [30, 50, 75], d: v => `+${v}% gold, and more gear drops.` },
    evo: { name: 'Seismic Sense', d: 'Your dodge roll ends in a tremor that stuns nearby enemies.' }, act: { name: 'Burrow Strike', kind: 'burrow', cd: 10, d: 'Your familiar tunnels to the cursor and erupts, stunning everything nearby.' } },
  fluffowl: { id: 'fluffowl', el: 'gale', names: ['Fluffowl', 'Galehoot', 'Stormstrix'], fly: true, rarity: 1, where: 'Brindlewood',
    caps: { might: 55, nurture: 30, instinct: 75, wit: 50, wing: 80 }, sig: { name: 'Keen Eye', vals: [8, 13, 20], d: v => `+${v}% critical hit chance.` },
    evo: { name: 'Stormcall', d: 'Critical hits arc lightning to a nearby enemy.' }, act: { name: 'Gale Dive', kind: 'dive', cd: 9, d: 'Your owl dives at the cursor, blasting enemies away and exposing them to crits.' } },
  flitbat: { id: 'flitbat', el: 'gale', names: ['Flitbat', 'Duskflit', 'Nightsquall'], fly: true, rarity: 2, where: 'Brindlewood, at night',
    caps: { might: 75, nurture: 25, instinct: 55, wit: 45, wing: 85 }, sig: { name: 'Leech Wing', vals: [5, 8, 12], d: v => `Heal for ${v}% of damage you deal.` },
    evo: { name: 'Blood Moon', d: 'At night you deal 20% more damage and your life-steal doubles.' }, act: { name: 'Night Screech', kind: 'screech', cd: 14, d: 'A screech that terrifies nearby enemies for 2s and drains their life.' } },
  gloamkit: { id: 'gloamkit', el: 'spirit', names: ['Gloamkit', 'Duskmalkin', 'Veilcat'], fly: false, rarity: 3, where: 'Lured: offer Glowmoss at the glade shrine at night', lure: 'glowmoss',
    caps: { might: 70, nurture: 45, instinct: 70, wit: 55, wing: 60 }, sig: { name: 'Shadowstep', vals: [10, 15, 22], d: v => `${v}% chance to dodge an attack outright.` },
    evo: { name: 'Nine Lives', d: 'Once per day, survive a fatal blow with 1 HP and vanish for 2s.' }, act: { name: 'Phase Step', kind: 'phase', cd: 10, d: 'Blink to the cursor through anything, leaving a spirit decoy that draws attacks.' } },
  wisplet: { id: 'wisplet', el: 'spirit', names: ['Wisplet', 'Wanderwisp', 'Soulbrazier'], fly: true, rarity: 3, where: 'Lured: offer Starbloom at the glade shrine at night', lure: 'starbloom',
    caps: { might: 50, nurture: 70, instinct: 60, wit: 80, wing: 65 }, sig: { name: 'Will-o\'-Light', vals: [20, 30, 45], d: v => `Light radius +${v}%, and glimmer forage shows from farther away.` },
    evo: { name: 'Afterglow', d: 'Defeated enemies leave soul motes that restore 3% HP and MP.' }, act: { name: 'Soul Lantern', kind: 'lantern', cd: 18, d: 'Plant a lantern for 8s that heals you nearby and burns enemies with spirit fire.' } },
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
  { id: 'tailwind', name: 'Tailwind', d: 'In party: +12% broom speed.', job: 'broom' },
  { id: 'featherweight', name: 'Featherweight', d: 'In party: broom stamina drains 25% slower.', job: 'broom' },
  { id: 'fierce', name: 'Fierce', d: 'Active: +15% damage (yours and its).', job: 'combat' },
  { id: 'thickhide', name: 'Thick Hide', d: 'Active: +8 Ward.', job: 'combat' },
  { id: 'brighteyes', name: 'Bright Eyes', d: 'Active: +25% light radius at night.', job: 'any' },
  { id: 'lucky', name: 'Lucky', d: 'Active: +15% gold from enemies.', job: 'combat' },
  { id: 'quickstudy', name: 'Quick Study', d: 'Earns 30% more XP in any role.', job: 'any' },
  { id: 'fertile', name: 'Fertile', d: 'Breeding: better potential rolls and mutation odds.', job: 'any' },
  { id: 'eager', name: 'Eager', d: 'Active: its ability recharges 20% faster.', job: 'combat' },
  { id: 'loyal', name: 'Loyal', d: 'Party: swapping to it has no cooldown.', job: 'combat' },
];
export const TALENT: Record<string, TalentDef> = Object.fromEntries(TALENTS.map(t => [t.id, t]));

export type Job = 'party' | 'garden' | 'forage' | 'cauldron' | 'rest';
export const JOB_INFO: Record<Job, { name: string; stat?: FStat; d: string }> = {
  party: { name: 'Party', stat: 'might', d: 'Travels with you (up to 3). The active one fights beside you and lends its ability.' },
  garden: { name: 'Garden', stat: 'nurture', d: 'Waters plots every morning and raises crop quality.' },
  forage: { name: 'Forage', stat: 'instinct', d: 'Brings back ingredients every morning.' },
  cauldron: { name: 'Cauldron', stat: 'wit', d: 'Helps you brew: adds quality points.' },
  rest: { name: 'Resting', d: 'Naps in the roost.' },
};
export const PARTY_MAX = 3;
