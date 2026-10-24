import type { Element } from './familiars';
import type { Look } from '../art/chars16';

export type Faction = 'corrupt' | 'bandit' | 'order' | 'wild';
export type AI = 'melee' | 'ranged' | 'swoop' | 'shield' | 'charger' | 'caster' | 'boss_root' | 'boss_mags' | 'boss_halloran';
export interface Drop { id: string; p: number; n?: [number, number] }
export interface EnemyDef {
  id: string; name: string; faction: Faction; art?: string; look?: Look; scale?: number; el?: Element;
  hp: number; dmg: number; spd: number; xp: number; gold: [number, number]; ai: AI; lvl: number; drops: Drop[];
  fly?: boolean; pcol?: string; boss?: boolean; elite?: boolean; dr?: number; reach?: number; windup?: number; rate?: number;
}
const L = (hat: Look['hat'], hatCol: string, band: string, hair: string, skin: string, robe: string, trim?: string, legs?: string, boots?: string): Look => ({ hat, hatCol, band, hair, skin, robe, trim, legs, boots });

export const ENEMIES: Record<string, EnemyDef> = {
  mossblob: { id: 'mossblob', name: 'Blighted Mossblob', faction: 'corrupt', art: 'slime', el: 'tide', hp: 42, dmg: 9, spd: 32, xp: 7, gold: [1, 4], ai: 'melee', lvl: 1, reach: 18, windup: 0.55, rate: 1.6, drops: [{ id: 'blightgel', p: 0.6 }] },
  thornrat: { id: 'thornrat', name: 'Thornrat', faction: 'corrupt', art: 'rat', el: 'gale', hp: 34, dmg: 10, spd: 62, xp: 9, gold: [2, 5], ai: 'melee', lvl: 2, reach: 18, windup: 0.4, rate: 1.2, drops: [{ id: 'thornquill', p: 0.5 }] },
  snagstump: { id: 'snagstump', name: 'Snagstump', faction: 'corrupt', art: 'stump', el: 'stone', hp: 95, dmg: 15, spd: 24, xp: 16, gold: [3, 8], ai: 'melee', lvl: 3, reach: 24, windup: 0.8, rate: 2.2, drops: [{ id: 'heartsap', p: 0.5 }] },
  rotcrow: { id: 'rotcrow', name: 'Rotcrow', faction: 'corrupt', art: 'crow', el: 'gale', hp: 50, dmg: 12, spd: 66, xp: 13, gold: [2, 6], ai: 'swoop', lvl: 4, fly: true, drops: [{ id: 'rotfeather', p: 0.5 }] },
  cinderbeetle: { id: 'cinderbeetle', name: 'Cinder Beetle', faction: 'corrupt', art: 'beetle', el: 'ember', hp: 70, dmg: 14, spd: 40, xp: 14, gold: [3, 7], ai: 'charger', lvl: 4, windup: 0.7, drops: [{ id: 'emberchitin', p: 0.5 }] },
  hollowwisp: { id: 'hollowwisp', name: 'Hollow Wisp', faction: 'corrupt', art: 'wisp', el: 'spirit', hp: 55, dmg: 12, spd: 34, xp: 15, gold: [3, 7], ai: 'caster', lvl: 5, fly: true, pcol: '#c8b0ff', drops: [{ id: 'glowmoss', p: 0.3 }] },
  rootmaw: { id: 'rootmaw', name: 'Old Rootmaw', faction: 'corrupt', art: 'rootmaw', scale: 2, el: 'stone', hp: 1700, dmg: 22, spd: 26, xp: 320, gold: [140, 180], ai: 'boss_root', lvl: 8, boss: true, pcol: '#b88aff', drops: [{ id: 'rootmawheart', p: 1 }] },
  roadcutter: { id: 'roadcutter', name: 'Roadcutter', faction: 'bandit', look: L('bandana', '#6a3a2a', '#a63a3a', '#3a2a1a', '#d8a880', '#7a5a3a', '#5a3a24', '#3a2a20', '#2a1d14'), hp: 75, dmg: 15, spd: 52, xp: 15, gold: [6, 14], ai: 'melee', lvl: 3, reach: 20, windup: 0.5, rate: 1.4, drops: [{ id: 'saffron', p: 0.12 }] },
  slinger: { id: 'slinger', name: 'Roadcutter Slinger', faction: 'bandit', look: L('hood', '#4a5a30', '#4a5a30', '#2a1a10', '#c89870', '#5a6a3a', '#3a4a24', '#2a2a20', '#2a1d14'), hp: 55, dmg: 12, spd: 44, xp: 14, gold: [5, 12], ai: 'ranged', lvl: 3, pcol: '#a09080', drops: [{ id: 'saffron', p: 0.1 }] },
  mags: { id: 'mags', name: 'Mags Redhand', faction: 'bandit', look: L('bandana', '#a63a3a', '#a63a3a', '#c0502a', '#d8a880', '#6a3a2a', '#a63a3a', '#2a1a14', '#1a120c'), scale: 2, el: 'ember', hp: 1100, dmg: 24, spd: 54, xp: 200, gold: [120, 160], ai: 'boss_mags', lvl: 6, elite: true, pcol: '#ff8a3a', drops: [{ id: 'saffron', p: 1, n: [2, 3] }] },
  novice: { id: 'novice', name: 'Argent Novice', faction: 'order', el: 'spirit', look: L('hood', '#ecebf4', '#f2c14e', '#e8d8a0', '#f1c6a0', '#e0e0ec', '#f2c14e', '#b8b8c8', '#8a8aa0'), hp: 70, dmg: 13, spd: 42, xp: 18, gold: [6, 12], ai: 'ranged', lvl: 4, pcol: '#fff6c0', drops: [{ id: 'argentsalt', p: 0.35 }] },
  warden: { id: 'warden', name: 'Argent Warden', faction: 'order', el: 'stone', look: L('hood', '#b8bccc', '#c0c8e0', '#5a4a3a', '#e0b090', '#c8ccd8', '#8a90a8', '#7a7a90', '#5a5a70'), hp: 150, dmg: 19, spd: 38, xp: 26, gold: [8, 16], ai: 'shield', lvl: 5, dr: 0.3, reach: 22, windup: 0.6, rate: 1.6, drops: [{ id: 'argentsalt', p: 0.5 }] },
  halloran: { id: 'halloran', name: 'Witchfinder Halloran', faction: 'order', el: 'spirit', look: L('mitre', '#f4f4ff', '#a63a3a', '#e8e8f0', '#f1c6a0', '#f0f0f8', '#a63a3a', '#a63a3a', '#5a2a2a'), scale: 2, hp: 1400, dmg: 22, spd: 46, xp: 260, gold: [150, 200], ai: 'boss_halloran', lvl: 7, elite: true, pcol: '#fff6c0', drops: [{ id: 'argentsalt', p: 1, n: [3, 4] }] },
};
export const CORRUPT_SPAWNS = ['mossblob', 'mossblob', 'thornrat', 'snagstump', 'rotcrow', 'cinderbeetle', 'hollowwisp'];
