import Phaser from 'phaser';
import { T, VW, VH, clamp, dist, R } from '../core/util';
import { S, companion } from '../core/state';
import { W, hooks, cropStage, nodeVisible, forageNodes, isNight, darkness, lightRadius, activeNpcs, nearNpc, nearProp, nearFurn, update as worldUpdate, useSelected, interact, Player, furnFits, decoClick, decoStore } from '../world/world';
import { TL } from '../world/tiles';
import { Terrain, findRoofs, crown, roofSprite, awning, Roof } from '../world/terrain';
import { COTTAGE } from '../world/maps';
import { famSprite, enemySprite, enemyFacesLeft, charSprite, broomRider16, cropSprite, itemIcon, miscSprite, Look, Dir, icon, elCol } from '../art/sprites';
import { scale2x } from '../art/pix16';
import { furnSprite } from '../art/furniture16';
import { whiteOf, tinted, mk } from '../art/pixel';
import { cauldron, crate, rack, roost, board, well } from '../art/props';
import { SPECIES, ELEMENT_INFO } from '../data/familiars';
import { ENEMIES } from '../data/enemies';
import { FURN } from '../data/furniture';
import { BPART, BROOM_DYES } from '../data/gear';
import { ING } from '../data/brewing';
import { npcMarker } from '../world/quests';
import { game } from '../ui/state';

export function playerLook(): Look {
  const h = S.eq.hat; return { hat: h?.hat || 'pointed', hatCol: h?.hatCol || '#2a2140', band: h ? ['#6a5a80', '#7fd1a0', '#f2c14e'][h.rar] : '#6a5a80', hair: S.hair, skin: S.skin, robe: S.robe };
}
const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
function dirOf(fx: number, fy: number): Dir { return Math.abs(fy) > Math.abs(fx) * 1.05 ? (fy > 0 ? 'down' : 'up') : 'side'; }

export class WorldScene extends Phaser.Scene {
  private terrain?: Terrain;
  private groundImg?: Phaser.GameObjects.Image;
  private groundKey = '';
  private groundN = 0;
  private dirty = false;
  private pool: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private texKeys = new WeakMap<HTMLCanvasElement, string>();
  private texN = 0;
  private gGround!: Phaser.GameObjects.Graphics;
  private gMid!: Phaser.GameObjects.Graphics;
  private gTop!: Phaser.GameObjects.Graphics;
  private gScreen!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private textUsed = 0;
  private darkCanvas!: HTMLCanvasElement;
  private darkTex!: Phaser.Textures.CanvasTexture;
  private dark!: Phaser.GameObjects.Image;
  private darkOn = false;
  private mapId = '';
  private roofs: Roof[] = [];
  private shakeX = 0; private shakeY = 0;

  constructor() { super('world'); }

  create() {
    this.gGround = this.add.graphics().setDepth(-5);
    this.gMid = this.add.graphics().setDepth(-4);
    this.gTop = this.add.graphics().setDepth(1e6);
    this.darkCanvas = mk(VW, VH); this.darkTex = this.textures.addCanvas('dark', this.darkCanvas)!;
    this.dark = this.add.image(0, 0, 'dark').setOrigin(0, 0).setScrollFactor(0).setDepth(1e6 + 1);
    this.gScreen = this.add.graphics().setScrollFactor(0).setDepth(1e6 + 2);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (!S || !W.P) return; W.aim.x = p.worldX; W.aim.y = p.worldY; W.aim.mouse = true; W.aim.t = W.clock; });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!game.playing || game.blocked()) return; W.aim.x = p.worldX; W.aim.y = p.worldY; W.aim.mouse = true; W.aim.t = W.clock;
      if (W.deco.on) { if (p.rightButtonDown()) decoStore(); else decoClick(p.worldX, p.worldY); return; }
      if (p.rightButtonDown()) interact(); else useSelected({ x: p.worldX, y: p.worldY });
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => { if (!game.playing || game.blocked()) return; S.sel = (S.sel + (dy > 0 ? 1 : 9)) % 10; hooks.hud(); });
    hooks.tile = (i: number) => { if (!this.terrain) return; this.terrain.repaint(i % W.map.w, (i / W.map.w) | 0); this.dirty = true; };
    hooks.mapChanged = () => this.buildMap();
    (window as unknown as Record<string, unknown>).__scene = this;
    game.sceneReady();
  }

  private buildMap() {
    const m = W.map; this.mapId = m.id;
    const roofs = findRoofs(W.m, m.w, m.h); this.roofs = roofs;
    this.terrain = new Terrain({ w: m.w, h: m.h, m: W.m, v: W.v, id: m.id, roofs, home: { wall: S.home.wall, floor: S.home.floor } });
    const old = this.groundKey; this.groundKey = 'ground' + (this.groundN++);
    this.textures.addCanvas(this.groundKey, this.terrain.ground.canvas);
    if (!this.groundImg) this.groundImg = this.add.image(0, 0, this.groundKey).setOrigin(0, 0).setDepth(-10); else this.groundImg.setTexture(this.groundKey);
    if (old) this.textures.remove(old);
    this.dirty = false;
  }

  private tex(c: HTMLCanvasElement): string {
    let k = this.texKeys.get(c); if (k) return k;
    k = 'c' + (this.texN++); this.textures.addCanvas(k, c); this.texKeys.set(c, k); return k;
  }
  private img(c: HTMLCanvasElement, x: number, y: number, depth: number, o: { flip?: boolean; alpha?: number; ox?: number; oy?: number; tint?: number; screen?: boolean } = {}) {
    let im = this.pool[this.used]; if (!im) { im = this.add.image(0, 0, this.tex(c)); this.pool.push(im); }
    this.used++; im.setScrollFactor(o.screen ? 0 : 1); im.setTexture(this.tex(c)); im.setOrigin(o.ox ?? 0.5, o.oy ?? 1); im.setPosition(Math.round(x), Math.round(y)); im.setDepth(depth); im.setFlipX(!!o.flip); im.setAlpha(o.alpha ?? 1); im.setVisible(true);
    if (o.tint !== undefined) im.setTint(o.tint); else im.clearTint();
    return im;
  }
  private text(txt: string, x: number, y: number, col: string, depth = 1e6 + 3, size = 10, screen = false) {
    let t = this.texts[this.textUsed]; if (!t) { t = this.add.text(0, 0, '', { fontFamily: 'VT323, monospace', fontSize: '10px', color: '#fff', stroke: '#120a18', strokeThickness: 2, resolution: 3 }); this.texts.push(t); }
    this.textUsed++; if (t.text !== txt) t.setText(txt); t.setColor(col); t.setFontSize(size); t.setOrigin(0.5, 1); t.setPosition(Math.round(x), Math.round(y)); t.setDepth(depth); t.setVisible(true); t.setScrollFactor(screen ? 0 : 1); t.setAlpha(1);
    return t;
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    if (!game.playing || !S || !W.P) { this.hideAll(); this.renderTitle(dt); return; }
    if (this.mapId !== W.map.id || !this.terrain) this.buildMap(); this.groundImg?.setVisible(true);
    if (!game.blocked()) { game.pollInput(); worldUpdate(dt); }
    if (this.dirty && this.groundKey) { (this.textures.get(this.groundKey) as Phaser.Textures.CanvasTexture).refresh(); this.dirty = false; }
    this.render();
    game.afterFrame();
  }
  private tt = 0;
  private stars = Array.from({ length: 80 }, () => ({ x: Math.random() * VW, y: Math.random() * VH * 0.7, s: Math.random() }));
  private renderTitle(dt: number) {
    this.tt += dt; const t = this.tt; const g = this.gScreen; this.cameras.main.setScroll(0, 0); this.used = 0; this.textUsed = 0;
    g.fillStyle(0x120d1c).fillRect(0, 0, VW, VH); g.fillStyle(0x1d1530).fillRect(0, VH * 0.55, VW, VH * 0.45);
    for (const st of this.stars) g.fillStyle(0xe9dfc7, 0.3 + 0.5 * Math.abs(Math.sin(t * 1.5 + st.s * 9))).fillRect(Math.round(st.x), Math.round(st.y), 1, 1);
    g.fillStyle(0xf2e6b8).fillCircle(318, 52, 24); g.fillStyle(0x120d1c).fillCircle(306, 45, 22);
    for (let i = 0; i < 18; i++) { const x = i * 24 - 8 + ((i * 7) % 5); this.img(crown(i % 4), x, VH - 8 - ((i * 13) % 9), 1e6 + 4, { screen: true }); }
    const wx = ((t * 34) % (VW + 80)) - 40, wy = 80 + Math.sin(t * 2) * 8;
    const look: Look = { hat: 'pointed', hatCol: '#2a2140', band: '#f2c14e', hair: '#c0502a', skin: '#d9c7f0', robe: '#6b3fa0' };
    this.img(broomRider16(look, '#b08a5a', '#e0c070', '#f2c14e', Math.floor(t * 8) % 2), wx, wy, 1e6 + 5, { screen: true });
    this.img(famSprite('fluffowl', 2), wx - 26, wy - 10 + Math.sin(t * 6) * 2, 1e6 + 5, { screen: true });
    for (let k = 0; k < 3; k++) g.fillStyle(0xfff1a8, 0.6).fillRect(wx - 20 - k * 6 - (t * 40 % 6), wy - 6 + k, 2, 1);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].setVisible(false);
  }
  private hideAll() { for (const im of this.pool) im.setVisible(false); for (const t of this.texts) t.setVisible(false); this.gTop?.clear(); this.gGround?.clear(); this.gMid?.clear(); this.gScreen?.clear(); this.dark?.setVisible(false); this.groundImg?.setVisible(false); }

  private render() {
    const P = W.P, cam = this.cameras.main, m = W.map;
    if (W.shakeT > 0) { this.shakeX = (R() - 0.5) * W.shakeA; this.shakeY = (R() - 0.5) * W.shakeA; } else { this.shakeX = this.shakeY = 0; }
    const MW = m.w * T, MH = m.h * T;
    cam.scrollX = Math.round((MW <= VW ? (MW - VW) / 2 : clamp(P.x - VW / 2, 0, MW - VW)) + this.shakeX);
    cam.scrollY = Math.round((MH <= VH ? (MH - VH) / 2 : clamp(P.y - VH / 2, 0, MH - VH)) + this.shakeY);
    this.used = 0; this.textUsed = 0; const gg = this.gGround, gm = this.gMid, gt = this.gTop; gg.clear(); gm.clear(); gt.clear(); this.gScreen.clear();
    const vx0 = cam.scrollX - 32, vx1 = cam.scrollX + VW + 32, vy0 = cam.scrollY - 32, vy1 = cam.scrollY + VH + 48;
    const vis = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
    const night = isNight(); const t = W.clock;
    // exits
    for (const ex of m.exits) { const en = m.entries[ex.side]; if (en && dist(en.x, en.y, P.x, P.y) < 70) { const label = ex.to ? (ex.side === 'w' ? '< ' : '') + mapName(ex.to) + (ex.side === 'e' ? ' >' : '') : 'Saltmarsh (closed)'; this.text(label, clamp(en.x + (ex.side === 'w' ? 30 : -30), cam.scrollX + 50, cam.scrollX + VW - 50), en.y - 26, '#f2c14e'); } }
    // water sparkle & campfire flames (tile ambience)
    const tx0 = Math.max(0, Math.floor(cam.scrollX / T) - 1), ty0 = Math.max(0, Math.floor(cam.scrollY / T) - 1), tx1 = Math.min(m.w - 1, Math.floor((cam.scrollX + VW) / T) + 1), ty1 = Math.min(m.h - 1, Math.floor((cam.scrollY + VH) / T) + 2);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const tl = W.m[ty * m.w + tx];
      if (tl === TL.DEEP) { const ph = (t * 1.3 + (tx * 7 + ty * 13) % 10 / 10) % 3; if (ph < 0.25) { const sx = tx * T + ((tx * 5 + ty * 3) % 12) + 2, sy = ty * T + ((tx * 3 + ty * 11) % 10) + 3; gm.fillStyle(0xd8f2fa, 1 - ph * 4).fillRect(sx, sy, ph < 0.12 ? 1 : 3, 1); } }
      else if (tl === TL.CAMPFIRE) { const cx = tx * T + 8, cy = ty * T + 10; const f = Math.floor(t * 10) % 3; gm.fillStyle(0xff7a2a).fillTriangle(cx - 4, cy, cx, cy - 9 - f, cx + 4, cy); gm.fillStyle(0xffd166).fillTriangle(cx - 2, cy, cx + (f - 1), cy - 6 - f, cx + 2, cy); if (R() < 0.3) W.parts.push({ x: cx + R() * 6 - 3, y: cy - 8, vx: 0, vy: -18, life: 0.5, max: 0.5, col: '#ffb04a', size: 1, grav: 0 }); }
      else if (tl === TL.SHRINE && (S.flags.shrines || (W.defend && W.defend.x === tx * T + 8)) && R() < 0.06) W.parts.push({ x: tx * T + 4 + R() * 8, y: ty * T + 2, vx: 0, vy: -10, life: 0.8, max: 0.8, col: '#d8c0ff', size: 1, grav: 0 });
    }
    // overhead: crowns, roofs, awnings (depth-sorted with characters; fade when hiding you)
    const occl = (x0: number, y0: number, w: number, h: number, depth: number) => depth > P.y && P.x > x0 + 2 && P.x < x0 + w - 2 && P.y - 10 > y0 && P.y - 10 < y0 + h;
    for (let ty = ty0; ty <= Math.min(m.h - 1, ty1 + 1); ty++) for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) { if (tx < 0 || tx >= m.w) continue; const tl = W.m[ty * m.w + tx];
      if (tl === TL.TREE || tl === TL.DEADTREE) { const c = crown(tl === TL.TREE ? W.v[ty * m.w + tx] : 0, tl === TL.DEADTREE); const x = tx * T - 8, y = ty * T - 20, dep = ty * T + 12; this.img(c, x, y, dep, { ox: 0, oy: 0, alpha: occl(x, y, 32, 30, dep) ? 0.55 : 1 }); }
      else if (tl === TL.STALL && W.m[(ty - 1) * m.w + tx] !== TL.STALL) this.img(awning(tx), tx * T - 1, ty * T - 4, ty * T + 14, { ox: 0, oy: 0 });
    }
    for (const r of this.roofs) { const rs = roofSprite(r); if (!vis(rs.x + rs.c.width / 2, rs.y + rs.c.height / 2) && !vis(rs.x, rs.y)) continue; const dep = (r.y1 + 1) * T; this.img(rs.c, rs.x, rs.y, dep, { ox: 0, oy: 0, alpha: occl(rs.x, rs.y, rs.c.width, rs.c.height, dep) ? 0.6 : 1 }); }
    // cottage furniture
    if (m.id === 'cottage') this.drawFurniture(gt, t);
    // garden
    if (m.id === 'home') for (const k in S.plots) { const p = S.plots[k]; if (!p.crop) continue; const [x, y] = k.split(',').map(Number); const px = x * T + 8, py = y * T + 14; if (!vis(px, py)) continue;
      const stg = cropStage(p); this.img(cropSprite(p.crop, stg), px, py, py - 2); if (stg === 3 && Math.floor(t * 2 + x) % 6 === 0) gt.fillStyle(0xffffff, 0.9).fillRect(px + 3, py - 12, 1, 1); }
    // forage
    for (const n of forageNodes()) { if (!vis(n.x, n.y) || !nodeVisible(n)) continue; this.img(itemIcon(n.id, false), n.x, n.y + 2, n.y);
      if (n.glimmer && R() < 0.12) W.parts.push({ x: n.x + R() * 8 - 4, y: n.y - 4 - R() * 6, vx: 0, vy: -8, life: 0.6, max: 0.6, col: ING[n.id].a, size: 1, grav: 0 }); }
    // props
    for (const p of m.props) { if (!vis(p.x, p.y)) continue; let c: HTMLCanvasElement | null = null;
      switch (p.kind) { case 'cauldron': c = cauldron(Math.floor(t * 3) % 2, false); break; case 'crate': c = crate(); break; case 'rack': c = rack(BROOM_DYES[S.broom.dye], BPART[S.broom.bristle].col); break; case 'roost': c = roost(!!S.egg); break; case 'board': c = board(); break; case 'well': c = well(); break;
        case 'waystone': { const lit = !!S.flags['ws' + p.id.slice(5)]; c = miscSprite('waystone', { s: '#8a8aa0', x: lit ? '#9ad8e8' : '#4a4a5a' }); if (lit && R() < 0.05) W.parts.push({ x: p.x + R() * 6 - 3, y: p.y - 12, vx: 0, vy: -10, life: 0.7, max: 0.7, col: '#bcd4ff', size: 1, grav: 0 }); break; } }
      if (c) { this.shadow(gg, p.x, p.y + p.hh, c.width * 0.8); this.img(c, p.x, p.y + p.hh + 2, p.y); }
      if (p.kind === 'board' && S.flags.orders && (S.orders.some(o => !o.done) || S.bounty.list.some(b => !b.taken))) this.text('!', p.x, p.y - 14 + Math.sin(t * 4) * 1.5, '#f2c14e');
    }
    if (W.defend) { const D = W.defend; this.bar(gt, D.x, D.y - 22, 30, D.hp / D.max, 0xb06aff); gg.lineStyle(1, 0xb06aff, 0.4 + 0.3 * Math.sin(t * 6)).strokeEllipse(D.x, D.y + 2, 40, 14); }
    // npcs
    const nn = nearNpc();
    for (const n of activeNpcs()) { if (!vis(n.x, n.y)) continue; const near = dist(n.x, n.y, P.x, P.y) < 40; const dir: Dir = near ? dirOf(P.x - n.x, P.y - n.y) : 'down';
      const c = charSprite(n.look, dir, 0); this.shadow(gg, n.x, n.y + 2, 10); this.img(c, n.x, n.y + 3 + (Math.floor(t * 1.5 + n.x) % 2 ? 0 : 0), n.y, { flip: dir === 'side' && P.x < n.x });
      if (nn === n) this.text(n.name, n.x, n.y - c.height - 1, '#f2c14e');
      const mk2 = npcMarker(n.id); if (mk2) this.text(mk2, n.x, n.y - c.height - (nn === n ? 10 : 2) + Math.sin(t * 4) * 1.5, mk2 === '?' ? '#a8d65a' : '#f2c14e'); }
    const np = nearProp(), nf = nearFurn(); if (np && !nn) this.text(np.label, np.x, np.y - np.hh - 16, '#e9dfc7'); else if (nf && !nn && !W.deco.on) this.text(FURN[nf.id].use === 'sleep' ? 'Sleep (E)' : 'Chest (E)', nf.x, nf.y - nf.hh - 18, '#e9dfc7');
    // corpses (necromancer only)
    if (S.craft === 'necro') for (const c of W.corpses) { if (!vis(c.x, c.y) || !ENEMIES[c.id]) continue; this.img(enemySprite(c.id), c.x, c.y + 3, c.y - 1, { alpha: 0.35, tint: 0x8a8aa0 }); }
    // pickups
    for (const p of W.pickups) { if (!vis(p.x, p.y)) continue; const bob = Math.sin(t * 5 + p.x) * 1.5; const y = p.y - 2 + bob;
      if (p.k === 'gold') { gm.fillStyle(0x7a5a10).fillRect(p.x - 2, y - 1, 5, 4); gm.fillStyle(0xf2c14e).fillRect(p.x - 2, y - 2, 4, 4); gm.fillStyle(0xfff1b0).fillRect(p.x - 1, y - 2, 1, 1); }
      else if (p.k === 'mote') { gt.fillStyle(0xecfcff, 0.5 + 0.4 * Math.sin(t * 8 + p.x)).fillCircle(p.x, y - 6, 2.5); gt.fillStyle(0x9ad8e8).fillRect(p.x - 1, y - 7, 2, 2); }
      else if (p.k === 'item') this.img(itemIcon(p.id!, false), p.x, y + 4, p.y);
      else this.img(icon('bag', ['#cfc6b6', '#7fd1a0', '#f2c14e'][p.gear!.rar], '#2a1f43', false), p.x, y + 4, p.y); }
    // zones (ground)
    for (const z of W.zones) this.drawZone(gm, z, t);
    // allies
    for (const a of W.allies) { if (!vis(a.x, a.y)) continue; let c: HTMLCanvasElement;
      if (a.k === 'poppet') c = miscSprite('poppet', { y: '#e0c070', r: '#e0484f' }); else if (a.k === 'snapvine') c = miscSprite('snapvine', { g: '#2f6a2e', G: '#6ac04a' }); else if (a.k === 'thrall') c = miscSprite('thrall', { b: '#e8e0c8' }); else if (a.k === 'decoy') c = tinted(charSprite(playerLook(), 'down', 0), '#9ad8e8', 0.6); else c = tinted(enemySprite(a.id!), '#8affb0', 0.45);
      this.shadow(gg, a.x, a.y + 2, 8); this.img(c, a.x, a.y + 3 + (a.k === 'snapvine' ? Math.sin(t * 6) : 0), a.y, { flip: a.face < 0 && a.k === 'minion', alpha: a.k === 'decoy' ? 0.65 + 0.2 * Math.sin(t * 10) : 1 });
      if (a.k !== 'snapvine' && a.hp < a.max) this.bar(gt, a.x, a.y - c.height - 1, 12, a.hp / a.max, 0x8affb0); }
    // enemies
    for (const e of W.enemies) { if (!vis(e.x, e.y)) continue; const d = e.def;
      let c: HTMLCanvasElement; let flip = false; const fr = e.walk > 0 ? 1 + (Math.floor(e.walk * 7) % 2) : 0;
      if (e.wild) { c = famSprite(e.sp!, 1); flip = e.face < 0; }
      else if (d.look) { c = enemySprite(e.id, e.dir, fr); flip = e.dir === 'side' && e.face < 0; }
      else { c = enemySprite(e.id); flip = enemyFacesLeft(e.id) ? e.face > 0 : false; }
      const hov = d.fly ? Math.sin(t * 4 + e.home.x) * 2 - 3 : 0; this.shadow(gg, e.x, e.y + 2, e.sc > 1 ? 26 : 10);
      if (e.elite) { gg.fillStyle(0xf2c14e, 0.18 + 0.1 * Math.sin(t * 5)).fillEllipse(e.x, e.y + 2, 26, 9); }
      this.drawTelegraph(gm, gt, e, t);
      const y = e.y + 3 + hov; const flash = (e.flash > 0 && Math.floor(t * 30) % 2 === 0) || (e.tele > 0 && e.tele < 0.18 && Math.floor(t * 40) % 2 === 0);
      this.img(flash ? whiteOf(c) : c, e.x, y, e.y, { flip, tint: e.tele > 0 ? 0xffb0b0 : e.stun > 0 && e.def.ai.startsWith('boss_') ? 0xc0c0ff : undefined });
      const top = y - c.height;
      if (e.shield > 0) { gt.lineStyle(1, 0xbcd4ff, 0.5 + 0.3 * Math.sin(t * 6)); gt.strokeEllipse(e.x, e.y - c.height / 2 + 2, c.width + 8, c.height + 6); }
      if (e.wild) { if (e.dazed || dist(e.x, e.y, P.x, P.y) < 90) this.text(d.name, e.x, top - 2, e.dazed ? '#a8d65a' : elCol(d.el)); if (e.dazed) for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; gt.fillStyle(0xffd166).fillRect(e.x + Math.cos(a) * 7, top - 12 + Math.sin(a) * 2, 2, 2); } }
      else if (e.elite) this.text('Alpha ' + d.name, e.x, top - 5, '#f2c14e', 1e6 + 3);
      else if (d.el && dist(e.x, e.y, P.x, P.y) < 70 && e.hp >= e.max) { gt.fillStyle(0x120a18).fillRect(e.x - 2, top - 6, 5, 5); gt.fillStyle(hex(ELEMENT_INFO[d.el].col)).fillRect(e.x - 1, top - 5, 3, 3); }
      if (e.marks > 0) for (let k = 0; k < e.marks; k++) gt.fillStyle(0xffc8d8).fillRect(e.x - e.marks * 2 + k * 4, top - 8, 3, 3);
      if (e.curse > 0) gt.fillStyle(0xd06a8a, 0.8).fillRect(e.x - 1, top - 12, 3, 3);
      if (e.root > 0) { gt.lineStyle(1, 0xe0b040, 0.9); gt.strokeEllipse(e.x, e.y + 1, 14 * e.sc, 5); }
      if (e.slow > 0) gt.fillStyle(0x8a7ff0, 0.6).fillRect(e.x - c.width / 2, e.y + 2, c.width, 1);
      if (e.stun > 0) for (let k = 0; k < 2; k++) gt.fillStyle(0xffd166).fillRect(e.x - 3 + Math.sin(t * 12 + k * 3) * 5, top - 3, 2, 2);
      if (e.fear > 0) this.text('!', e.x + 6, top, '#ecfcff', 1e6 + 3);
      if (e.hp < e.max && !d.ai.startsWith('boss_') && !e.elite) { this.bar(gt, e.x, top - 3, 14, e.hp / e.max, e.wild ? 0xa8d65a : 0xe0484f); if (d.el) gt.fillStyle(hex(ELEMENT_INFO[d.el].col)).fillRect(e.x - 10, top - 4, 2, 3); }
    }
    // Pip
    if (W.pip && vis(W.pip.x, W.pip.y)) { const p = W.pip; const look: Look = { hat: 'crooked', hatCol: '#3a5a3a', band: '#9a5ad6', hair: '#e8d8a0', skin: '#f1c6a0', robe: '#5a7a4a' };
      const c = charSprite(look, p.walk > 0 ? 'side' : 'down', p.walk > 0 ? 1 + Math.floor(p.walk * 7) % 2 : 0); this.shadow(gg, p.x, p.y + 2, 9); this.img(c, p.x, p.y + 3, p.y, { flip: p.face < 0, alpha: p.inv > 0 && Math.floor(t * 20) % 2 ? 0.5 : 1 });
      this.bar(gt, p.x, p.y - c.height - 2, 14, p.hp / p.max, 0xa8d65a); if (p.wait) this.text('Pip waits', p.x, p.y - c.height - 6, '#e9dfc7'); }
    // familiar follower
    const fam = companion();
    if (fam && P.dead <= 0 && P.wild <= 0) { const sp = SPECIES[fam.sp]; const hover = sp.fly ? Math.sin(t * 5) * 2 - 3 : -Math.abs(Math.sin(t * 6)); const fy = P.flying ? W.F.y - 8 : W.F.y;
      this.shadow(gg, W.F.x, W.F.y + 2, 8 + fam.stage * 2); this.img(famSprite(fam.sp, fam.stage), W.F.x, fy + 3 + hover, fy, { flip: P.fx < -0.1 });
      if (fam.stage > 1 && R() < (fam.stage === 3 ? 0.3 : 0.12)) W.parts.push({ x: W.F.x + R() * 12 - 6, y: fy - R() * 14, vx: 0, vy: -10, life: 0.6, max: 0.6, col: fam.stage === 3 ? ELEMENT_INFO[sp.el].light : '#e9dfc7', size: 1, grav: 0 }); }
    // player
    this.drawPlayer(P, gg, t);
    // orbs
    for (const o of W.orbs) { gt.fillStyle(0xff7a2a).fillCircle(o.x, o.y, 3); gt.fillStyle(0xffd166).fillCircle(o.x - 0.5, o.y - 0.5, 1.6); }
    // projectiles
    for (const p of W.proj) { const z = p.z || 0; const col = hex(p.col), lt = hex(p.lt);
      if (p.kind === 'lob') gg.fillStyle(0x000000, 0.3).fillEllipse(p.x, p.y + 6, 6, 3);
      if (p.kind === 'net') { gt.lineStyle(1, 0xe9dfc7, 1); gt.strokeRect(p.x - 4, p.y - 4, 8, 8); gt.lineBetween(p.x - 4, p.y, p.x + 4, p.y); gt.lineBetween(p.x, p.y - 4, p.x, p.y + 4); continue; }
      const px = Math.round(p.x), py = Math.round(p.y - z);
      if (p.own === 'e') { gt.fillStyle(0x120a18).fillCircle(px, py, p.r + 1); gt.fillStyle(col).fillCircle(px, py, p.r); gt.fillStyle(lt).fillRect(px - 1, py - 1, 1, 1); continue; }
      gt.fillStyle(col).fillRect(px - p.r, py - p.r + 1, p.r * 2, p.r * 2 - 2); gt.fillRect(px - p.r + 1, py - p.r, p.r * 2 - 2, p.r * 2); gt.fillStyle(lt).fillRect(px - 1, py - 1, 2, 2); }
    // fx
    for (const f of W.fx) { const k = f.t / f.d; const col = hex(f.col), lt = hex(f.lt);
      if (f.k === 'ring') { gt.lineStyle(2, col, 1 - k); gt.strokeCircle(f.x, f.y, f.R * Math.min(1, k * 1.3)); gt.lineStyle(1, lt, 1 - k); gt.strokeCircle(f.x, f.y, f.R * Math.min(1, k * 1.3) * 0.8); }
      if (f.k === 'arc') { gt.lineStyle(3, lt, 1 - k); gt.beginPath(); gt.arc(f.x, f.y, f.R * 0.75, f.a! - 1.1, f.a! + 1.1); gt.strokePath(); gt.lineStyle(1, col, 1 - k); gt.beginPath(); gt.arc(f.x, f.y, f.R * 0.95, f.a! - 1.1, f.a! + 1.1); gt.strokePath(); }
      if (f.k === 'line') { gt.lineStyle(1, col, 1 - k); gt.lineBetween(f.x, f.y, f.tx!, f.ty!); }
      if (f.k === 'sigil') this.star(gt, f.x, f.y, 6 + k * 16, 0, 0xf2c14e, 1 - k); }
    for (const p of W.parts) gt.fillStyle(hex(p.col), clamp(p.life / p.max, 0, 1)).fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    for (const f of W.floats) { const tx = this.text(f.txt, f.x, f.y, f.col); tx.setAlpha(clamp(f.life / 0.4, 0, 1)); }
    // ambience
    if (m.id !== 'village' && m.id !== 'cottage' && night) for (let k = 0; k < 12; k++) { const fx2 = cam.scrollX + ((k * 97 + t * 8 * (k % 3 + 1)) % (VW + 20)) - 10, fy2 = cam.scrollY + (k * 53 + Math.sin(t + k) * 12) % VH; gt.fillStyle(0xe6ff96, 0.4 + 0.4 * Math.sin(t * 3 + k)).fillRect(Math.round(fx2), Math.round(fy2), 1, 1); }
    if (S.rain && m.id !== 'cottage') { this.gScreen.lineStyle(1, 0xa6c4e0, 0.5); for (let k = 0; k < 70; k++) { const rx = (k * 61 + t * 90) % (VW + 40) - 20, ry = (k * 37 + t * 260) % (VH + 20) - 10; this.gScreen.lineBetween(rx, ry, rx - 2, ry + 6); } }
    if (m.id === 'forest' && !S.flags.cleansed) this.gScreen.fillStyle(0x2a1040, 0.08).fillRect(0, 0, VW, VH);
    this.drawDarkness();
    if (W.deco.on) this.drawDeco(gt);
    if (P.hp < W.st.maxHp * 0.25 && P.dead <= 0) this.gScreen.fillStyle(0xe0484f, 0.08 + 0.06 * Math.sin(t * 6)).fillRect(0, 0, VW, VH);
    if (P.dead > 0) this.gScreen.fillStyle(0x000000, clamp(1 - P.dead / 1.6, 0, 1)).fillRect(0, 0, VW, VH);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].setVisible(false);
    for (let i = this.textUsed; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }
  private drawZone(g: Phaser.GameObjects.Graphics, z: import('../world/combat').Zone, t: number) {
    const col = hex(z.col);
    switch (z.k) {
      case 'sigil': { const a = z.arm > 0 ? 0.4 : 0.9; g.lineStyle(1, 0xe0b040, a); g.strokeCircle(z.x, z.y, 8); this.star(g, z.x, z.y, 7, t * 1.5, 0xfff1a8, a); break; }
      case 'circle': { g.lineStyle(2, 0xe0b040, 0.6 + 0.3 * Math.sin(t * 8)); g.strokeCircle(z.x, z.y - 2, z.r); g.lineStyle(1, 0xfff1a8, 0.5); g.strokeCircle(z.x, z.y - 2, z.r - 4); for (let k = 0; k < 6; k++) { const a = t * 1.2 + k * Math.PI / 3; g.fillStyle(0xfff1a8, 0.8).fillRect(z.x + Math.cos(a) * (z.r - 2) - 1, z.y - 2 + Math.sin(a) * (z.r - 2) - 1, 2, 2); } break; }
      case 'cloud': g.fillStyle(col, 0.18).fillCircle(z.x, z.y, z.r); break;
      case 'fire': g.fillStyle(0xff7a2a, 0.22 + 0.08 * Math.sin(t * 12 + z.x)).fillEllipse(z.x, z.y, z.r * 2, z.r * 1.2); break;
      case 'ward': g.fillStyle(0xfff1a8, 0.08).fillCircle(z.x, z.y, z.r); g.lineStyle(1, 0xfff1a8, 0.7).strokeCircle(z.x, z.y, z.r); break;
      case 'lantern': g.fillStyle(0x9ad8e8, 0.1).fillCircle(z.x, z.y, z.r); g.lineStyle(1, 0xecfcff, 0.5 + 0.3 * Math.sin(t * 4)).strokeCircle(z.x, z.y, z.r); this.img(miscSprite('lanternw', { m: '#5a5a6a', g: '#9ad8e8' }), z.x, z.y + 2, z.y); break;
      case 'delay': case 'spike': case 'blast': {
        const k = z.armMax ? 1 - z.arm / z.armMax : 1; const c = z.own === 'e' ? 0xe0484f : col; if (z.arm <= 0 && z.k !== 'spike') break;
        g.fillStyle(c, 0.12 + 0.18 * k).fillCircle(z.x, z.y, z.r * k); g.lineStyle(1, c, 0.6 + 0.4 * Math.sin(t * 20)).strokeCircle(z.x, z.y, z.r);
        if (z.k === 'spike' && z.arm <= 0) { g.fillStyle(0x6a4a2a).fillTriangle(z.x - 4, z.y + 2, z.x, z.y - 12, z.x + 4, z.y + 2); g.fillStyle(0x8a3a2a).fillTriangle(z.x + 3, z.y + 3, z.x + 7, z.y - 7, z.x + 10, z.y + 3); }
        break; }
    }
  }
  private drawTelegraph(g: Phaser.GameObjects.Graphics, gt: Phaser.GameObjects.Graphics, e: import('../world/combat').Enemy, t: number) {
    if (e.tele <= 0) return; const k = 1 - e.tele / e.teleMax; const red = 0xe0484f;
    const reach = (e.def.reach ?? 18) * (e.sc > 1 ? 1.6 : 1);
    switch (e.teleK) {
      case 'melee': { const R2 = e.def.ai.startsWith('boss_') ? 40 : reach; g.fillStyle(red, 0.15 + 0.3 * k); g.slice(e.x, e.y - 2, R2 * (0.4 + 0.6 * k), e.teleA - 1.05, e.teleA + 1.05, false); g.fillPath(); g.lineStyle(1, red, 0.8); g.beginPath(); g.arc(e.x, e.y - 2, R2, e.teleA - 1.05, e.teleA + 1.05); g.strokePath(); break; }
      case 'aim': gt.lineStyle(1, red, 0.25 + 0.5 * k); gt.lineBetween(e.x, e.y - 6 * e.sc, e.x + Math.cos(e.teleA) * 110, e.y - 6 * e.sc + Math.sin(e.teleA) * 110); break;
      case 'line': case 'charge': g.lineStyle(e.sc > 1 ? 10 : 6, red, 0.12 + 0.3 * k); g.lineBetween(e.x, e.y, e.x + Math.cos(e.teleA) * 110, e.y + Math.sin(e.teleA) * 110); break;
      case 'slam': g.fillStyle(red, 0.1 + 0.3 * k).fillCircle(e.x, e.y, 46 * k); g.lineStyle(1, red, 0.9).strokeCircle(e.x, e.y, 46); break;
      case 'burst': case 'ring': g.lineStyle(2, red, 0.4 + 0.5 * Math.sin(t * 30)).strokeCircle(e.x, e.y - 10, 14 + 10 * k); break;
      case 'fan': for (let j = -2; j <= 2; j++) { const a = e.teleA + j * 0.18; gt.lineStyle(1, red, 0.2 + 0.4 * k); gt.lineBetween(e.x, e.y - 12, e.x + Math.cos(a) * 100, e.y - 12 + Math.sin(a) * 100); } break;
    }
    if (e.tele > e.teleMax - 0.25) this.text('!', e.x, e.y - 22 * e.sc - 8, '#ff5050', 1e6 + 3);
  }
  private drawFurniture(gt: Phaser.GameObjects.Graphics, t: number) {
    for (const p of S.home.items) { const d = FURN[p.id]; if (!d) continue; const c = furnSprite(p.id); const held = W.deco.hold?.uid === p.uid;
      const alpha = held ? 0.35 : 1;
      if (d.kind === 'rug') this.img(c, (p.x + d.w / 2) * T, (p.y + d.h / 2) * T, -9, { oy: 0.5, alpha });
      else if (d.kind === 'wall') this.img(c, (p.x + 0.5) * T, (COTTAGE.wallY + 1) * T - 2, -8, { alpha });
      else { this.shadow(this.gGround, (p.x + d.w / 2) * T, (p.y + d.h) * T - 1, d.w * T - 2); this.img(c, (p.x + d.w / 2) * T, (p.y + d.h) * T, (p.y + d.h) * T - 2, { alpha }); }
      if (p.id === 'fireplace' && !held) { const cx = (p.x + 1) * T, cy = (p.y + 1) * T - 3; if (R() < 0.4) W.parts.push({ x: cx + R() * 12 - 6, y: cy - 2, vx: 0, vy: -16, life: 0.4, max: 0.4, col: R() < 0.5 ? '#ffd166' : '#ff7a2a', size: 1, grav: 0 }); }
      if (p.id === 'clock' && Math.floor(t) % 2 === 0) gt.fillStyle(0xc8a040).fillRect((p.x + 0.5) * T - 1, (p.y + 1) * T - 5, 2, 2);
    }
  }
  private drawDeco(g: Phaser.GameObjects.Graphics) {
    const C = COTTAGE; g.lineStyle(1, 0xe9dfc7, 0.12);
    for (let x = C.x0; x <= C.x1 + 1; x++) g.lineBetween(x * T, C.y0 * T, x * T, (C.y1 + 1) * T);
    for (let y = C.y0; y <= C.y1 + 1; y++) g.lineBetween(C.x0 * T, y * T, (C.x1 + 1) * T, y * T);
    const gx = Math.floor(W.aim.x / T), gy = Math.floor(W.aim.y / T); const D = W.deco;
    if (D.hold) { const d = FURN[D.hold.id]; const why = furnFits(D.hold.id, gx, gy, D.hold.uid); const ok = !why; const col = ok ? 0x7fd1a0 : 0xe0484f;
      const c = furnSprite(D.hold.id); const wh = d.kind === 'wall' ? 1 : d.h; const y0 = d.kind === 'wall' ? C.wallY : gy;
      g.fillStyle(col, 0.22).fillRect(gx * T, y0 * T, d.w * T, wh * T); g.lineStyle(1, col, 0.9).strokeRect(gx * T, y0 * T, d.w * T, wh * T);
      if (d.kind === 'rug') this.img(c, (gx + d.w / 2) * T, (gy + d.h / 2) * T, 1e6 - 1, { oy: 0.5, alpha: 0.7 });
      else if (d.kind === 'wall') this.img(c, (gx + 0.5) * T, (C.wallY + 1) * T - 2, 1e6 - 1, { alpha: 0.7 });
      else this.img(c, (gx + d.w / 2) * T, (gy + d.h) * T, 1e6 - 1, { alpha: 0.7 });
      if (why) this.text(why, (gx + d.w / 2) * T, y0 * T - 4, '#ffb0b0', 1e6 + 3);
    } else { const hit = S.home.items.find(p => { const d = FURN[p.id]; return gx >= p.x && gx < p.x + d.w && gy >= p.y - (d.kind === 'wall' ? 1 : 0) && gy < p.y + (d.kind === 'wall' ? 1 : d.h); });
      if (hit) { const d = FURN[hit.id]; g.lineStyle(1, 0xf2c14e, 0.9).strokeRect(hit.x * T, (d.kind === 'wall' ? C.wallY - 1 : hit.y) * T, d.w * T, (d.kind === 'wall' ? 2 : d.h) * T); this.text(d.name, (hit.x + d.w / 2) * T, (d.kind === 'wall' ? C.wallY - 1 : hit.y) * T - 2, '#f2c14e'); } }
  }
  private drawPlayer(P: Player, gg: Phaser.GameObjects.Graphics, t: number) {
    if (P.dead > 0) return;
    if (P.inv > 0 && P.roll <= 0 && P.dashT <= 0 && P.air <= 0 && Math.floor(t * 20) % 2) return;
    const look = playerLook(); const dir = dirOf(P.fx, P.fy); const flip = dir === 'side' && P.fx < 0;
    if (P.wild > 0) { const c = companion(); const sp = c ? c.sp : 'sparkit'; const s = scale2x(famSprite(sp, c ? c.stage : 1)); this.shadow(gg, P.x, P.y + 2, 18); this.img(s, P.x, P.y + 4, P.y, { flip: P.fx < 0 }); return; }
    if (P.flying) { const fr = Math.floor(t * 8) % 2; const L = BPART[S.broom.lantern]; const s = broomRider16(look, BROOM_DYES[S.broom.dye], BPART[S.broom.bristle].col, L.id === 'none' ? null : L.col, fr);
      this.shadow(gg, P.x, P.y + 4, 16); this.img(s, P.x, P.y - 6 + Math.sin(t * 4) * 1.5, P.y, { flip: P.fx < 0 }); return; }
    const air = P.air > 0 ? Math.sin((0.28 - P.air) / 0.28 * Math.PI) * 10 : 0;
    const moving = P.walk > 0; const fr = moving ? 1 + (Math.floor(P.walk * (P.roll > 0 ? 16 : 8)) % 2) : 0;
    const s = charSprite(look, dir, fr); const bob = moving && fr === 1 ? 1 : 0;
    this.shadow(gg, P.x, P.y + 2, 11);
    if (P.roll > 0) { this.img(s, P.x - P.rollV.x * 0.04, P.y + 4 - bob, P.y - 1, { flip, alpha: 0.35 }); this.img(s, P.x, P.y + 5, P.y, { flip, alpha: 0.85 }); }
    else this.img(s, P.x, P.y + 4 - bob - air, P.y, { flip });
    if (P.net > 0) for (let k = -6; k <= 6; k += 3) { this.gTop.lineStyle(1, 0xe9dfc7, 0.9); this.gTop.lineBetween(P.x + k, P.y - 24, P.x + k, P.y + 2); this.gTop.lineBetween(P.x - 7, P.y - 20 + k + 6, P.x + 7, P.y - 20 + k + 6); }
    if (P.buffs.ward) { this.gTop.lineStyle(1, 0xead2a2, 0.6); this.gTop.strokeRect(P.x - 9, P.y - 25, 18, 28); }
    if (P.shield > 0) { this.gTop.lineStyle(1, 0xa6e4ff, 0.6 + 0.3 * Math.sin(t * 8)); this.gTop.strokeEllipse(P.x, P.y - 10, 24, 30); }
    if (P.bastion > 0) { this.gTop.lineStyle(2, 0xc09a60, 0.8); this.gTop.strokeEllipse(P.x, P.y - 10, 22, 28); }
  }
  private shadow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) { g.fillStyle(0x000000, 0.28).fillEllipse(Math.round(x), Math.round(y), w, 4); }
  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, f: number, col: number) { g.fillStyle(0x000000).fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, w + 2, 3); g.fillStyle(col).fillRect(Math.round(x - w / 2), Math.round(y), Math.max(1, Math.round(w * clamp(f, 0, 1))), 1); }
  private star(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, rot: number, col: number, a: number) { g.lineStyle(1, col, a); g.beginPath(); for (let i = 0; i <= 5; i++) { const an = -Math.PI / 2 + rot + i * Math.PI * 4 / 5; const px = x + Math.cos(an) * r, py = y + Math.sin(an) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.strokePath(); }
  private drawDarkness() {
    const a = darkness(); const g = this.darkCanvas.getContext('2d')!;
    if (a <= 0.01) { if (this.darkOn) { g.clearRect(0, 0, VW, VH); this.darkTex.refresh(); this.darkOn = false; } this.dark.setVisible(false); return; }
    this.darkOn = true; this.dark.setVisible(true); const cam = this.cameras.main;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, VW, VH); g.fillStyle = `rgba(10,8,32,${a})`; g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = 'destination-out';
    const light = (x: number, y: number, r: number) => { const sx = x - cam.scrollX, sy = y - cam.scrollY; if (sx < -r || sy < -r || sx > VW + r || sy > VH + r) return;
      const grad = g.createRadialGradient(sx, sy, r * 0.1, sx, sy, r); grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.85)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(sx - r, sy - r, r * 2, r * 2); };
    const P = W.P, m = W.map; light(P.x, P.y - 8, m.id === 'cottage' ? 30 : lightRadius());
    const tx0 = Math.max(0, Math.floor(cam.scrollX / T) - 2), ty0 = Math.max(0, Math.floor(cam.scrollY / T) - 2), tx1 = Math.min(m.w - 1, tx0 + VW / T + 4), ty1 = Math.min(m.h - 1, ty0 + VH / T + 4);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const tt = W.m[ty * m.w + tx]; if (tt === TL.WINDOW) light(tx * T + 8, ty * T + 12, 28); else if (tt === TL.CAMPFIRE) light(tx * T + 8, ty * T + 8, 60 + Math.sin(W.clock * 9) * 3); else if (tt === TL.SHRINE && S.flags.shrines) light(tx * T + 8, ty * T + 6, 22); }
    for (const n of forageNodes()) if (n.glimmer && nodeVisible(n)) light(n.x, n.y, 16);
    if (m.id === 'home') for (const k in S.plots) { const p = S.plots[k]; if (p.crop === 'moonpetal' && cropStage(p) === 3) { const [x, y] = k.split(',').map(Number); light(x * T + 8, y * T + 8, 18); } }
    if (m.id === 'cottage') for (const p of S.home.items) { const d = FURN[p.id]; if (d?.light) light((p.x + d.w / 2) * T, (p.y + 0.3) * T, d.light + Math.sin(W.clock * 7 + p.x) * 2); }
    for (const z of W.zones) if (z.k === 'circle' || z.k === 'sigil' || z.k === 'lantern' || z.k === 'fire') light(z.x, z.y, z.k === 'circle' ? z.r + 10 : z.k === 'lantern' ? z.r + 6 : 14);
    for (const p of W.proj) if (p.own !== 'e') light(p.x, p.y, 14);
    for (const n of activeNpcs()) if (n.id === 'ysolde') light(n.x, n.y - 8, 20);
    for (const pr of m.props) if (pr.kind === 'cauldron') light(pr.x, pr.y, 26); else if (pr.kind === 'waystone' && S.flags['ws' + pr.id.slice(5)]) light(pr.x, pr.y - 8, 18);
    g.globalCompositeOperation = 'source-over'; this.darkTex.refresh();
  }
}
function mapName(id: string) { return { home: 'Thistledown', village: 'Hollowmere', forest: 'Brindlewood', cottage: 'Cottage' }[id] || id; }
export { mk };
