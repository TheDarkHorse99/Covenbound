import type { Slot } from './gear';

export type Goal =
  | { type: 'harvest'; n: number }
  | { type: 'kill'; faction: string; n: number }
  | { type: 'brew'; potion: string; n: number }
  | { type: 'bind'; n: number }
  | { type: 'breed'; n: number }
  | { type: 'boss'; id: string };
export interface QuestDef {
  id: string; title: string; text: string; hint: string; goal: Goal; done: string;
  reward: { gold?: number; items?: [string, number, number][]; gear?: { slot: Slot; lvl: number; rar: number }; flags?: string[]; part?: string };
  onStart?: string[];
}
export const QUESTS: QuestDef[] = [
  { id: 'q1', title: 'Roots and Rows', goal: { type: 'harvest', n: 3 },
    text: 'Every witch starts in the dirt. Till your field with the hoe, plant the seeds I left you, water them each day, and bring in three crops.',
    hint: 'Select the Hoe (2) and click soil in your fenced field. Then plant seeds and water with the Can (3). Sleep in your cottage to pass the day. Bitterleaf is ready in 2 days.',
    done: 'Good dirt under your nails already. Take these seeds. Sunroot makes quick feet, and Moonpetal makes for deep mana.',
    reward: { gold: 60, items: [['seed_sunroot', 0, 4], ['seed_moonpetal', 0, 3]] } },
  { id: 'q2', title: 'Rot in the Brindlewood', goal: { type: 'kill', faction: 'corrupt', n: 6 },
    text: 'Something is rotting the Brindlewood, east past the village. The beasts there have gone purple and mean. Put down six of them, and keep what they drop. Rot makes fine reagents.',
    hint: 'Head east through Hollowmere into Brindlewood. Attack with J or by clicking with your Craft (slot 1) selected.',
    done: 'You came back in one piece. Here: Binding Charms, and two Mandrake roots from my own patch. You will want them for your first brew.',
    reward: { gold: 50, items: [['charm', 0, 3], ['mandrake', 2, 2]] } },
  { id: 'q3', title: 'The First Brew', goal: { type: 'brew', potion: 'healing', n: 1 },
    text: 'Now the cauldron. Mandrake is full of Vita, but it carries a little Kin and Bane too. Boil it to burn those away. Brew me a Healing Draught.',
    hint: 'Use the cauldron beside your cottage. Add Mandrake, choose Boil, and stir when the marker is in the gold band.',
    done: 'A real draught. Hollowmere has an order board by the well now. Folk will pay for potions. Check it each morning.',
    reward: { gold: 80, items: [['seed_mandrake', 0, 4]], flags: ['orders'] } },
  { id: 'q4', title: 'A Kindred Spirit', goal: { type: 'bind', n: 1 },
    text: 'One familiar is a friend. A coven of them is a household. Wild familiars wander the Brindlewood. Wear one down until it is dazed, then bind it with a charm.',
    hint: 'Wild familiars have gold names. Hit one until it shows green "dazed", then press E beside it.',
    done: 'Welcome to the household, little one. You may learn a second Craft now. Come to me when you are ready, for a fee. And look after your roost: familiars can work your garden, forage, and stir your pot.',
    reward: { gold: 40, items: [['seed_sweetbriar', 0, 3]], flags: ['crafts'] } },
  { id: 'q5', title: 'New Blood', goal: { type: 'breed', n: 1 },
    text: 'Two familiars and a Kinship Draught make an egg. The young take after their parents, sometimes better. Brew the draught from Kin: Sweetbriar, Kindleberry or Familiar Down. Boil away the rest.',
    hint: 'Brew a Kinship Draught (Kin aspect), then use the nest at your roost with two familiars. The egg hatches after you sleep.',
    done: 'A hatchling! Breed with care and you will raise familiars no wild one can match.',
    reward: { gold: 150, gear: { slot: 'charm', lvl: 4, rar: 1 } } },
  { id: 'q6', title: 'Salt and Silver', goal: { type: 'boss', id: 'halloran' }, onStart: ['halloran'],
    text: 'Bad news. A hedge witch named Ysolde is hiding in the south of the Brindlewood, and the Argent Order has found her trail. Witchfinder Halloran leads them. Get to her first.',
    hint: 'The hideout is south of the King\'s Road, in the middle of Brindlewood. Halloran\'s nets knock you off your broom.',
    done: 'Ysolde is safe in Hollowmere, thanks to you. She sells things I cannot get, and she sent this lantern. Take the Order\'s salt, too. It cleanses rot better than anything I know.',
    reward: { gold: 200, part: 'moonglass', flags: ['ysolde'] } },
  { id: 'q7', title: 'The Heart of the Rot', goal: { type: 'boss', id: 'rootmaw' },
    text: 'The rot has a heart. Old Rootmaw, the eldest tree-thing of the Brindlewood, has turned. Its hollow is in the far north-east. Cut out the heart and the forest can breathe again.',
    hint: 'The hollow is north of the road, near the east end of Brindlewood. Bring potions.',
    done: 'The Brindlewood is breathing. You have done what the Order never could: you healed it. There are more lands like this beyond the valley, witch. Rest first.',
    reward: { gold: 400, gear: { slot: 'weapon', lvl: 9, rar: 2 }, flags: ['cleansed'] } },
];

export const WREN_IDLE = [
  'Mandrake for Vita, Moonpetal for Arcana, Bitterleaf for Bane. Learn what your ingredients carry.',
  'Two aspects in the pot, and the second strong enough? You get a different brew entirely. Steep favours the second.',
  'The Order calls their own magic "Grace". It is the same magic, just with a better tailor.',
  'Feed your garden familiar well. A good Nurture can water a whole field before you wake.',
];
