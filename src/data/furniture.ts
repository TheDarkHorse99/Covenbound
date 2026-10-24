export type FurnKind = 'floor' | 'wall' | 'rug';
export interface FurnDef { id: string; name: string; w: number; h: number; kind: FurnKind; price: number; comfort: number; light?: number; use?: 'sleep' | 'chest'; d: string }
export const FURNITURE: FurnDef[] = [
  { id: 'bed', name: "Witch's Bed", w: 1, h: 2, kind: 'floor', price: 0, comfort: 5, use: 'sleep', d: 'Sleep here to end the day.' },
  { id: 'chest', name: 'Storage Chest', w: 1, h: 1, kind: 'floor', price: 120, comfort: 1, use: 'chest', d: 'Holds 30 stacks of items.' },
  { id: 'table', name: 'Oak Table', w: 2, h: 1, kind: 'floor', price: 80, comfort: 3, d: 'Sturdy and slightly wobbly.' },
  { id: 'chair', name: 'Rush Chair', w: 1, h: 1, kind: 'floor', price: 30, comfort: 1, d: 'Woven by Bram himself.' },
  { id: 'bookshelf', name: 'Bookshelf', w: 1, h: 1, kind: 'floor', price: 90, comfort: 3, d: 'Grimoires, almanacs and one cookbook.' },
  { id: 'plant', name: 'Potted Fern', w: 1, h: 1, kind: 'floor', price: 35, comfort: 2, d: 'It likes you.' },
  { id: 'lamp', name: 'Witchfire Lamp', w: 1, h: 1, kind: 'floor', price: 50, comfort: 2, light: 44, d: 'A green flame that never needs feeding.' },
  { id: 'candles', name: 'Candle Cluster', w: 1, h: 1, kind: 'floor', price: 20, comfort: 1, light: 26, d: 'Drips beautifully.' },
  { id: 'fireplace', name: 'Stone Hearth', w: 2, h: 1, kind: 'floor', price: 220, comfort: 6, light: 70, d: 'Must stand against the back wall.' },
  { id: 'clock', name: 'Grandfather Clock', w: 1, h: 1, kind: 'floor', price: 150, comfort: 3, d: 'Ticks a little too loudly.' },
  { id: 'petbed', name: 'Familiar Cushion', w: 1, h: 1, kind: 'floor', price: 70, comfort: 3, d: 'Your familiars nap here.' },
  { id: 'dresser', name: 'Dresser', w: 2, h: 1, kind: 'floor', price: 100, comfort: 2, d: 'Seven drawers, eight hats.' },
  { id: 'painting', name: 'Moonlit Vale (painting)', w: 1, h: 1, kind: 'wall', price: 70, comfort: 2, d: 'Hangs on the wall.' },
  { id: 'wreath', name: 'Herb Wreath', w: 1, h: 1, kind: 'wall', price: 40, comfort: 2, d: 'Rosemary, sage and a little nightshade.' },
  { id: 'banner', name: 'Coven Banner', w: 1, h: 1, kind: 'wall', price: 60, comfort: 2, d: 'A moon and five stars.' },
  { id: 'rug_red', name: 'Red Rug', w: 2, h: 2, kind: 'rug', price: 60, comfort: 3, d: 'Soft underfoot.' },
  { id: 'rug_moon', name: 'Moon Rug', w: 3, h: 2, kind: 'rug', price: 180, comfort: 6, d: 'Woven with a crescent moon.' },
];
export const FURN: Record<string, FurnDef> = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
export const WALLPAPER_PRICE = 80, FLOOR_PRICE = 80;
