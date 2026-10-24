export type Faction = 'corrupt' | 'bandit' | 'order' | 'wild';
export type AI = 'chase' | 'ranged' | 'swoop' | 'shield' | 'netter' | 'brute' | 'boss_root';
export interface Drop { id: string; p: number; n?: [number, number] }
export interface EnemyDef {
  id: string; name: string; faction: Faction; sprite: string; pal: Record<string, string>; scale?: number;
  hp: number; dmg: number; spd: number; xp: number; gold: [number, number]; ai: AI; lvl: number; drops: Drop[];
  fly?: boolean; pcol?: string; boss?: boolean; elite?: boolean; dr?: number; aggro?: number;
}
export const ENEMIES: Record<string, EnemyDef> = {
  mossblob: { id: 'mossblob', name: 'Blighted Mossblob', faction: 'corrupt', sprite: 'slime', pal: { a: '#6a8a38', b: '#a8c868', c: '#2b3a1a', k: '#10200a', d: '#8a4ac0' }, hp: 26, dmg: 6, spd: 30, xp: 6, gold: [1, 4], ai: 'chase', lvl: 1, drops: [{ id: 'blightgel', p: 0.6 }] },
  thornrat: { id: 'thornrat', name: 'Thornrat', faction: 'corrupt', sprite: 'rat', pal: { a: '#8a6a4a', b: '#b8c86a', c: '#3a2a1a', k: '#120a08' }, hp: 22, dmg: 7, spd: 58, xp: 8, gold: [2, 5], ai: 'chase', lvl: 2, drops: [{ id: 'thornquill', p: 0.5 }] },
  snagstump: { id: 'snagstump', name: 'Snagstump', faction: 'corrupt', sprite: 'stump', pal: { a: '#6a4a36', b: '#5a3a6a', c: '#2a1a0a', k: '#c890ff' }, hp: 60, dmg: 10, spd: 22, xp: 14, gold: [3, 8], ai: 'chase', lvl: 3, drops: [{ id: 'heartsap', p: 0.5 }] },
  rotcrow: { id: 'rotcrow', name: 'Rotcrow', faction: 'corrupt', sprite: 'crow', pal: { a: '#2a2632', b: '#8a6ad6', c: '#14121a', k: '#c8ff6a' }, hp: 34, dmg: 9, spd: 64, xp: 12, gold: [2, 6], ai: 'swoop', lvl: 4, fly: true, drops: [{ id: 'rotfeather', p: 0.5 }] },
  rootmaw: { id: 'rootmaw', name: 'Old Rootmaw', faction: 'corrupt', sprite: 'stump', scale: 2, pal: { a: '#4a3226', b: '#6a3a8a', c: '#1a0f06', k: '#c8ff6a' }, hp: 900, dmg: 15, spd: 26, xp: 260, gold: [140, 180], ai: 'boss_root', lvl: 8, boss: true, pcol: '#b88aff', drops: [{ id: 'rootmawheart', p: 1 }] },
  roadcutter: { id: 'roadcutter', name: 'Roadcutter', faction: 'bandit', sprite: 'human', pal: { H: '#5a4030', S: '#d8a880', T: '#7a5a3a', L: '#3a2a20', W: '#c8c8d0' }, hp: 48, dmg: 11, spd: 48, xp: 14, gold: [6, 14], ai: 'chase', lvl: 3, drops: [{ id: 'saffron', p: 0.12 }] },
  slinger: { id: 'slinger', name: 'Roadcutter Slinger', faction: 'bandit', sprite: 'human', pal: { H: '#4a5a30', S: '#c89870', T: '#5a6a3a', L: '#2a2a20', W: '#8a6a4a' }, hp: 36, dmg: 9, spd: 42, xp: 13, gold: [5, 12], ai: 'ranged', lvl: 3, pcol: '#a09080', drops: [{ id: 'saffron', p: 0.1 }] },
  mags: { id: 'mags', name: 'Mags Redhand', faction: 'bandit', sprite: 'human', scale: 2, pal: { H: '#a63a3a', S: '#d8a880', T: '#6a3a2a', L: '#2a1a14', W: '#e0e0e8' }, hp: 520, dmg: 18, spd: 50, xp: 160, gold: [120, 160], ai: 'brute', lvl: 6, elite: true, drops: [{ id: 'saffron', p: 1, n: [2, 3] }] },
  novice: { id: 'novice', name: 'Argent Novice', faction: 'order', sprite: 'human', pal: { H: '#e8e8f0', S: '#f1c6a0', T: '#d8d8e8', L: '#b8b8c8', W: '#f2c14e' }, hp: 44, dmg: 10, spd: 40, xp: 16, gold: [6, 12], ai: 'ranged', lvl: 4, pcol: '#fff6c0', drops: [{ id: 'argentsalt', p: 0.35 }] },
  warden: { id: 'warden', name: 'Argent Warden', faction: 'order', sprite: 'human', pal: { H: '#c8c8d8', S: '#e0b090', T: '#e8e8f0', L: '#9898a8', W: '#c0c8e0' }, hp: 90, dmg: 14, spd: 36, xp: 22, gold: [8, 16], ai: 'shield', lvl: 5, dr: 0.35, drops: [{ id: 'argentsalt', p: 0.5 }] },
  halloran: { id: 'halloran', name: 'Witchfinder Halloran', faction: 'order', sprite: 'human', scale: 2, pal: { H: '#f4f4ff', S: '#f1c6a0', T: '#f0f0f8', L: '#a63a3a', W: '#f2c14e' }, hp: 700, dmg: 16, spd: 44, xp: 220, gold: [150, 200], ai: 'netter', lvl: 7, elite: true, pcol: '#fff6c0', drops: [{ id: 'argentsalt', p: 1, n: [3, 4] }] },
};
export const CORRUPT_SPAWNS = ['mossblob', 'mossblob', 'thornrat', 'snagstump', 'rotcrow'];
