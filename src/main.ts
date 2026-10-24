import Phaser from 'phaser';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import './style.css';
import { VW, VH } from './core/util';
import { WorldScene } from './scenes/WorldScene';
import { game } from './ui/state';
import { initInput } from './ui/input';
import { initHud } from './ui/hud';
import { initMenus } from './ui/menus';
import { initBrewUI } from './ui/brew';
import { showTitle, startGame } from './ui/title';
import { snapshot, GameState } from './core/state';

type Hot = { snapshot?: (fn: () => unknown) => void; ready?: (fn: (d: unknown) => void) => void; data?: unknown };
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;

function boot(data: unknown) {
  const d = data as { save?: GameState } | null;
  if (d && d.save) startGame(d.save, false); else showTitle();
}
game.sceneReady = () => {
  try { hot?.snapshot?.(() => (game.playing ? { save: snapshot() } : {})); } catch { /* not in a viewer */ }
  if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? null);
};
initInput(); initHud(); initMenus(); initBrewUI();
const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts;
const start = () => new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: VW, height: VH, pixelArt: true, roundPixels: true, backgroundColor: '#120d1c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: false }, audio: { noAudio: true }, scene: [WorldScene], banner: false,
});
Promise.race([fontsReady ? Promise.all([fontsReady.load('8px "Press Start 2P"'), fontsReady.load('16px VT323')]) : Promise.resolve(), new Promise(r => setTimeout(r, 1500))]).catch(() => {}).then(start);
addEventListener('beforeunload', () => { if (game.playing) import('./world/world').then(m => m.saveNow()); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.playing) import('./world/world').then(m => m.saveNow()); });

// Debug handle for automated tests and the browser console.
import * as worldMod from './world/world';
import * as combatMod from './world/combat';
import * as stateMod from './core/state';
import * as menusMod from './ui/menus';
import * as breedMod from './world/breed';
(window as unknown as Record<string, unknown>).__cov = { world: worldMod, combat: combatMod, state: stateMod, menus: menusMod, breed: breedMod, game };
