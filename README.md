# Covenbound

A cozy 16-bit witch life sim with real-time action combat. Grow and forage ingredients, brew potions, build your broom, collect and breed familiars, and defend the valley from corruption, bandits and the Argent Order.

The full design is in [DESIGN.md](DESIGN.md).

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev          # play in your browser at http://localhost:5173 with hot reload
npm run build        # web build in dist/ (for a website or itch.io)
npm run desktop      # build and open as a desktop app (Electron, the Steam wrapper)
npm run build:single # one self-contained HTML file in dist-single/
npm run typecheck    # TypeScript check
```

`npm install` downloads Electron (~100 MB) for the desktop app. If you only want the web build, use `npm install --ignore-scripts`.

## Where things live

| Folder / file | What it holds |
|---|---|
| `src/main.ts` | Boot: fonts, Phaser game, UI setup |
| `src/core/state.ts` | Save data, inventory, familiar stats, derived combat stats |
| `src/core/util.ts` | Constants (tile size, view size), RNG, helpers |
| `src/data/` | All game content: `brewing.ts` (aspects, ingredients, crops, recipes), `familiars.ts` (species, element wheel, abilities, talents, jobs), `crafts.ts` (classes, skill trees, races), `enemies.ts`, `gear.ts` (gear, broom parts), `quests.ts` (main, side, bounties), `furniture.ts`, `items.ts` |
| `src/world/world.ts` | Map runtime, movement, dodge, party swap, time of day, garden, foraging, broom, sleep/morning, decorating |
| `src/world/combat.ts` | Craft skills, familiar abilities, enemy AI with telegraphs, boss phases and shields, projectiles, allies, binding |
| `src/world/quests.ts` | Concurrent event-driven quests, bounties, escort and shrine defense |
| `src/world/breed.ts` | Breeding rules |
| `src/world/maps.ts` | Thistledown, your cottage, Hollowmere and the generated Brindlewood |
| `src/world/terrain.ts` | Bakes each map into a 16-bit ground layer; tree crowns and roofs as depth-sorted sprites |
| `src/art/pix16.ts` | The 16-bit pipeline: hue-shifted ramps, auto-shading, coloured outlines, Scale2x |
| `src/art/` | Sprite data: `familiars16.ts` (3 forms per species), `chars16.ts` (4-direction witches and humans), `enemies16.ts`, `furniture16.ts`, `sprites.ts` (icons, crops, glue) |
| `src/scenes/WorldScene.ts` | Phaser renderer: terrain, sprites, telegraphs, effects, lighting |
| `src/ui/` | HUD, menus, cauldron minigames (`brew.ts`), binding ritual (`bind.ts`), title, input |
| `desktop/main.cjs` | Electron wrapper for Steam |

All art is generated in code from material grids, so you can edit any sprite in `src/art/*16.ts`, or swap in PNG sprite sheets later. `sheet.html` (served by `npm run dev`) shows contact sheets: `/sheet.html?w=fam`, `?w=enemy`, `?w=char`, `?w=map&m=forest`.

## Controls

| Key | Action |
|---|---|
| WASD | Move |
| Space | Dodge roll (brief invulnerability) |
| J K L U | Craft skills; U is the advanced skill you slot from your tree (aim with the mouse) |
| O | Your active familiar's ability |
| T | Swap the active familiar (party of 3) |
| E / right-click | Talk, pick, harvest, bind, use furniture |
| Click | Use the selected hotbar item |
| 1–0 / wheel | Select hotbar slot |
| H | Drink your best healing potion |
| B | Broom |
| V | Decorate (inside your cottage) |
| Tab · F · N · Q · G · Esc | Bag · Familiars · Skill tree · Quests · Grimoire · Witch |
| M | Sound |

Gamepad: A interact, B dodge, X/Y/RB skills, LT advanced skill, LB familiar ability, RT use item, d-pad up broom, d-pad down swap, d-pad left/right hotbar.

## Shipping on Steam

1. Register on Steamworks and pay the Steam Direct fee for the app.
2. Add `electron-builder` and package `npm run build` + `desktop/` for Windows/macOS/Linux.
3. Add `steamworks.js` for achievements and cloud saves.
4. Upload builds with SteamPipe.
