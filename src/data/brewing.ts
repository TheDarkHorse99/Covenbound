// Aspects, ingredients, crops and potion recipes.
export const ASPECTS = ['vita', 'arcana', 'bane', 'swift', 'ward', 'lumen', 'verdant', 'kin'] as const;
export type Aspect = typeof ASPECTS[number];
export const ASPECT_INFO: Record<Aspect, { name: string; col: string; hint: string }> = {
  vita: { name: 'Vita', col: '#e0484f', hint: 'life and healing' },
  arcana: { name: 'Arcana', col: '#4f8fe0', hint: 'mana and spellwork' },
  bane: { name: 'Bane', col: '#a25ad6', hint: 'poison and harm' },
  swift: { name: 'Swift', col: '#6fe0c8', hint: 'speed' },
  ward: { name: 'Ward', col: '#c09a60', hint: 'protection' },
  lumen: { name: 'Lumen', col: '#ffe08a', hint: 'light and purity' },
  verdant: { name: 'Verdant', col: '#5cbf4a', hint: 'growth' },
  kin: { name: 'Kin', col: '#f08ac0', hint: 'bonds between creatures' },
};

export type IngSource = 'crop' | 'forage' | 'drop';
export interface IngredientDef {
  id: string; name: string; icon: string; a: string; b: string; asp: Partial<Record<Aspect, number>>;
  price: number; source: IngSource; glimmer?: boolean; desc: string;
}
export const INGREDIENTS: IngredientDef[] = [
  // crops
  { id: 'mandrake', name: 'Mandrake', icon: 'root', a: '#c9a070', b: '#5cbf4a', asp: { vita: 4, kin: 1, bane: 1 }, price: 18, source: 'crop', desc: 'A grumbling root. The backbone of healing brews.' },
  { id: 'moonpetal', name: 'Moonpetal', icon: 'petal', a: '#bcd4ff', b: '#4f8fe0', asp: { arcana: 4, lumen: 2 }, price: 22, source: 'crop', desc: 'Opens only under starlight.' },
  { id: 'bitterleaf', name: 'Bitterleaf', icon: 'leaf', a: '#6a9a3a', b: '#a25ad6', asp: { bane: 4, verdant: 1 }, price: 12, source: 'crop', desc: 'Fast-growing and foul-tasting.' },
  { id: 'sunroot', name: 'Sunroot', icon: 'root', a: '#f2c14e', b: '#e07a30', asp: { swift: 3, vita: 2 }, price: 20, source: 'crop', desc: 'Warm to the touch. Makes the legs restless.' },
  { id: 'ironthistle', name: 'Ironthistle', icon: 'thistle', a: '#8a8aa0', b: '#b06ad6', asp: { ward: 4, bane: 1 }, price: 24, source: 'crop', desc: 'Its spines can turn a knife.' },
  { id: 'sweetbriar', name: 'Sweetbriar', icon: 'berry', a: '#f08ac0', b: '#5a9a3a', asp: { kin: 3, vita: 2 }, price: 20, source: 'crop', desc: 'Familiars will do anything for these.' },
  // forage
  { id: 'dewcap', name: 'Dewcap', icon: 'mushroom', a: '#7ab0d0', b: '#e9dfc7', asp: { arcana: 2, verdant: 2 }, price: 10, source: 'forage', desc: 'A damp little mushroom that hums faintly.' },
  { id: 'wolfsbell', name: 'Wolfsbell', icon: 'flower', a: '#8a6ad6', b: '#5a9a3a', asp: { bane: 3, swift: 2 }, price: 14, source: 'forage', desc: 'Pretty, dangerous, and quick-acting.' },
  { id: 'wildsage', name: 'Wild Sage', icon: 'leaf', a: '#9ab88a', b: '#c8d8b0', asp: { ward: 2, vita: 2 }, price: 9, source: 'forage', desc: 'Smells like clean wool and rain.' },
  { id: 'featherfern', name: 'Featherfern', icon: 'fern', a: '#7fe3a0', b: '#3a8a5a', asp: { swift: 4, arcana: 1 }, price: 13, source: 'forage', desc: 'So light it drifts upward when dropped.' },
  { id: 'kindleberry', name: 'Kindleberry', icon: 'berry', a: '#f07a3a', b: '#5a9a3a', asp: { kin: 3, lumen: 1 }, price: 15, source: 'forage', desc: 'Glows faintly when held by someone kind.' },
  { id: 'glowmoss', name: 'Glowmoss', icon: 'moss', a: '#b8ff9a', b: '#5cbf4a', asp: { lumen: 4, verdant: 1 }, price: 26, source: 'forage', glimmer: true, desc: 'Glimmer forage. Only visible at night inside lantern light.' },
  { id: 'starbloom', name: 'Starbloom', icon: 'star', a: '#fff1b0', b: '#b06aff', asp: { arcana: 3, lumen: 3, kin: 2 }, price: 60, source: 'forage', glimmer: true, desc: 'Rare glimmer forage. Grows where blight was cleansed.' },
  // drops
  { id: 'blightgel', name: 'Blight Gel', icon: 'gel', a: '#7aa83a', b: '#3a2a4a', asp: { bane: 3, verdant: 2 }, price: 8, source: 'drop', desc: 'Jelly from a corrupted Mossblob. Twitches.' },
  { id: 'thornquill', name: 'Thorn Quill', icon: 'quill', a: '#b8c86a', b: '#6a4a2a', asp: { swift: 3, bane: 2 }, price: 10, source: 'drop', desc: 'Shed by Thornrats.' },
  { id: 'heartsap', name: 'Heartwood Sap', icon: 'sap', a: '#e0a040', b: '#7a4a1a', asp: { verdant: 4, ward: 2 }, price: 16, source: 'drop', desc: 'Amber sap from a Snagstump.' },
  { id: 'rotfeather', name: 'Rot Feather', icon: 'quill', a: '#3a3a4a', b: '#8a6ad6', asp: { swift: 2, bane: 2, lumen: 1 }, price: 12, source: 'drop', desc: 'A Rotcrow feather, black at the root.' },
  { id: 'emberchitin', name: 'Ember Chitin', icon: 'salt', a: '#c0502a', b: '#ffd166', asp: { ward: 2, lumen: 2, swift: 1 }, price: 14, source: 'drop', desc: 'A warm shell plate from a Cinder Beetle.' },
  { id: 'argentsalt', name: 'Argent Salt', icon: 'salt', a: '#f4f4ff', b: '#c8d0e8', asp: { ward: 3, lumen: 3 }, price: 30, source: 'drop', desc: 'The Order blesses it and calls it holy. It is also very good at cleansing rot.' },
  { id: 'saffron', name: 'Smuggled Saffron', icon: 'spice', a: '#f2a83a', b: '#c0402a', asp: { vita: 2, arcana: 2, lumen: 1 }, price: 40, source: 'drop', desc: 'Stolen goods from a Roadcutter pack.' },
  { id: 'familiardown', name: 'Familiar Down', icon: 'down', a: '#ffffff', b: '#f08ac0', asp: { kin: 4 }, price: 25, source: 'drop', desc: 'Soft fluff left behind by a familiar.' },
  { id: 'rootmawheart', name: 'Rootmaw Heart', icon: 'heart', a: '#8a3a2a', b: '#5cbf4a', asp: { verdant: 6, vita: 4 }, price: 150, source: 'drop', desc: 'Still beats, slowly.' },
];
export const ING: Record<string, IngredientDef> = Object.fromEntries(INGREDIENTS.map(i => [i.id, i]));

export interface CropDef { id: string; ing: string; seedName: string; days: number; regrow?: number; seedPrice: number; leaf: string; fruit: string; desc: string }
export const CROPS: CropDef[] = [
  { id: 'mandrake', ing: 'mandrake', seedName: 'Mandrake Seeds', days: 4, seedPrice: 10, leaf: '#5cbf4a', fruit: '#c9a070', desc: '4 days.' },
  { id: 'bitterleaf', ing: 'bitterleaf', seedName: 'Bitterleaf Seeds', days: 2, seedPrice: 6, leaf: '#6a9a3a', fruit: '#a25ad6', desc: '2 days.' },
  { id: 'moonpetal', ing: 'moonpetal', seedName: 'Moonpetal Seeds', days: 5, seedPrice: 14, leaf: '#4f8a6a', fruit: '#bcd4ff', desc: '5 days.' },
  { id: 'sunroot', ing: 'sunroot', seedName: 'Sunroot Seeds', days: 3, seedPrice: 12, leaf: '#7ab83a', fruit: '#f2c14e', desc: '3 days.' },
  { id: 'ironthistle', ing: 'ironthistle', seedName: 'Ironthistle Seeds', days: 5, seedPrice: 16, leaf: '#6a7a6a', fruit: '#b06ad6', desc: '5 days.' },
  { id: 'sweetbriar', ing: 'sweetbriar', seedName: 'Sweetbriar Seeds', days: 6, regrow: 3, seedPrice: 18, leaf: '#4a8a3a', fruit: '#f08ac0', desc: '6 days, then fruits every 3 days.' },
];
export const CROP: Record<string, CropDef> = Object.fromEntries(CROPS.map(c => [c.id, c]));

export type PotionUse = 'drink' | 'throw' | 'crop' | 'breed' | 'cleanse' | 'none';
export interface PotionDef { id: string; name: string; asp: Aspect[]; col: string; use: PotionUse; price: number; desc: (tier: number) => string }
const T4 = (a: number[], t: number) => a[Math.max(0, Math.min(3, t - 1))];
export const TIER_NAMES = ['', 'Weak', 'Standard', 'Fine', 'Masterwork'];
export const TIER_MULT = [0, 0.6, 1, 1.6, 2.5];
export const POTIONS: PotionDef[] = [
  { id: 'healing', name: 'Healing Draught', asp: ['vita'], col: '#e0484f', use: 'drink', price: 30, desc: t => `Restore ${T4([25, 40, 55, 75], t)}% HP.` },
  { id: 'mana', name: 'Mana Tonic', asp: ['arcana'], col: '#4f8fe0', use: 'drink', price: 30, desc: t => `Restore ${T4([30, 50, 70, 100], t)}% MP.` },
  { id: 'baneflask', name: 'Bane Flask', asp: ['bane'], col: '#a25ad6', use: 'throw', price: 28, desc: t => `Throw: poison cloud dealing ${T4([8, 14, 22, 34], t)} damage per second for 4s.` },
  { id: 'quickstep', name: 'Quickstep Elixir', asp: ['swift'], col: '#6fe0c8', use: 'drink', price: 32, desc: t => `+${T4([15, 25, 35, 50], t)}% move and broom speed for 2 minutes.` },
  { id: 'wardskin', name: 'Wardskin Brew', asp: ['ward'], col: '#c09a60', use: 'drink', price: 34, desc: t => `Take ${T4([15, 25, 35, 45], t)}% less damage for 90s.` },
  { id: 'glimmer', name: 'Glimmer Tincture', asp: ['lumen'], col: '#ffe08a', use: 'drink', price: 36, desc: t => `Light radius +${T4([30, 50, 70, 100], t)}% and glimmer forage visible for 3 minutes.` },
  { id: 'growth', name: 'Growth Tonic', asp: ['verdant'], col: '#5cbf4a', use: 'crop', price: 30, desc: t => `Use on a crop: +${T4([1, 1, 2, 2], t)} growth day${t > 2 ? ', +1 quality' : ''}.` },
  { id: 'kinship', name: 'Kinship Draught', asp: ['kin'], col: '#f08ac0', use: 'breed', price: 45, desc: t => `Needed to breed familiars. Offspring potentials +${T4([0, 3, 6, 10], t)}.` },
  { id: 'clarity', name: 'Clarity Brew', asp: ['vita', 'arcana'], col: '#b07ae0', use: 'drink', price: 48, desc: t => `Restore ${T4([20, 30, 40, 55], t)}% HP and MP.` },
  { id: 'stoneheart', name: 'Stoneheart Draught', asp: ['vita', 'ward'], col: '#d08a60', use: 'drink', price: 50, desc: t => `Heal ${T4([30, 45, 60, 80], t)}% HP over 10s and take 20% less damage.` },
  { id: 'hexfire', name: 'Hexfire Flask', asp: ['bane', 'arcana'], col: '#e05a9a', use: 'throw', price: 52, desc: t => `Throw: burst for ${T4([40, 70, 110, 170], t)} damage.` },
  { id: 'haste', name: 'Haste Philter', asp: ['swift', 'arcana'], col: '#7ad0f0', use: 'drink', price: 50, desc: t => `Skill cooldowns ${T4([15, 22, 30, 40], t)}% faster for 90s.` },
  { id: 'bloomwater', name: 'Bloomwater', asp: ['verdant', 'vita'], col: '#7ae07a', use: 'crop', price: 46, desc: t => `Waters a 3×3 area and grows it +1 day${t > 2 ? ', +1 quality' : ''}.` },
  { id: 'fondness', name: 'Fondness Tea', asp: ['kin', 'vita'], col: '#f0a0a0', use: 'drink', price: 40, desc: t => `Your companion familiar gains ${T4([1.5, 2, 2.5, 3], t)}× XP until you sleep.` },
  { id: 'cleansing', name: 'Cleansing Draught', asp: ['lumen', 'ward'], col: '#f4f4ff', use: 'cleanse', price: 60, desc: t => `Use on blight: purifies a radius of ${T4([1, 2, 2, 3], t)} tiles.` },
  { id: 'thornmail', name: 'Thornmail Tonic', asp: ['bane', 'ward'], col: '#8a7a50', use: 'drink', price: 48, desc: t => `Reflect ${T4([20, 30, 40, 55], t)}% of melee damage for 90s.` },
  { id: 'murky', name: 'Murky Brew', asp: [], col: '#5a5048', use: 'none', price: 3, desc: () => 'A failed brew. Sells for almost nothing.' },
];
export const POTION: Record<string, PotionDef> = Object.fromEntries(POTIONS.map(p => [p.id, p]));
export const potionTierVal = T4;

export type Method = 'simmer' | 'boil' | 'steep' | 'distill';
export const METHODS: Record<Method, { name: string; desc: string; game: string }> = {
  simmer: { name: 'Simmer', desc: 'Balanced. Small quality bonus.', game: 'Keep the heat in the band: hold Space to stoke the fire.' },
  boil: { name: 'Boil', desc: 'Strongest aspect ×1.3, all others ×0.5. For pure brews.', game: 'Skim the foam: press the key shown on each bubble (or click it) before it bursts.' },
  steep: { name: 'Steep', desc: 'Second-strongest aspect ×1.5. For two-aspect brews.', game: 'Pull the brew: press Space when its colour matches the target.' },
  distill: { name: 'Distill', desc: 'Removes every aspect weaker than a quarter of the strongest.', game: 'Stir in time: press Space when the spoon is in the gold band.' },
};

export interface BrewInput { id: string; q: number }
export interface BrewResult { potion: string; tier: number; count: number; totals: Record<Aspect, number>; primary?: Aspect; secondary?: Aspect; score: number; purity: number }

/** Pure function: resolves a brew. stirScore is 0..3, bonus is skill + familiar + gear quality points. */
export function resolveBrew(inputs: BrewInput[], method: Method, stirScore: number, bonus: number, extraYieldChance = 0, r = Math.random): BrewResult {
  const qm = [1, 1, 1.25, 1.5];
  const tot = Object.fromEntries(ASPECTS.map(a => [a, 0])) as Record<Aspect, number>;
  for (const inp of inputs) { const d = ING[inp.id]; if (!d) continue; for (const k in d.asp) tot[k as Aspect] += (d.asp[k as Aspect] || 0) * qm[inp.q] ; }
  const rank = () => ASPECTS.slice().sort((a, b) => tot[b] - tot[a]);
  let order = rank();
  if (method === 'boil') { const p = order[0]; for (const a of ASPECTS) tot[a] = a === p ? tot[a] * 1.3 : tot[a] * 0.5; }
  if (method === 'steep') { tot[order[1]] *= 1.5; }
  if (method === 'distill') { const top = tot[order[0]]; for (const a of ASPECTS) if (tot[a] < top * 0.25) tot[a] = 0; }
  order = rank();
  const p = order[0], s = order[1];
  const total = ASPECTS.reduce((acc, a) => acc + tot[a], 0);
  const count = inputs.length >= 3 ? 2 : 1;
  const yieldN = count + (r() < extraYieldChance ? 1 : 0);
  if (tot[p] < 3) return { potion: 'murky', tier: 1, count: yieldN, totals: tot, score: 0, purity: 0 };
  let potion: PotionDef | undefined; let secondary: Aspect | undefined;
  if (tot[s] >= 2 && tot[s] >= tot[p] * 0.4) {
    potion = POTIONS.find(x => x.asp.length === 2 && x.asp.includes(p) && x.asp.includes(s));
    if (potion) secondary = s;
  }
  if (!potion) potion = POTIONS.find(x => x.asp.length === 1 && x.asp[0] === p)!;
  const recipeSum = tot[p] + (secondary ? tot[secondary] : 0);
  const purity = total > 0 ? recipeSum / total : 0;
  if (purity < 0.45) return { potion: 'murky', tier: 1, count: yieldN, totals: tot, primary: p, score: 0, purity };
  const potency = tot[p] + (secondary ? tot[secondary] * 0.6 : 0);
  const score = potency * 0.55 * purity + stirScore + bonus + (method === 'simmer' ? 0.8 : 0);
  const tier = score < 4 ? 1 : score < 7 ? 2 : score < 10 ? 3 : 4;
  return { potion: potion.id, tier, count: yieldN, totals: tot, primary: p, secondary, score, purity };
}
