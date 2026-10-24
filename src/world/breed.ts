import { S, Familiar, newFamiliar, hasTal, removeItem, countItem } from '../core/state';
import { FSTATS, TALENTS, FStat } from '../data/familiars';
import { potionTierVal } from '../data/brewing';
import { R, rint, pick, clamp } from '../core/util';

export const BREED_REST = 2;
export function canBreed(a: Familiar, b: Familiar): string | null {
  if (a.uid === b.uid) return 'Pick two different familiars.';
  if (S.egg) return 'The nest already holds an egg. It hatches after you sleep.';
  if (a.rest > 0 || b.rest > 0) return 'One of them is still resting from the last clutch.';
  if (a.lvl < 3 || b.lvl < 3) return 'Both parents must be at least Lv 3.';
  if (countItem('p_kinship') < 1) return 'You need a Kinship Draught.';
  return null;
}
/** Uses the best Kinship Draught you own and lays an egg that hatches tomorrow. */
export function layEgg(a: Familiar, b: Familiar): number {
  let tier = 0; for (const st of S.inv) if (st && st.id === 'p_kinship') tier = Math.max(tier, st.q);
  removeItem('p_kinship', 1, tier, tier);
  S.egg = { a: a.uid, b: b.uid, tier, due: S.day + 1 }; a.rest = b.rest = BREED_REST + 1;
  return tier;
}
export function breedChild(a: Familiar, b: Familiar, tier: number): Familiar {
  const sp = R() < 0.5 ? a.sp : b.sp; const child = newFamiliar(sp, R, 'bred');
  const bonus = potionTierVal([0, 3, 6, 10], tier); const fertile = hasTal(a, 'fertile') || hasTal(b, 'fertile');
  for (const k of FSTATS) {
    const from = R() < 0.5 ? a.pot[k as FStat] : b.pot[k as FStat];
    child.pot[k as FStat] = clamp(from + rint(-5, 10) + bonus + (fertile ? 3 : 0), 5, 100);
  }
  const pool = Array.from(new Set([...a.tal, ...b.tal]));
  const tal: string[] = [];
  while (tal.length < 2 && pool.length) { const t = pool.splice(Math.floor(R() * pool.length), 1)[0]; tal.push(t); }
  if (R() < (fertile ? 0.25 : 0.1) || tal.length < 2) { const fresh = TALENTS.map(t => t.id).filter(t => !tal.includes(t)); const t = pick(fresh); if (tal.length < 2) tal.push(t); else tal[Math.floor(R() * 2)] = t; }
  child.tal = tal; child.job = 'rest';
  return child;
}
