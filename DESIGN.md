# Covenbound — Game Design

A cozy 16-bit witch life sim with real-time action combat. You live as a witch at the edge of a valley. You grow and forage ingredients, brew potions, fly a broom you build yourself, and collect, raise and breed familiars. You also defend villages and forests from corruption, bandits, and the Order that hunts your kind.

Target: single-player PC game (Steam desktop app and a browser build from the same code). Co-op for 2–4 players can be added later.

---

## 1. Pillars

1. **Half home, half hunt.** The cozy loop (garden, forage, brew, breed) and the action loop (quests, bosses, gear) feed each other. Each loop's output is the other loop's input.
2. **Familiars are the heart.** Every familiar is an individual with its own rolled stats and talents. Collecting, raising and breeding them pays off in *every* activity, not only combat.
3. **Brewing is a craft, not a menu.** Ingredients carry hidden aspects. You discover recipes by experimenting, and quality comes from technique.
4. **A hunted people.** The Order gives the world its tension. Your homestead is always safe; the roads and villages are not.

## 2. Core loops

**Day loop (in-game day ≈ 15 real minutes, 6:00 → 2:00):**
wake → water and harvest the garden, collect what the familiars brought → brew and fill orders → head out (fight, forage, quest) → fly home before 2:00 → sleep (crops grow, eggs hatch, sales pay out, game saves).

**Cross-feeding:**

| Produces | Feeds |
|---|---|
| Garden and foraging → ingredients | Brewing |
| Mobs, bandits, the Order → ingredient drops, gear, gold | Brewing, power |
| Brewing → combat potions, Growth Tonic, Kinship Draught, Cleansing Draught | Combat, the garden, breeding, removing corruption |
| Breeding → familiars with better rolls | Garden, foraging, brewing, flying, combat |
| Quests and bosses → regions cleansed | New forage, seeds, shops, recipes |

Days use an in-game clock (Stardew-style), not a real-time clock (Animal Crossing-style), so long play sessions are never blocked by waiting.

## 3. Witch: race and Crafts

### Races (cosmetic plus a small lean)
| Race | Lean |
|---|---|
| Mossborn | +20% HP, −5% speed |
| Vesper | +15% speed, −5% HP |
| Aetherkin | +25% MP, +12% power, −10% HP |
| Hearthfolk | +5% HP/MP/power, +3% speed |

### Crafts (classes)
FF14-style: each Craft levels separately from 1. You swap freely out of combat. Gear requirements check your **witch level** (your highest Craft level), so swapping never unequips anything, but damage and HP use your **current** Craft's level.

| Craft | Fantasy | Basic (Lv1) | Lv3 | Lv6 |
|---|---|---|---|---|
| **Sigilwright** | Runes and circles; zone control | Rune Bolt: projectile | Snare Sigil: placed trap that bursts and roots (up to 3) | Grand Circle: 5s zone that damages and slows; you take 30% less damage |
| **Poppeteer** | Pins and dolls; sympathetic curses | Pin: fast needle that adds a Mark (stacks to 5) | Stitch Poppet: decoy that draws aggro; damage it takes is shared to Marked enemies | Pull the Thread: detonates all Marks, stuns |
| **Herbalist** | Thorns and flasks | Thornlash: short vine whip with knockback | Flask Toss: lobbed poison cloud | Overgrowth: Snapvine turret that bites and heals you nearby |
| **Shapeshifter** | Become your familiar | Claw: melee swipe | Pounce: leap to a point, invulnerable mid-air | Wild Shape: become your active familiar's species for 10s (+40% damage, +25% speed) |
| **Necromancer** | Bone and grave | Bone Shard: piercing projectile | Raise Dead: recent corpses rise as allies for 15s (a Bone Thrall if there are none) | Grave Pulse: dark nova that drains life |

Passives: the Herbalist gets +40% from drunk potions; the Shapeshifter gets double benefit from the familiar's Might.

Brewing is **not** a class feature. Every witch brews (life skill), so no Craft is locked out of half the game.

### Life skills (Stardew-style, level 1–10)
Gardening, Foraging and Brewing. Each level raises quality and yield odds.

## 4. Familiars

### Roles
- **Party (up to 3):** travels with you. The **active** one follows you, attacks with its element, sets your element for attack and defense, lends you its ability on O, and gives its passives. Press T to swap (4s cooldown; a Loyal familiar swaps in instantly). The others earn 40% of combat XP.
- **Home jobs:** Garden (waters plots and raises crop quality), Forage (brings back ingredients each morning), Cauldron (raises brew quality). One familiar per job in the slice; more slots come with roost upgrades.
- **Resting:** everyone else.

### Stats (Wizard101-pet-style, rolled per individual)
| Stat | Drives |
|---|---|
| Might | Companion damage (×2 for a Shapeshifter) |
| Nurture | Garden job: plots watered per day, crop quality |
| Instinct | Forage job: item count and rarity |
| Wit | Cauldron job: brew quality |
| Wing | Broom speed while it's your companion |

Each **species** has a cap for every stat (Puddlewog: high Nurture; Fluffowl: high Instinct and Wing). Each **individual** has a *potential* of 0–100% per stat. The displayed stat is roughly `cap × potential × level factor × stage factor`. Wild familiars roll 20–70% potentials, with rare outliers.

Because each job reads different stats, "best familiar" depends on the job. That keeps min-maxing a real choice instead of a solved problem.

### Talents
Each familiar has its species **signature** talent plus **2 inherited talent slots**.
- Signatures carry over from the prototype: Kindle, Ashfeed, Mire Mend, Numbing Sting, Brambleshell, Prospector, Keen Eye, Leech Wing.
- General pool: Green Paw (crop quality), Rainmaker (+2 plots watered), Truffle Snout (rare forage), Pack Rat (+1 forage item), Steady Stir (brew quality), Alembic Mind (chance of +1 potion), Tailwind (broom speed), Featherweight (broom stamina), Fierce (+damage), Thick Hide (+ward), Bright Eyes (+light radius), Lucky (+gold), Quick Study (+familiar XP), Fertile (better breeding rolls).

### Breeding
At the roost nest: choose 2 familiars + 1 **Kinship Draught** → an egg that hatches next morning.
- Species: 50/50 from either parent.
- Each stat's potential: inherited from one parent at random, then −5 to +10, plus a bonus from the draught's quality. Capped at 100.
- Talents: 2 picked from both parents' inherited talents; a 10% mutation chance gives a fresh random talent (higher with Fertile).
- Parents rest for 2 days afterwards. Hatchlings start at Lv 1.

### Evolution
3 stages per species, each with its own art (16px, 20px, 24px). Evolve at Lv 6 and Lv 12 using elemental Essence. Each stage multiplies stats ×1.15 and strengthens the signature talent. The final form adds an **evolved passive**.

### Abilities and passives (v0.3)
| Species | Element | Ability (O) | Signature passive | Final-form passive |
|---|---|---|---|---|
| Sparkit | Ember | Flame Dash: dash leaving fire | Kindle: chance to burn | Pyre Heart: burning foes take +25% |
| Wickmoth | Ember | Ember Swarm: 3 seeking embers | Ashfeed: MP on kill | Sunlit Wings: +50% light, −15% damage taken at night |
| Puddlewog | Tide | Bubble Ward: shield (30% HP), slows when it bursts | Mire Mend: regen | Downpour: +30% healing |
| Driftjel | Tide | Tidal Lash: pull and slow | Numbing Sting: slow on hit | Pressure: slowed foes take +20% |
| Pebbleshell | Stone | Shell Bastion: unmovable, projectiles shatter, taunt | Brambleshell: reflect melee | Bedrock: −12% damage, immune to nets and knockback |
| Dirtnib | Stone | Burrow Strike: erupt under the cursor, stun | Prospector: gold and gear | Seismic Sense: dodge rolls end in a stun tremor |
| Fluffowl | Gale | Gale Dive: blast and expose to crits | Keen Eye: crit | Stormcall: crits chain lightning |
| Flitbat | Gale | Night Screech: fear and drain | Leech Wing: life steal | Blood Moon: +20% damage at night, double life steal |
| Gloamkit | Spirit | Phase Step: blink, leave a decoy | Shadowstep: chance to dodge | Nine Lives: survive a fatal blow once a day |
| Wisplet | Spirit | Soul Lantern: healing zone that burns foes | Will-o'-Light: light radius, shows glimmer forage | Afterglow: kills drop HP/MP motes |

Driftjel, Gloamkit and Wisplet are **lured**: offer Moonpetal at the pond shrine, or Glowmoss / Starbloom at the glade shrine, at night (after *The Glade Shrine*). Lured familiars get +8% potential.

### Elements
Five elements on a wheel; each beats two and loses to two: Tide > Ember, Stone · Ember > Gale, Spirit · Stone > Ember, Gale · Gale > Tide, Spirit · Spirit > Stone, Tide. Advantage ×1.5 damage, disadvantage ×0.67, in both directions (enemy attacks use their element against yours).

### Binding
Weaken a wild familiar until dazed, then press E. The ritual is a tug of wills: hold to raise your binding circle and keep the familiar's spirit inside it until the binding fills. The circle's size comes from the charm (Twine 22%, Silver 30%, Moonsilver 40%). The spirit's temper rises with rarity and remaining HP, falls if your element beats its own, and rises if it beats yours. Failing loses the charm and the familiar recovers.

## 5. Brewing

Every ingredient carries points in up to 8 **aspects**: Vita, Arcana, Bane, Swift, Ward, Lumen, Verdant, Kin. When you first find an ingredient you only know its strongest aspect. Each brew that uses it reveals another one (Skyrim-style discovery).

**At the cauldron:** add 2–4 ingredients and pick a **method**. Each method has its own minigame (v0.3), scored 0–3:
- **Simmer** (small quality bonus): keep the heat inside a drifting band by holding to stoke the fire.
- **Boil** (purify): skim ten foam bubbles with A/S/D/F or the mouse before they burst.
- **Steep** (favours the second aspect): stop the shifting brew when its colour matches the target, three times.
- **Distill** (strips aspects under 25% of the strongest): stir in time, three times.
- *Simmer:* balanced, with a small quality bonus.
- *Boil:* primary aspect ×1.3, every other aspect ×0.5. Makes a pure single-aspect potion.
- *Steep:* secondary aspect ×1.5. Makes it easier to hit two-aspect recipes.
- *Stirs:* a timing bar. Each hit in the sweet spot adds quality.

**Result:** the top aspect, plus the second if it's at least 40% of the top, picks the recipe. Total points plus stirs, ingredient quality, Brewing skill and the Cauldron familiar's Wit set the **tier**: Weak, Standard, Fine or Masterwork.

| Potion | Aspects | Use |
|---|---|---|
| Healing Draught | Vita | Heal |
| Mana Tonic | Arcana | Restore MP |
| Bane Flask | Bane | Throw: poison cloud |
| Quickstep Elixir | Swift | Move and broom speed |
| Wardskin Brew | Ward | Take less damage |
| Glimmer Tincture | Lumen | Light radius; reveals glimmer forage |
| Growth Tonic | Verdant | Use on a crop: +1 growth day, quality up |
| Kinship Draught | Kin | Required to breed |
| Clarity Brew | Vita + Arcana | Restore HP and MP |
| Stoneheart Draught | Vita + Ward | Heal over time and damage reduction |
| Hexfire Flask | Bane + Arcana | Throw: burst of damage |
| Haste Philter | Swift + Arcana | Faster cooldowns |
| Bloomwater | Verdant + Vita | Waters and grows all crops in a 3×3 area |
| Fondness Tea | Kin + Vita | Companion gains double XP today |
| Cleansing Draught | Lumen + Ward | Purifies a blight patch and reveals rare forage |
| Thornmail Tonic | Bane + Ward | Reflect melee damage |

The key Cleansing Draught ingredient is **Argent Salt**, which drops from the Order. You turn the hunters' own holy salt against the rot.

## 6. Garden and foraging
- **Garden:** till with the hoe, plant, water daily (or let a Garden familiar do it), harvest. Rain days water everything. Crops: Mandrake, Moonpetal, Bitterleaf, Sunroot, Ironthistle, Sweetbriar.
- **Foraging:** daily nodes around the homestead and in Brindlewood (Dewcap, Wolfsbell, Wild Sage, Featherfern, Kindleberry). Glowmoss and Starbloom are *glimmer forage*: visible at night only inside your lantern light or under a Glimmer Tincture.
- **Blight patches** in corrupted lands block forage. A Cleansing Draught clears one; defeating the region's boss clears most of them.

## 7. Broom
Press B to mount and dismount. In flight you pass over trees, water and fences, but you can't forage, plant or use skills. Running out of stamina lands you.

| Part | Effect | Options in the slice |
|---|---|---|
| Handle | Stamina and recovery | Ash, Yew, Blackthorn |
| Bristles | Speed | Straw, Heather, Raven-feather |
| Lantern | Night light radius; Moonglass shows glimmer forage | None, Tallow, Moonglass |
| Dye | Handle color | 6 colors |

The companion's Wing stat and the Tailwind/Featherweight talents stack on top. Order Witchfinders fire nets that knock you off your broom.

## 8. World and factions (slice region: the Hollow Vale)

- **Thistledown** — your homestead: cottage (walk in; bed, chest, decorating), garden field, cauldron, familiar roost and nest, broom rack, shipping crate.
- **Hollowmere** — the witch village: Grandmother Wren (quests, teaches Crafts), Marrow (seeds, charms, supplies), Tamsin (broom parts), Hettie (hats, robes, boots), Corwin (wands, staves, charms), the potion and bounty board, Bram (furniture), Ysolde and Pip once rescued.
- **Brindlewood** — a large forest crossed by the King's Road. It has blight patches, corrupted beasts, a Roadcutter bandit camp, Argent Order patrols, wild familiars, and Old Rootmaw's hollow, two shrines and three old waystones.

**Factions**
- *Corruption:* a rot spreading through the land. Corrupted beasts and bosses.
- *Roadcutters:* bandits on the roads (Roadcutter, Slinger; chief Mags Redhand).
- *The Argent Order:* "white witches" who call their own magic *Grace* and everyone else's *heresy*. They hunt witches. Units: Argent Novice (ranged), Argent Warden (shield), Witchfinder (elite; nets knock you off your broom). They never raid your homestead; it is warded.
- Planned reveal for a later region: the Order's purges feed the corruption.

## 9. Quests in the slice
Quests run concurrently and progress from events (kills, harvests, brews, binds, hatchings, exploring). Givers show **!** when they have a quest and **?** when one is ready. Step types: harvest, gather/deliver, brew, kill (filtered by faction, species, element, Alpha, your element, or element advantage), bind, breed (with a potential threshold), boss, explore, escort, defend, comfort, talk.

**Main (Grandmother Wren):** Roots and Rows · Rot in the Brindlewood · The First Brew · A Kindred Spirit · The Wheel of Elements · New Blood · Salt and Silver (find the hideout, defeat Halloran) · The Glade Shrine (defend it through 3 waves) · The Heart of the Rot.

**Side:** Marrow (mushrooms; a stocked pantry), Hettie (hat feathers), Corwin (prove the wheel with an Ember familiar), Tamsin (visit three waystones), Ysolde (escort Pip to the western road), Wren (breed an 80%-potential familiar), Bram (reach 20 Comfort).

**Daily bounties** on the order board (hold up to 3): Alpha hunts, culls, Order patrols, deliveries. Plus the Mags Redhand bounty and potion orders.

## 9b. Combat (v0.3)
- Enemies telegraph: melee foes flash and show a red wedge of their reach, archers show an aim line, chargers and crows a lane, casters a ground circle. **Space** rolls through attacks with i-frames.
- Out-of-combat regen is slow; potions share an 8s cooldown (Herbalist tree can shorten it).
- **Alphas**: rare elite corrupted beasts with 2.6× HP, harder hits, gold names and better drops.
- **Bosses** have three phases (at 66% and 33%), summon adds, and wear an elemental **shield** (22% of HP) that soaks damage. Hits from an element that beats the boss crack it fast; other hits barely scratch it. A broken shield stuns the boss and exposes it (+25% damage) for 5s. Shields return each phase. Rootmaw (Stone) breaks to Tide/Spirit; Mags (Ember) to Tide/Stone; Halloran (Spirit) to Ember/Gale.
- **Skill trees**: each Craft has 3 branches × 4 tiers (12 nodes). One point per level from Lv 2; tiers need Lv 2/4/7/10 and the node above. Tier 3 of each branch unlocks an advanced skill; slot one on U. Wren resets a tree for 100g.

## 9c. Home (v0.3)
Your cottage is a real interior. Press **V** inside to decorate: place, move and store furniture on a grid, hang wall pieces, change wallpaper and flooring. Bram the carpenter (Hollowmere, after *The First Brew*) sells 16 pieces, 5 wallpapers and 5 floors. **Comfort** (duplicates count half) raises the next morning's energy (+1 per point, up to +50); 25+ makes you Rested (+10% Craft XP for the day). The bed and storage chest work as furniture; a Familiar Cushion makes resting familiars earn more XP.

## 10. Gear
Slots: hat, robe, boots, wand or staff, charm. Wands lean toward haste, staves toward power. Stats: Power, Ward, Vigor, Mana, Haste, Crit; an element affinity for familiar-element skills; and **life-skill affixes** (Gardener's, Forager's, Brewer's) so outfits matter at home too. The hat changes your sprite's hat.

## 11. Tech
- TypeScript + Phaser 3.90 (rendering, input, camera) with DOM overlay UI. All pixel art is generated in code: sprites are material grids run through a 16-bit pipeline (hue-shifted 4-tone ramps, neighbour shading lit from the top-left, coloured selective outlines, Scale2x for large sprites). Terrain is baked per map with grass lips, shorelines and blight creep; tree crowns and roofs are separate sprites, depth-sorted with characters and faded when they hide you. Artists can later swap in sprite sheets.
- `npm run build` → `dist/` for a website or itch.io; `npm run desktop` → Electron app (Steam wrapper; Steamworks via steamworks.js later); `npm run build:single` → one HTML file for sharing.
- Saves: browser storage, which also works inside the desktop app. Cloud saves come with Steam integration.
- Co-op later: keep game state separate from rendering so it can be synced.

## 12. Beyond the slice
More regions (Saltmarsh, the Argent capital), evil witch covens, weather and seasons, roost upgrades and more job slots, key rebinding, more furniture sets, Steam achievements, co-op.
