// Tile ids and their collision rules. Painting lives in terrain.ts.
export const TL = {
  GRASS: 0, PATH: 1, TREE: 2, DEEP: 3, SHALLOW: 4, SOIL: 5, TILLED: 6, WET: 7, STONEWALL: 8, FLOOR: 9, FLOWERS: 10, TALL: 11,
  FENCE: 12, HWALL: 13, ROOF: 14, DOOR: 15, COBBLE: 16, EXIT: 17, ROOF_BLUE: 18, BLIGHT: 19, BUSH: 20, ROCK: 21, BRIDGE: 22,
  WINDOW: 23, ROOF_GREEN: 24, DEADTREE: 25, STALL: 26, TENT: 27, CAMPFIRE: 28, LILY: 29, ROOF_PURPLE: 30, HEDGE: 31,
  WALL_IN: 32, FLOOR_IN: 33, VOID: 34, SHRINE: 35, DOOR_IN: 36,
} as const;
const WALK_SOLID = new Set<number>([TL.TREE, TL.DEEP, TL.STONEWALL, TL.FENCE, TL.HWALL, TL.ROOF, TL.DOOR, TL.ROOF_BLUE, TL.BUSH, TL.ROCK, TL.WINDOW, TL.ROOF_GREEN, TL.DEADTREE, TL.STALL, TL.TENT, TL.CAMPFIRE, TL.LILY, TL.ROOF_PURPLE, TL.HEDGE, TL.WALL_IN, TL.VOID, TL.SHRINE]);
const PROJ_SOLID = new Set<number>([TL.TREE, TL.STONEWALL, TL.HWALL, TL.ROOF, TL.DOOR, TL.ROOF_BLUE, TL.ROCK, TL.WINDOW, TL.ROOF_GREEN, TL.DEADTREE, TL.STALL, TL.TENT, TL.ROOF_PURPLE, TL.HEDGE, TL.WALL_IN, TL.VOID, TL.SHRINE]);
export const walkSolid = (t: number) => WALK_SOLID.has(t);
export const projSolid = (t: number) => PROJ_SOLID.has(t);
export const isGrassy = (t: number) => t === TL.GRASS || t === TL.FLOWERS || t === TL.TALL;
export const isWater = (t: number) => t === TL.DEEP || t === TL.LILY || t === TL.SHALLOW || t === TL.BRIDGE;
export const isRoof = (t: number) => t === TL.ROOF || t === TL.ROOF_BLUE || t === TL.ROOF_GREEN || t === TL.ROOF_PURPLE;
export const isWall = (t: number) => t === TL.HWALL || t === TL.WINDOW || t === TL.DOOR;
