# Covenbound — notes for Claude Code

A cozy 16-bit witch life sim + action RPG (TypeScript, Phaser 3.90, Vite, DOM overlay UI). Single-player, browser build, Electron wrapper for a future Steam release. Read `DESIGN.md` for the game design and `README.md` for the file map and controls.

## Working agreement
- Mac is the designer and has no coding background; explain decisions and trade-offs plainly, give full file paths, and don't assume he can read a diff. Rigorous, objective feedback; no reflexive praise.
- Ask before naming new content (familiars, items, NPCs, places) unless he has said to name things yourself.
- Playtest changes yourself before reporting them done (see Testing). Push to `main` when a change is verified; the public site redeploys from `main` automatically.
- Don't change the save format casually. Bumping `SAVE_VERSION` in `src/core/state.ts` wipes every player's save; if it must happen, say so in the commit and the title-screen notice.

## Commands
- `npm run dev` — local dev server with hot reload (http://localhost:5173). `/sheet.html?w=fam|enemy|char|props|map&m=forest&s=N` shows art contact sheets.
- `npm run build` — web build to `dist/`. `npm run typecheck` — `tsc --noEmit`; keep it at zero errors.
- `npm run desktop` — Electron app. `npm run build:single` — one-file HTML in `dist-single/`. `npm run build:itch` — relative-path build zipped to `covenbound-itch.zip` for itch.io.
- Deploy: push to `main` → `.github/workflows/pages.yml` → https://thedarkhorse99.github.io/Covenbound/ (about a minute).

## Architecture in one breath
- `src/core/state.ts` is the single save object `S` (GameState) plus derived stats (`calcStats`). Everything persistent lives there; runtime-only things live in `W` (`src/world/world.ts`).
- `src/data/*` is content only (no logic): familiars (species, element wheel `BEATS`/`effMult`, abilities, passives, talents), crafts (skills, advanced skills, 12-node trees, flags), enemies, quests (step types), brewing, gear, furniture, items.
- `src/world/world.ts` runs the simulation: movement, dodge roll, party swap, time, garden/forage, broom, sleep → morning, cottage decorating. `combat.ts`: casting, familiar abilities (O), telegraphed enemy AI, bosses (3 phases + elemental shields), binding (`bindInfo`/`bindResult`). `quests.ts`: concurrent event-driven quests (`questEvent`), bounties, escort, shrine defense.
- Art is generated in code. `src/art/pix16.ts` turns material-letter grids into shaded, outlined sprites (`shaded`, `scale2x`). Sprite data: `familiars16.ts` (3 forms per species), `chars16.ts` (4-direction people + hats), `enemies16.ts`, `furniture16.ts`, `props.ts`; icons/crops/glue in `sprites.ts`. `src/world/terrain.ts` bakes each map to a ground canvas; tree crowns, roofs and awnings are separate sprites depth-sorted in `WorldScene.ts`.
- `src/ui/*` is DOM: `hud.ts`, `menus.ts` (tabs, shops, roost, chest, board, shrine), `brew.ts` (four method minigames), `bind.ts` (tug-of-will ritual), `title.ts`, `input.ts` (keys + gamepad). Modal/dialog state in `ui/state.ts`.
- Debug handle in the browser console: `__cov.{state,world,combat,menus,breed,game}` and `__scene`. Tests drive the game through it.

## Testing
Headless Playwright scripts (Python) against `python3 -m http.server 8765` in `dist/`, launched with `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist`. Typical flow: clear localStorage, create a witch, press E through the intro, then `page.evaluate` on `__cov` to teleport/spawn/grant items, press keys, screenshot, and assert on state. Watch `pageerror` and console errors; expect ~59 fps in the forest.

## Current state (v0.3, Nov 2026)
Done: 16-bit art for everything; five elements incl. Spirit; party of 3 with abilities and passives; dodge/telegraphs/Alphas/boss phases & shields; skill trees + advanced skill on U; binding ritual and shrine lures; four brewing minigames; concurrent quests (9 main, 8 side, daily bounties); walk-in cottage with decorating and Comfort; bug-report links; GitHub Pages + itch zip.

Known gaps / next candidates, roughly in priority order:
1. Touch controls (virtual stick + buttons) so the browser build is playable on phones.
2. Balance pass from real play: enemy damage, boss shields, binding difficulty (tuned only by simulation), brewing score thresholds.
3. Second region ("Saltmarsh", the closed east exit), more familiars (Spirit has only two), more furniture sets.
4. Small visual items: village pond is rectangular; crate cross-brace is faint at 1×.
5. Later: key rebinding, Steam (electron-builder + steamworks.js), co-op (state is already separate from rendering).

## Controls
WASD move · Space dodge · J/K/L/U skills · O familiar ability · T swap familiar · E/right-click interact · click use item · 1–0 hotbar · H quick heal · B broom · V decorate (in cottage) · Tab bag · F familiars · N skill tree · Q quests · G grimoire · Esc witch · M sound.
