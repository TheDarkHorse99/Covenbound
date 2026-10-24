import type { Slot } from './gear';
import type { Element, FStat } from './familiars';

export type Step =
  | { t: 'harvest'; n: number; d: string }
  | { t: 'gather'; item: string; n: number; minQ?: number; d: string }
  | { t: 'brew'; potion: string; n: number; minTier?: number; d: string }
  | { t: 'kill'; n: number; faction?: string; enemy?: string; el?: Element; elite?: boolean; withEl?: Element; adv?: boolean; d: string }
  | { t: 'bind'; n: number; sp?: string; el?: Element; d: string }
  | { t: 'breed'; n: number; stat?: FStat; min?: number; d: string }
  | { t: 'boss'; id: string; d: string }
  | { t: 'explore'; place: string; d: string }
  | { t: 'escort'; d: string }
  | { t: 'defend'; waves: number; d: string }
  | { t: 'comfort'; n: number; d: string }
  | { t: 'talk'; npc: string; d: string };
export interface Reward { gold?: number; items?: [string, number, number][]; gear?: { slot: Slot; lvl: number; rar: number }; flags?: string[]; part?: string; furniture?: string[] }
export interface QuestDef {
  id: string; title: string; kind: 'main' | 'side' | 'bounty'; giver: string; text: string; hint: string; steps: Step[]; done: string; reward: Reward;
  req?: { quests?: string[]; flags?: string[] }; onAccept?: string[];
}
export const NPC_NAMES: Record<string, string> = { pip: 'Pip', wren: 'Grandmother Wren', marrow: 'Marrow', hettie: 'Hettie', corwin: 'Corwin', tamsin: 'Tamsin', ysolde: 'Ysolde', bram: 'Bram', board: 'Order board' };

export const QUESTS: QuestDef[] = [
  // ---------------- main ----------------
  { id: 'q1', kind: 'main', giver: 'wren', title: 'Roots and Rows',
    text: 'Every witch starts in the dirt. Till your field with the hoe, plant the seeds I left you, water them each day, and bring in three crops.',
    hint: 'Select the Hoe (2) and click soil in your fenced field. Then plant seeds and water with the Can (3). Sleep in your bed to pass the day. Bitterleaf is ready in 2 days.',
    steps: [{ t: 'harvest', n: 3, d: 'Harvest 3 crops' }],
    done: 'Good dirt under your nails already. Take these seeds. Sunroot makes quick feet, and Moonpetal makes for deep mana.',
    reward: { gold: 60, items: [['seed_sunroot', 0, 4], ['seed_moonpetal', 0, 3]] } },
  { id: 'q2', kind: 'main', giver: 'wren', title: 'Rot in the Brindlewood', req: { quests: ['q1'] },
    text: 'Something is rotting the Brindlewood, east past the village. The beasts there have gone purple and mean. They telegraph their blows; learn to roll out of the way. Put down six of them.',
    hint: 'Head east through Hollowmere. Watch for the red flash before an enemy strikes, and press Space to roll through it.',
    steps: [{ t: 'kill', n: 6, faction: 'corrupt', d: 'Defeat 6 corrupted beasts' }],
    done: 'You came back in one piece. Binding Charms, and two Mandrake roots from my own patch. You will want them for your first brew.',
    reward: { gold: 50, items: [['charm', 0, 3], ['mandrake', 2, 2]] } },
  { id: 'q3', kind: 'main', giver: 'wren', title: 'The First Brew', req: { quests: ['q2'] },
    text: 'Now the cauldron. Mandrake is full of Vita, with a little Kin and Bane. Boil it to burn those away. Boiling means skimming the foam, so keep your eyes on the pot.',
    hint: 'Use the cauldron beside your cottage. Add Mandrake, choose Boil, and skim the foam bubbles as they rise.',
    steps: [{ t: 'brew', potion: 'healing', n: 1, d: 'Brew a Healing Draught' }],
    done: 'A real draught. Hollowmere has an order board by the well now, and Bram the carpenter has set up by the stalls.',
    reward: { gold: 80, items: [['seed_mandrake', 0, 4]], flags: ['orders', 'bram'] } },
  { id: 'q4', kind: 'main', giver: 'wren', title: 'A Kindred Spirit', req: { quests: ['q3'] },
    text: 'One familiar is a friend. A coven of them is a household. Wear a wild one down until it is dazed, then bind it. The binding is a struggle of wills: hold it inside your circle.',
    hint: 'Wild familiars have gold names. Hit one until it shows "dazed", then press E beside it to start the binding ritual.',
    steps: [{ t: 'bind', n: 1, d: 'Bind a wild familiar' }],
    done: 'Welcome to the household, little one. Up to three familiars can travel with you now. Press T to swap the one at your side.',
    reward: { gold: 40, items: [['seed_sweetbriar', 0, 3], ['charm2', 0, 2]], flags: ['crafts'] } },
  { id: 'q5', kind: 'main', giver: 'wren', title: 'The Wheel of Elements', req: { quests: ['q4'] },
    text: 'Tide drowns Ember and wears down Stone. Ember burns Gale and banishes Spirit. Stone smothers Ember and breaks Gale. Gale scatters Tide and Spirit. Spirit slips through Stone and Tide. Your familiar decides which side of the wheel you stand on. Win four fights with the wheel on your side.',
    hint: 'Look at an enemy\'s element (shown by its name colour). Make a familiar that beats it your active one, then defeat 4 such enemies.',
    steps: [{ t: 'kill', n: 4, adv: true, d: 'Defeat 4 enemies with an element advantage' }],
    done: 'Now you see it. A coven that covers the wheel fears nothing.',
    reward: { gold: 90, items: [['ess_ember', 0, 1], ['ess_tide', 0, 1], ['ess_stone', 0, 1], ['ess_gale', 0, 1]] } },
  { id: 'q6', kind: 'main', giver: 'wren', title: 'New Blood', req: { quests: ['q5'] },
    text: 'Two familiars and a Kinship Draught make an egg. The young take after their parents, sometimes better. Brew the draught from Kin: Sweetbriar, Kindleberry or Familiar Down. Boil away the rest.',
    hint: 'Brew a Kinship Draught (Kin aspect), then use the nest at your roost with two familiars of Lv 3+. The egg hatches after you sleep.',
    steps: [{ t: 'breed', n: 1, d: 'Hatch an egg' }],
    done: 'A hatchling! Breed with care and you will raise familiars no wild one can match.',
    reward: { gold: 150, gear: { slot: 'charm', lvl: 4, rar: 1 } } },
  { id: 'q7', kind: 'main', giver: 'wren', title: 'Salt and Silver', req: { quests: ['q6'] }, onAccept: ['halloranActive'],
    text: 'Bad news. A hedge witch named Ysolde is hiding in the south of the Brindlewood, and the Argent Order has found her trail. Witchfinder Halloran leads them. Find her first.',
    hint: 'The hideout is south of the King\'s Road, mid-forest. Halloran is Spirit: Ember and Gale familiars break his shield of Grace.',
    steps: [{ t: 'explore', place: 'hideout', d: 'Find Ysolde\'s hideout' }, { t: 'boss', id: 'halloran', d: 'Defeat Witchfinder Halloran' }],
    done: 'Ysolde is safe in Hollowmere, thanks to you. She sent this lantern. Take the Order\'s salt too: it cleanses rot better than anything I know.',
    reward: { gold: 200, part: 'moonglass', flags: ['ysolde'] } },
  { id: 'q8', kind: 'main', giver: 'wren', title: 'The Glade Shrine', req: { quests: ['q7'] },
    text: 'There is an old shrine in the north glade of the Brindlewood. Spirit familiars answer offerings there, but the rot wants it too. Hold it while I renew the wards from here.',
    hint: 'Go to the shrine in the north glade and press E. Defend it through three waves; enemies will go for the shrine.',
    steps: [{ t: 'defend', waves: 3, d: 'Defend the glade shrine (3 waves)' }],
    done: 'The wards hold. Offer Glowmoss or Starbloom at that shrine at night, and the spirit-kin may come to you.',
    reward: { gold: 160, items: [['charm3', 0, 1], ['glowmoss', 2, 2]], flags: ['shrines'] } },
  { id: 'q9', kind: 'main', giver: 'wren', title: 'The Heart of the Rot', req: { quests: ['q8'] },
    text: 'The rot has a heart. Old Rootmaw, the eldest tree-thing of the Brindlewood, has turned. Its bark-shield shrugs off most magic; only Tide or Spirit will crack it. Cut out the heart and the forest can breathe again.',
    hint: 'The hollow is north of the road near the east end of Brindlewood. Bring a Tide or Spirit familiar, and potions.',
    steps: [{ t: 'boss', id: 'rootmaw', d: 'Defeat Old Rootmaw' }],
    done: 'The Brindlewood is breathing. You have done what the Order never could: you healed it. There are more lands like this beyond the valley, witch.',
    reward: { gold: 400, gear: { slot: 'weapon', lvl: 9, rar: 2 } } },
  // ---------------- side ----------------
  { id: 's_marrow1', kind: 'side', giver: 'marrow', title: 'Mushroom Season', req: { quests: ['q1'] },
    text: 'Dewcaps are in season and my legs are not what they were. Bring me five, any quality.', hint: 'Dewcaps grow wild at your homestead and in the Brindlewood.',
    steps: [{ t: 'gather', item: 'dewcap', n: 5, d: 'Bring 5 Dewcap to Marrow' }], done: 'Lovely and damp. Here, seeds for your trouble.', reward: { gold: 60, items: [['seed_ironthistle', 0, 3], ['seed_moonpetal', 0, 2]] } },
  { id: 's_marrow2', kind: 'side', giver: 'marrow', title: 'A Proper Pantry', req: { quests: ['q3'] },
    text: 'Folk keep coming to me hurt from that forest. Three Healing Draughts, Standard or better, would stock my shelf.', hint: 'Brew Healing Draughts at your cauldron. Quality matters: Standard or better.',
    steps: [{ t: 'gather', item: 'p_healing', n: 3, minQ: 2, d: 'Bring 3 Standard+ Healing Draughts' }], done: 'That will save a life or two. Take these silver charms; they hold a familiar far better than twine.', reward: { gold: 80, items: [['charm2', 0, 3]] } },
  { id: 's_hettie', kind: 'side', giver: 'hettie', title: 'Feathers for Fashion', req: { quests: ['q2'] },
    text: 'I am making a hat that floats, dear. Four Featherfern and three Thorn Quills, please.', hint: 'Featherfern is forage; Thorn Quills drop from Thornrats.',
    steps: [{ t: 'gather', item: 'featherfern', n: 4, d: 'Bring 4 Featherfern' }, { t: 'gather', item: 'thornquill', n: 3, d: 'Bring 3 Thorn Quills' }], done: 'Perfect. And one for you, too.', reward: { gold: 40, gear: { slot: 'hat', lvl: 5, rar: 1 } } },
  { id: 's_corwin', kind: 'side', giver: 'corwin', title: 'Testing the Wheel', req: { quests: ['q5'] },
    text: 'I have a theory about Ember wands and Gale-touched beasts. Prove it: with an Ember familiar at your side, defeat five Gale enemies.', hint: 'Thornrats and Rotcrows are Gale. Make an Ember familiar your active one (press T).',
    steps: [{ t: 'kill', n: 5, el: 'gale', withEl: 'ember', d: 'Defeat 5 Gale enemies with an Ember familiar active' }], done: 'Theory confirmed! A wand for the data.', reward: { gold: 70, gear: { slot: 'weapon', lvl: 5, rar: 1 } } },
  { id: 's_tamsin', kind: 'side', giver: 'tamsin', title: 'The Old Waystones', req: { quests: ['q2'] },
    text: 'Three old waystones stand in the Brindlewood, from when witches flew the valley freely. Visit all three. Flying helps.', hint: 'Waystones are scattered through Brindlewood. Your broom (B) flies over the trees.',
    steps: [{ t: 'explore', place: 'stone1', d: 'Visit the western waystone' }, { t: 'explore', place: 'stone2', d: 'Visit the middle waystone' }, { t: 'explore', place: 'stone3', d: 'Visit the eastern waystone' }],
    done: 'Then they still stand. Take these bristles; you have earned real speed.', reward: { gold: 60, part: 'heather' } },
  { id: 's_ysolde', kind: 'side', giver: 'ysolde', title: 'Pip\'s Way Home', req: { quests: ['q7'] },
    text: 'My apprentice Pip is still hiding at the old hideout. Bring him safely out of the Brindlewood, to the western road.', hint: 'Pip follows you. Keep enemies off him; he has little health. Lead him to the west edge of Brindlewood.',
    steps: [{ t: 'escort', d: 'Escort Pip to the western road' }], done: 'Pip! Oh, thank you. Take these, I braided them under the Order\'s noses.', reward: { gold: 90, items: [['charm3', 0, 2]], flags: ['pipSafe'] } },
  { id: 's_wren', kind: 'side', giver: 'wren', title: 'Strong Blood', req: { quests: ['q6'] },
    text: 'Breed me a familiar with real potential: at least 80% in any one stat.', hint: 'Breed parents with high potentials; better Kinship Draughts add bonus potential.',
    steps: [{ t: 'breed', n: 1, min: 80, d: 'Hatch a familiar with 80%+ potential in a stat' }], done: 'Now that is a bloodline.', reward: { gold: 200, items: [['p_kinship', 3, 2]] } },
  { id: 's_bram', kind: 'side', giver: 'bram', title: 'Make It Home', req: { flags: ['bram'] },
    text: 'A witch\'s cottage should feel lived in. Furnish yours until it reaches 20 Comfort.', hint: 'Buy furniture from Bram, enter your cottage, and press V to decorate.',
    steps: [{ t: 'comfort', n: 20, d: 'Reach 20 Comfort at home' }], done: 'Now that is a home. Take this rug; my wife wove it.', reward: { gold: 100, furniture: ['rug_moon'] } },
];
export const QUEST: Record<string, QuestDef> = Object.fromEntries(QUESTS.map(q => [q.id, q]));

/** Daily bounty templates for the order board. */
export const BOUNTY_TEMPLATES: Omit<QuestDef, 'id'>[] = [
  { kind: 'bounty', giver: 'board', title: 'Alpha Sighting', text: 'A corrupted Alpha prowls the Brindlewood. It hits hard and drops well.', hint: 'Alphas have a gold name and glow. They appear somewhere in Brindlewood.', steps: [{ t: 'kill', n: 1, elite: true, d: 'Defeat a corrupted Alpha' }], done: 'Bounty paid.', reward: { gold: 160 } },
  { kind: 'bounty', giver: 'board', title: 'Thin the Rot', text: 'Cull the corrupted beasts near the road.', hint: 'Any corrupted beast counts.', steps: [{ t: 'kill', n: 10, faction: 'corrupt', d: 'Defeat 10 corrupted beasts' }], done: 'Bounty paid.', reward: { gold: 110 } },
  { kind: 'bounty', giver: 'board', title: 'Silver on the Road', text: 'Argent patrols harass travellers. Send a message.', hint: 'Order patrols walk the King\'s Road by day.', steps: [{ t: 'kill', n: 4, faction: 'order', d: 'Defeat 4 Argent Order members' }], done: 'Bounty paid.', reward: { gold: 140 } },
  { kind: 'bounty', giver: 'board', title: 'Gel Wanted', text: 'An apothecary needs Blight Gel for study.', hint: 'Blighted Mossblobs drop Blight Gel.', steps: [{ t: 'gather', item: 'blightgel', n: 4, d: 'Bring 4 Blight Gel' }], done: 'Bounty paid.', reward: { gold: 90 } },
  { kind: 'bounty', giver: 'board', title: 'Cinders', text: 'Cinder Beetles are scorching the undergrowth.', hint: 'Cinder Beetles are Ember: a Tide or Stone familiar helps.', steps: [{ t: 'kill', n: 4, enemy: 'cinderbeetle', d: 'Defeat 4 Cinder Beetles' }], done: 'Bounty paid.', reward: { gold: 100 } },
];
