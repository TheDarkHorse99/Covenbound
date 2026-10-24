# Covenbound

A cozy 8-bit witch life sim with real-time action combat. Grow and forage ingredients, brew potions, build your broom, collect and breed familiars, and defend the valley from corruption, bandits and the Argent Order.

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
| `src/data/` | All game content: `brewing.ts` (aspects, ingredients, crops, recipes), `familiars.ts` (species, talents, jobs), `crafts.ts` (classes, races), `enemies.ts`, `gear.ts` (gear, broom parts), `quests.ts`, `items.ts` |
| `src/world/world.ts` | Map runtime, movement, time of day, garden, foraging, broom, sleep/morning, quests |
| `src/world/combat.ts` | Craft skills, enemy AI, bosses, projectiles, allies, binding |
| `src/world/breed.ts` | Breeding rules |
| `src/world/maps.ts` | Thistledown, Hollowmere and the generated Brindlewood |
| `src/world/tiles.ts` | Tile types and the tile painter |
| `src/art/` | Pixel-art sprites drawn from character grids (`sprites.ts`), props, helpers |
| `src/scenes/WorldScene.ts` | Phaser renderer: tilemap, sprites, effects, lighting |
| `src/ui/` | HUD, menus, cauldron, title and character creation, input |
| `desktop/main.cjs` | Electron wrapper for Steam |

All art is generated in code, so you can replace any sprite grid in `src/art/sprites.ts`, or swap in PNG sprite sheets later.

## Controls

WASD move · J/K/L Craft skills (aim with mouse) · click uses the selected hotbar item · E or right-click to interact · 1–0 or wheel selects hotbar · B broom · H quick-heal · Tab bag · F familiars · G grimoire · Q quest · M sound. Gamepads work for movement, skills and menus.

## Shipping on Steam

1. Register on Steamworks and pay the Steam Direct fee for the app.
2. Add `electron-builder` and package `npm run build` + `desktop/` for Windows/macOS/Linux.
3. Add `steamworks.js` for achievements and cloud saves.
4. Upload builds with SteamPipe.
