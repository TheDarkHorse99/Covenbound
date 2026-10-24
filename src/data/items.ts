// Master registry for stackable items (ingredients, seeds, potions, tools, misc).
import { INGREDIENTS, CROPS, POTIONS, ING, POTION, TIER_MULT } from './brewing';
import { ELEMENTS, ELEMENT_INFO } from './familiars';

export type ItemKind = 'ingredient' | 'seed' | 'potion' | 'tool' | 'misc' | 'essence';
export interface ItemDef { id: string; name: string; kind: ItemKind; price: number; desc: string; sellable: boolean; stack: boolean }
export const ITEMS: Record<string, ItemDef> = {};
for (const i of INGREDIENTS) ITEMS[i.id] = { id: i.id, name: i.name, kind: 'ingredient', price: i.price, desc: i.desc, sellable: true, stack: true };
for (const c of CROPS) ITEMS['seed_' + c.id] = { id: 'seed_' + c.id, name: c.seedName, kind: 'seed', price: c.seedPrice, desc: `Plant in tilled soil. ${c.desc}`, sellable: true, stack: true };
for (const p of POTIONS) ITEMS['p_' + p.id] = { id: 'p_' + p.id, name: p.name, kind: 'potion', price: p.price, desc: '', sellable: true, stack: true };
ITEMS.hoe = { id: 'hoe', name: 'Hoe', kind: 'tool', price: 0, desc: 'Till soil in your garden field.', sellable: false, stack: false };
ITEMS.can = { id: 'can', name: 'Watering Can', kind: 'tool', price: 0, desc: 'Water tilled soil and crops.', sellable: false, stack: false };
ITEMS.wand = { id: 'wand', name: 'Your Craft', kind: 'tool', price: 0, desc: "Click to use your Craft's basic attack.", sellable: false, stack: false };
ITEMS.charm = { id: 'charm', name: 'Binding Charm', kind: 'misc', price: 25, desc: 'Press E beside a dazed wild familiar to bind it.', sellable: true, stack: true };
for (const e of ELEMENTS) ITEMS['ess_' + e] = { id: 'ess_' + e, name: `${ELEMENT_INFO[e].name} Essence`, kind: 'essence', price: 20, desc: `Evolves ${ELEMENT_INFO[e].name} familiars.`, sellable: true, stack: true };

export function itemName(id: string, q = 0): string {
  const d = ITEMS[id]; if (!d) return id;
  if (d.kind === 'potion') return d.name;
  return d.name;
}
export function sellPrice(id: string, q: number): number {
  const d = ITEMS[id]; if (!d) return 0;
  if (d.kind === 'potion') return Math.max(1, Math.round(POTION[id.slice(2)].price * TIER_MULT[Math.max(1, q)] * 0.6));
  if (d.kind === 'ingredient') return Math.max(1, Math.round(ING[id].price * [1, 1, 1.25, 1.5][Math.max(1, q)] * 0.5));
  return Math.max(1, Math.round(d.price * 0.5));
}
