let AC: AudioContext | null = null;
export const audio = { muted: false };
type Tone = [OscillatorType, number, number, number, number];
const SET: Record<string, Tone> = {
  shoot: ['square', 520, 260, 0.07, 0.04], hit: ['square', 180, 90, 0.06, 0.05], boom: ['sawtooth', 120, 40, 0.25, 0.07], whoosh: ['triangle', 300, 900, 0.2, 0.04],
  heal: ['triangle', 440, 880, 0.25, 0.05], thud: ['square', 90, 50, 0.1, 0.07], buff: ['triangle', 330, 660, 0.18, 0.05], dash: ['triangle', 600, 200, 0.12, 0.05],
  coin: ['square', 880, 1320, 0.08, 0.035], level: ['square', 523, 1046, 0.4, 0.05], hurt: ['sawtooth', 200, 80, 0.15, 0.06], bind: ['triangle', 392, 1175, 0.5, 0.05],
  fail: ['square', 300, 120, 0.25, 0.04], equip: ['square', 660, 880, 0.08, 0.035], open: ['triangle', 500, 1000, 0.2, 0.04], evolve: ['square', 392, 1568, 0.8, 0.05],
  till: ['square', 140, 90, 0.06, 0.04], water: ['triangle', 900, 500, 0.12, 0.03], pick: ['triangle', 700, 1100, 0.07, 0.04], plant: ['triangle', 400, 600, 0.06, 0.03],
  bubble: ['sine', 300, 700, 0.12, 0.05], stir: ['triangle', 600, 400, 0.08, 0.04], perfect: ['square', 1046, 1568, 0.15, 0.05], broom: ['triangle', 200, 500, 0.3, 0.04],
};
export function sfx(kind: string) {
  if (audio.muted) return;
  try { if (!AC) AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); if (AC.state === 'suspended') void AC.resume(); } catch { return; }
  const s = SET[kind] || SET.hit; const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.connect(g); g.connect(AC.destination); o.type = s[0];
  o.frequency.setValueAtTime(s[1], t); o.frequency.exponentialRampToValueAtTime(Math.max(30, s[2]), t + s[3]);
  g.gain.setValueAtTime(s[4], t); g.gain.exponentialRampToValueAtTime(0.001, t + s[3]); o.start(t); o.stop(t + s[3] + 0.02);
}
