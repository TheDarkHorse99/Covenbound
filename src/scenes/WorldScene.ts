import Phaser from 'phaser';
import { T, VW, VH, clamp, dist, R } from '../core/util';
import { S, companion } from '../core/state';
import { W, hooks, cropStage, nodeVisible, forageNodes, isNight, darkness, lightRadius, activeNpcs, nearNpc, nearProp, update as worldUpdate, useSelected, interact, Player } from '../world/world';
import { buildTileset, tileIndex, TL, ANIMATED } from '../world/tiles';
import { famSprite, enemySprite, witchSprite, broomRider, cropSprite, itemIcon, miscSprite, LEFT_FACING, Look, icon } from '../art/sprites';
import { whiteOf, tinted, mk } from '../art/pixel';
import { cauldron, crate, rack, roost, board, well, lightTexture } from '../art/props';
import { SPECIES } from '../data/familiars';
import { ENEMIES } from '../data/enemies';
import { CRAFTS } from '../data/crafts';
import { BPART, BROOM_DYES } from '../data/gear';
import { QUESTS } from '../data/quests';
import { ING, CROP } from '../data/brewing';
import { game } from '../ui/state';

export function playerLook(): Look {
  const h = S.eq.hat; return { hat: h?.hat || 'pointed', hatCol: h?.hatCol || '#2a2140', band: h ? ['#6a5a80', '#7fd1a0', '#f2c14e'][h.rar] : '#6a5a80', hair: S.hair, skin: S.skin, robe: S.robe };
}

export class WorldScene extends Phaser.Scene {
  private tilesTex!: Phaser.Textures.CanvasTexture;
  private tileCanvas!: HTMLCanvasElement;
  private map?: Phaser.Tilemaps.Tilemap;
  private layer?: Phaser.Tilemaps.TilemapLayer;
  private pool: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private texKeys = new WeakMap<HTMLCanvasElement, string>();
  private texN = 0;
  private gGround!: Phaser.GameObjects.Graphics;
  private gTop!: Phaser.GameObjects.Graphics;
  private gScreen!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private textUsed = 0;
  private darkCanvas!: HTMLCanvasElement;
  private darkTex!: Phaser.Textures.CanvasTexture;
  private dark!: Phaser.GameObjects.Image;
  private darkOn = false;
  private animT = 0; private frame = 0; private mapId = '';
  private shakeX = 0; private shakeY = 0;

  constructor() { super('world'); }

  create() {
    this.tileCanvas = buildTileset(0);
    this.tilesTex = this.textures.addCanvas('tiles', this.tileCanvas)!;
    this.textures.addCanvas('light', lightTexture());
    this.gGround = this.add.graphics().setDepth(-5);
    this.gTop = this.add.graphics().setDepth(1e6);
    this.darkCanvas = mk(VW, VH); this.darkTex = this.textures.addCanvas('dark', this.darkCanvas)!;
    this.dark = this.add.image(0, 0, 'dark').setOrigin(0, 0).setScrollFactor(0).setDepth(1e6 + 1);
    this.gScreen = this.add.graphics().setScrollFactor(0).setDepth(1e6 + 2);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (!S || !W.P) return; W.aim.x = p.worldX; W.aim.y = p.worldY; W.aim.mouse = true; W.aim.t = W.clock; });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!game.playing || game.blocked()) return; W.aim.x = p.worldX; W.aim.y = p.worldY; W.aim.mouse = true; W.aim.t = W.clock;
      if (p.rightButtonDown()) interact(); else useSelected({ x: p.worldX, y: p.worldY });
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => { if (!game.playing || game.blocked()) return; S.sel = (S.sel + (dy > 0 ? 1 : 9)) % 10; hooks.hud(); });
    hooks.tile = (i: number) => { if (!this.layer) return; const x = i % W.map.w, y = (i / W.map.w) | 0; this.layer.putTileAt(tileIndex(W.m[i], W.v[i]), x, y); };
    hooks.mapChanged = () => this.buildMap();
    (window as unknown as Record<string, unknown>).__scene = this;
    game.sceneReady();
  }

  private buildMap() {
    if (this.map) { this.map.destroy(); this.map = undefined; this.layer = undefined; }
    const m = W.map; this.mapId = m.id;
    this.map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: m.w, height: m.h });
    const ts = this.map.addTilesetImage('tiles', 'tiles', T, T, 0, 0)!;
    this.layer = this.map.createBlankLayer('ground', ts, 0, 0)!.setDepth(-10);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const i = y * m.w + x; this.layer.putTileAt(tileIndex(W.m[i], W.v[i]), x, y); }
    this.cameras.main.setBounds(0, 0, m.w * T, m.h * T);
  }

  private tex(c: HTMLCanvasElement): string {
    let k = this.texKeys.get(c); if (k) return k;
    k = 'c' + (this.texN++); this.textures.addCanvas(k, c); this.texKeys.set(c, k); return k;
  }
  private img(c: HTMLCanvasElement, x: number, y: number, depth: number, o: { flip?: boolean; alpha?: number; ox?: number; oy?: number; tint?: number } = {}) {
    let im = this.pool[this.used]; if (!im) { im = this.add.image(0, 0, this.tex(c)); this.pool.push(im); }
    this.used++; im.setScrollFactor(1); im.setTexture(this.tex(c)); im.setOrigin(o.ox ?? 0.5, o.oy ?? 1); im.setPosition(Math.round(x), Math.round(y)); im.setDepth(depth); im.setFlipX(!!o.flip); im.setAlpha(o.alpha ?? 1); im.setVisible(true);
    if (o.tint !== undefined) im.setTint(o.tint); else im.clearTint();
    return im;
  }
  private text(txt: string, x: number, y: number, col: string, depth = 1e6 + 3, size = 8, screen = false) {
    let t = this.texts[this.textUsed]; if (!t) { t = this.add.text(0, 0, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#fff', stroke: '#120a18', strokeThickness: 2, resolution: 2 }); this.texts.push(t); }
    this.textUsed++; if (t.text !== txt) t.setText(txt); t.setColor(col); t.setFontSize(size); t.setOrigin(0.5, 1); t.setPosition(Math.round(x), Math.round(y)); t.setDepth(depth); t.setVisible(true); t.setScrollFactor(screen ? 0 : 1); t.setAlpha(1);
    return t;
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    if (!game.playing || !S || !W.P) { this.hideAll(); this.renderTitle(dt); return; }
    if (this.mapId !== W.map.id || !this.layer) this.buildMap(); this.layer?.setVisible(true);
    if (!game.blocked()) { game.pollInput(); worldUpdate(dt); }
    this.animT += dt; if (this.animT > 0.45 && !(window as unknown as { __noAnim?: boolean }).__noAnim) { this.animT = 0; this.frame ^= 1; buildTileset(this.frame, this.tileCanvas); this.tilesTex.refresh(); }
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
    for (let x = 0; x < VW; x += 12) { const h = 30 + ((x * 37) % 23); g.fillStyle(0x16261a).fillRect(x, VH - h, 12, h); g.fillStyle(0x0f1a12).fillTriangle(x - 2, VH - h + 2, x + 6, VH - h - 14, x + 14, VH - h + 2); }
    g.fillStyle(0x2a1f43).fillRect(40, VH - 52, 30, 22); g.fillStyle(0x4a2a6a).fillTriangle(36, VH - 52, 55, VH - 66, 74, VH - 52); g.fillStyle(0xf2c14e).fillRect(46, VH - 46, 5, 5);
    const wx = ((t * 34) % (VW + 80)) - 40, wy = 78 + Math.sin(t * 2) * 8;
    const look = { hat: 'pointed' as const, hatCol: '#2a2140', band: '#f2c14e', hair: '#c0502a', skin: '#d9c7f0', robe: '#6b3fa0' };
    const im = this.img(broomRider(look, '#b08a5a', '#e0c070', '#f2c14e', Math.floor(t * 8) % 2), wx, wy, 1e6 + 5); im.setScrollFactor(0);
    const f = this.img(famSprite('fluffowl', 1), wx - 22, wy - 8 + Math.sin(t * 6) * 2, 1e6 + 5); f.setScrollFactor(0);
    for (let k = 0; k < 3; k++) g.fillStyle(0xfff1a8, 0.6).fillRect(wx - 16 - k * 6 - (t * 40 % 6), wy - 4 + k, 2, 1);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].setVisible(false);
    for (const im2 of this.pool.slice(0, this.used)) im2.setScrollFactor(0);
  }
  private hideAll() { for (const im of this.pool) im.setVisible(false); for (const t of this.texts) t.setVisible(false); this.gTop?.clear(); this.gGround?.clear(); this.gScreen?.clear(); this.dark?.setVisible(false); if (this.layer) this.layer.setVisible(false); }

  private render() {
    const P = W.P, cam = this.cameras.main, m = W.map;
    if (W.shakeT > 0) { this.shakeX = (R() - 0.5) * W.shakeA; this.shakeY = (R() - 0.5) * W.shakeA; } else { this.shakeX = this.shakeY = 0; }
    cam.scrollX = Math.round(clamp(P.x - VW / 2, 0, Math.max(0, m.w * T - VW)) + this.shakeX);
    cam.scrollY = Math.round(clamp(P.y - VH / 2, 0, Math.max(0, m.h * T - VH)) + this.shakeY);
    this.used = 0; this.textUsed = 0; const gg = this.gGround, gt = this.gTop; gg.clear(); gt.clear(); this.gScreen.clear();
    const vx0 = cam.scrollX - 32, vx1 = cam.scrollX + VW + 32, vy0 = cam.scrollY - 32, vy1 = cam.scrollY + VH + 48;
    const vis = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
    const night = isNight(); const t = W.clock;
    // exits
    for (const ex of m.exits) { const en = m.entries[ex.side]; if (en && dist(en.x, en.y, P.x, P.y) < 70) { const label = ex.to ? (ex.side === 'w' ? '< ' : '') + mapName(ex.to) + (ex.side === 'e' ? ' >' : '') : 'Saltmarsh (closed)'; this.text(label, clamp(en.x + (ex.side === 'w' ? 30 : -30), cam.scrollX + 50, cam.scrollX + VW - 50), en.y - 24, '#f2c14e'); } }
    // garden
    if (m.id === 'home') for (const k in S.plots) { const p = S.plots[k]; if (!p.crop) continue; const [x, y] = k.split(',').map(Number); const px = x * T + 8, py = y * T + 14; if (!vis(px, py)) continue;
      const stg = cropStage(p); this.img(cropSprite(p.crop, stg), px, py, py - 2); if (stg === 3 && Math.floor(t * 2 + x) % 6 === 0) gt.fillStyle(0xffffff, 0.9).fillRect(px + 3, py - 12, 1, 1); }
    // forage
    for (const n of forageNodes()) { if (!vis(n.x, n.y) || !nodeVisible(n)) continue; const c = itemIcon(n.id, 1); this.img(c, n.x, n.y + 2, n.y);
      if (n.glimmer && R() < 0.12) W.parts.push({ x: n.x + R() * 8 - 4, y: n.y - 4 - R() * 6, vx: 0, vy: -8, life: 0.6, max: 0.6, col: ING[n.id].a, size: 1, grav: 0 }); }
    // props
    for (const p of m.props) { if (!vis(p.x, p.y)) continue; let c: HTMLCanvasElement | null = null;
      switch (p.kind) { case 'cauldron': c = cauldron(Math.floor(t * 3) % 2, false); break; case 'crate': c = crate(); break; case 'rack': c = rack(BROOM_DYES[S.broom.dye], BPART[S.broom.bristle].col); break; case 'roost': c = roost(!!S.egg); break; case 'board': c = board(); break; case 'well': c = well(); break; }
      if (c) this.img(c, p.x, p.y + p.hh + 2, p.y);
      if (p.kind === 'board' && S.flags.orders && S.orders.some(o => !o.done)) this.text('!', p.x, p.y - 12 + Math.sin(t * 4) * 1.5, '#f2c14e');
    }
    // npcs
    const nn = nearNpc();
    for (const n of activeNpcs()) { if (!vis(n.x, n.y)) continue; const c = witchSprite(n.look, 0); this.img(c, n.x, n.y + 3, n.y, { flip: P.x < n.x });
      if (nn === n) this.text(n.name, n.x, n.y - c.height - 2, '#f2c14e');
      if (n.id === 'wren' && (S.q.ready || (QUESTS[S.q.i] && S.q.i === 0 && S.day === 1))) this.text('!', n.x, n.y - c.height - 10 + Math.sin(t * 4) * 1.5, '#f2c14e'); }
    const np = nearProp(); if (np && !nn) this.text(np.label, np.x, np.y - np.hh - 14, '#e9dfc7');
    // corpses (necromancer only)
    if (S.craft === 'necro') for (const c of W.corpses) { if (!vis(c.x, c.y)) continue; const d = ENEMIES[c.id]; this.img(enemySprite(c.id, d.scale || 1), c.x, c.y + 3, c.y - 1, { alpha: 0.35, tint: 0x8a8aa0 }); }
    // pickups
    for (const p of W.pickups) { if (!vis(p.x, p.y)) continue; const bob = Math.sin(t * 5 + p.x) * 1.5; const y = p.y - 2 + bob;
      if (p.k === 'gold') { gg.fillStyle(0x7a5a10).fillRect(p.x - 2, y - 1, 5, 4); gg.fillStyle(0xf2c14e).fillRect(p.x - 2, y - 2, 4, 4); gg.fillStyle(0xfff1b0).fillRect(p.x - 1, y - 2, 1, 1); }
      else if (p.k === 'item') this.img(itemIcon(p.id!, 1), p.x, y + 4, p.y);
      else this.img(icon('bag', ['#cfc6b6', '#7fd1a0', '#f2c14e'][p.gear!.rar], '#2a1f43', 1), p.x, y + 4, p.y); }
    // zones (ground)
    for (const z of W.zones) {
      if (z.k === 'sigil') { const a = z.arm > 0 ? 0.4 : 0.9; gg.lineStyle(1, 0xe0b040, a); gg.strokeCircle(z.x, z.y, 8); this.star(gg, z.x, z.y, 7, t * 1.5, 0xfff1a8, a); }
      if (z.k === 'circle') { gg.lineStyle(2, 0xe0b040, 0.6 + 0.3 * Math.sin(t * 8)); gg.strokeCircle(z.x, z.y - 2, z.r); gg.lineStyle(1, 0xfff1a8, 0.5); gg.strokeCircle(z.x, z.y - 2, z.r - 4); for (let k = 0; k < 6; k++) { const a = t * 1.2 + k * Math.PI / 3; gg.fillStyle(0xfff1a8, 0.8).fillRect(z.x + Math.cos(a) * (z.r - 2) - 1, z.y - 2 + Math.sin(a) * (z.r - 2) - 1, 2, 2); } }
      if (z.k === 'cloud') { gg.fillStyle(Phaser.Display.Color.HexStringToColor(z.col).color, 0.18).fillCircle(z.x, z.y, z.r); }
      if (z.k === 'rootspike') { gg.lineStyle(1, 0xe0484f, z.arm > 0 ? 0.5 + 0.5 * Math.sin(t * 20) : 0.9); gg.strokeCircle(z.x, z.y, z.r); if (z.arm <= 0) { gg.fillStyle(0x6a4a2a).fillTriangle(z.x - 4, z.y + 2, z.x, z.y - 12, z.x + 4, z.y + 2); gg.fillStyle(0x8a3a2a).fillTriangle(z.x + 3, z.y + 3, z.x + 7, z.y - 7, z.x + 10, z.y + 3); } }
    }
    // allies
    for (const a of W.allies) { if (!vis(a.x, a.y)) continue; let c: HTMLCanvasElement;
      if (a.k === 'poppet') c = miscSprite('poppet', { y: '#e0c070', r: '#e0484f' }); else if (a.k === 'snapvine') c = miscSprite('snapvine', { g: '#2f6a2e', G: '#6ac04a' }); else if (a.k === 'thrall') c = miscSprite('thrall', { b: '#e8e0c8' }); else c = tinted(enemySprite(a.id!, 1), '#8affb0', 0.45);
      this.shadow(gg, a.x, a.y + 2, 8); this.img(c, a.x, a.y + 3 + (a.k === 'snapvine' ? Math.sin(t * 6) : 0), a.y, { flip: a.face < 0 && a.k === 'minion' });
      if (a.k !== 'snapvine' && a.hp < a.max) this.bar(gt, a.x, a.y - c.height - 1, 12, a.hp / a.max, 0x8affb0); }
    // enemies
    for (const e of W.enemies) { if (!vis(e.x, e.y)) continue; const d = e.def;
      const c = e.wild ? famSprite(e.sp!, 1) : enemySprite(e.id, e.sc);
      const shape = e.wild ? SPECIES[e.sp!].shape : d.sprite; const flip = LEFT_FACING.has(shape) ? e.face > 0 : (d.sprite === 'human' ? e.face < 0 : false);
      const hov = d.fly ? Math.sin(t * 4 + e.home.x) * 2 - 3 : 0; this.shadow(gg, e.x, e.y + 2, e.sc > 1 ? 24 : 9);
      const y = e.y + 3 + hov; const im = this.img(e.flash > 0 && Math.floor(t * 30) % 2 === 0 ? whiteOf(c) : c, e.x, y, e.y, { flip });
      if (e.tele > 0) { gt.lineStyle(1, 0xe0484f, 1); gt.strokeRect(e.x - c.width / 2 - 1, y - c.height - 1, c.width + 2, c.height + 2); }
      const top = y - c.height;
      if (e.wild) { if (e.dazed || dist(e.x, e.y, P.x, P.y) < 90) this.text(d.name, e.x, top - 2, e.dazed ? '#a8d65a' : '#f2c14e'); if (e.dazed) for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; gt.fillStyle(0xffd166).fillRect(e.x + Math.cos(a) * 7, top - 12 + Math.sin(a) * 2, 2, 2); } }
      if (e.marks > 0) for (let k = 0; k < e.marks; k++) gt.fillStyle(0xffc8d8).fillRect(e.x - e.marks * 2 + k * 4, top - 7, 3, 3);
      if (e.root > 0) { gt.lineStyle(1, 0xe0b040, 0.9); gt.strokeEllipse(e.x, e.y + 1, 14 * e.sc, 5); }
      if (e.slow > 0) gt.fillStyle(0x8a7ff0, 0.6).fillRect(e.x - c.width / 2, e.y + 2, c.width, 1);
      if (e.stun > 0) gt.fillStyle(0xffd166).fillRect(e.x - 3 + Math.sin(t * 12) * 3, top - 3, 2, 2);
      if (e.hp < e.max && !(d.boss || d.elite)) this.bar(gt, e.x, top - 3, 14, e.hp / e.max, e.wild ? 0xa8d65a : 0xe0484f);
      void im;
    }
    // companion familiar
    const fam = companion();
    if (fam && P.dead <= 0 && P.wild <= 0) { const sp = SPECIES[fam.sp]; const hover = sp.fly ? Math.sin(t * 5) * 2 - 3 : -Math.abs(Math.sin(t * 6)); const fy = P.flying ? W.F.y - 8 : W.F.y;
      this.shadow(gg, W.F.x, W.F.y + 2, 8); this.img(famSprite(fam.sp, fam.stage), W.F.x, fy + 3 + hover, fy, { flip: P.fx < -0.1 && fam.sp === 'pebbleshell' });
      if (fam.stage > 1 && R() < (fam.stage === 3 ? 0.3 : 0.12)) W.parts.push({ x: W.F.x + R() * 12 - 6, y: fy - R() * 12, vx: 0, vy: -10, life: 0.6, max: 0.6, col: fam.stage === 3 ? '#fff1a8' : '#e9dfc7', size: 1, grav: 0 }); }
    // player
    this.drawPlayer(P, gg, t);
    // projectiles
    for (const p of W.proj) { const z = p.z || 0; const col = Phaser.Display.Color.HexStringToColor(p.col).color, lt = Phaser.Display.Color.HexStringToColor(p.lt).color;
      if (p.kind === 'lob') { gg.fillStyle(0x000000, 0.3).fillEllipse(p.x, p.y + 6, 6, 3); }
      if (p.kind === 'net') { gt.lineStyle(1, 0xe9dfc7, 1); gt.strokeRect(p.x - 4, p.y - 4, 8, 8); gt.lineBetween(p.x - 4, p.y, p.x + 4, p.y); gt.lineBetween(p.x, p.y - 4, p.x, p.y + 4); continue; }
      gt.fillStyle(col).fillRect(Math.round(p.x) - p.r, Math.round(p.y - z) - p.r + 1, p.r * 2, p.r * 2 - 2); gt.fillRect(Math.round(p.x) - p.r + 1, Math.round(p.y - z) - p.r, p.r * 2 - 2, p.r * 2); gt.fillStyle(lt).fillRect(Math.round(p.x) - 1, Math.round(p.y - z) - 1, 2, 2); }
    // fx
    for (const f of W.fx) { const k = f.t / f.d; const col = Phaser.Display.Color.HexStringToColor(f.col).color, lt = Phaser.Display.Color.HexStringToColor(f.lt).color;
      if (f.k === 'ring') { gt.lineStyle(2, col, 1 - k); gt.strokeCircle(f.x, f.y, f.R * Math.min(1, k * 1.3)); gt.lineStyle(1, lt, 1 - k); gt.strokeCircle(f.x, f.y, f.R * Math.min(1, k * 1.3) * 0.8); }
      if (f.k === 'arc') { gt.lineStyle(3, lt, 1 - k); gt.beginPath(); gt.arc(f.x, f.y, f.R * 0.75, f.a! - 1.1, f.a! + 1.1); gt.strokePath(); gt.lineStyle(1, col, 1 - k); gt.beginPath(); gt.arc(f.x, f.y, f.R * 0.95, f.a! - 1.1, f.a! + 1.1); gt.strokePath(); }
      if (f.k === 'line') { gt.lineStyle(1, col, 1 - k); gt.lineBetween(f.x, f.y, f.tx!, f.ty!); }
      if (f.k === 'sigil') this.star(gt, f.x, f.y, 6 + k * 16, 0, 0xf2c14e, 1 - k); }
    // particles
    for (const p of W.parts) { gt.fillStyle(Phaser.Display.Color.HexStringToColor(p.col).color, clamp(p.life / p.max, 0, 1)).fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
    // floats
    for (const f of W.floats) { const tx = this.text(f.txt, f.x, f.y, f.col); tx.setAlpha(clamp(f.life / 0.4, 0, 1)); }
    // ambience: fireflies, rain, darkness
    if (m.id !== 'village' && night) for (let k = 0; k < 12; k++) { const fx2 = cam.scrollX + ((k * 97 + t * 8 * (k % 3 + 1)) % (VW + 20)) - 10, fy2 = cam.scrollY + (k * 53 + Math.sin(t + k) * 12) % VH; gt.fillStyle(0xe6ff96, 0.4 + 0.4 * Math.sin(t * 3 + k)).fillRect(Math.round(fx2), Math.round(fy2), 1, 1); }
    if (S.rain) { this.gScreen.lineStyle(1, 0xa6c4e0, 0.5); for (let k = 0; k < 70; k++) { const rx = (k * 61 + t * 90) % (VW + 40) - 20, ry = (k * 37 + t * 260) % (VH + 20) - 10; this.gScreen.lineBetween(rx, ry, rx - 2, ry + 6); } }
    if (m.id === 'forest' && !S.flags.cleansed) this.gScreen.fillStyle(0x2a1040, 0.08).fillRect(0, 0, VW, VH);
    this.drawDarkness(night);
    if (P.hp < W.st.maxHp * 0.25 && P.dead <= 0) this.gScreen.fillStyle(0xe0484f, 0.08 + 0.06 * Math.sin(t * 6)).fillRect(0, 0, VW, VH);
    if (P.dead > 0) this.gScreen.fillStyle(0x000000, clamp(1 - P.dead / 1.6, 0, 1)).fillRect(0, 0, VW, VH);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].setVisible(false);
    for (let i = this.textUsed; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }
  private drawPlayer(P: Player, gg: Phaser.GameObjects.Graphics, t: number) {
    if (P.dead > 0) return;
    if (P.inv > 0 && P.dashT <= 0 && P.air <= 0 && Math.floor(t * 20) % 2) return;
    const look = playerLook(); const flip = P.fx < -0.1;
    if (P.wild > 0) { const c = companion(); const sp = c ? c.sp : 'sparkit'; const s = famSprite(sp, c ? c.stage : 1, 2); this.shadow(gg, P.x, P.y + 2, 18); this.img(s, P.x, P.y + 4, P.y, { flip: flip !== LEFT_FACING.has(SPECIES[sp].shape) && false }); return; }
    if (P.flying) { const fr = Math.floor(t * 8) % 2; const L = BPART[S.broom.lantern]; const s = broomRider(look, BROOM_DYES[S.broom.dye], BPART[S.broom.bristle].col, L.id === 'none' ? null : L.col, fr);
      this.shadow(gg, P.x, P.y + 4, 14); this.img(s, P.x, P.y - 6 + Math.sin(t * 4) * 1.5, P.y, { flip }); return; }
    const air = P.air > 0 ? Math.sin((0.28 - P.air) / 0.28 * Math.PI) * 10 : 0;
    const fr = P.walk > 0 ? Math.floor(P.walk * 8) % 2 : 0; const s = witchSprite(look, fr); const bob = P.walk > 0 ? fr : 0;
    this.shadow(gg, P.x, P.y + 2, 10); this.img(s, P.x, P.y + 4 - bob - air, P.y, { flip });
    if (P.net > 0) { gg.lineStyle(1, 0xe9dfc7, 1); for (let k = -6; k <= 6; k += 3) { this.gTop.lineStyle(1, 0xe9dfc7, 0.9); this.gTop.lineBetween(P.x + k, P.y - 20, P.x + k, P.y + 2); this.gTop.lineBetween(P.x - 7, P.y - 18 + k + 6, P.x + 7, P.y - 18 + k + 6); } }
    if (P.buffs.ward) { this.gTop.lineStyle(1, 0xead2a2, 0.6); this.gTop.strokeRect(P.x - 9, P.y - 21, 18, 24); }
  }
  private shadow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) { g.fillStyle(0x000000, 0.28).fillEllipse(Math.round(x), Math.round(y), w, 4); }
  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, f: number, col: number) { g.fillStyle(0x000000).fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, w + 2, 3); g.fillStyle(col).fillRect(Math.round(x - w / 2), Math.round(y), Math.max(1, Math.round(w * clamp(f, 0, 1))), 1); }
  private star(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, rot: number, col: number, a: number) { g.lineStyle(1, col, a); g.beginPath(); for (let i = 0; i <= 5; i++) { const an = -Math.PI / 2 + rot + i * Math.PI * 4 / 5; const px = x + Math.cos(an) * r, py = y + Math.sin(an) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.strokePath(); }
  private drawDarkness(night: boolean) {
    const a = darkness(); const g = this.darkCanvas.getContext('2d')!;
    if (a <= 0.01) { if (this.darkOn) { g.clearRect(0, 0, VW, VH); this.darkTex.refresh(); this.darkOn = false; } this.dark.setVisible(false); return; }
    this.darkOn = true; this.dark.setVisible(true); const cam = this.cameras.main;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, VW, VH); g.fillStyle = `rgba(10,8,32,${a})`; g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = 'destination-out';
    const light = (x: number, y: number, r: number) => { const sx = x - cam.scrollX, sy = y - cam.scrollY; if (sx < -r || sy < -r || sx > VW + r || sy > VH + r) return;
      const grad = g.createRadialGradient(sx, sy, r * 0.1, sx, sy, r); grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.85)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(sx - r, sy - r, r * 2, r * 2); };
    const P = W.P; light(P.x, P.y - 8, lightRadius());
    const m = W.map; const tx0 = Math.max(0, Math.floor(cam.scrollX / T) - 2), ty0 = Math.max(0, Math.floor(cam.scrollY / T) - 2), tx1 = Math.min(m.w - 1, tx0 + VW / T + 4), ty1 = Math.min(m.h - 1, ty0 + VH / T + 4);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const tt = W.m[ty * m.w + tx]; if (tt === TL.WINDOW) light(tx * T + 8, ty * T + 12, 28); else if (tt === TL.CAMPFIRE) light(tx * T + 8, ty * T + 8, 60 + Math.sin(W.clock * 9) * 3); }
    for (const n of forageNodes()) if (n.glimmer && nodeVisible(n)) light(n.x, n.y, 16);
    if (m.id === 'home') for (const k in S.plots) { const p = S.plots[k]; if (p.crop === 'moonpetal' && cropStage(p) === 3) { const [x, y] = k.split(',').map(Number); light(x * T + 8, y * T + 8, 18); } }
    for (const z of W.zones) if (z.k === 'circle' || z.k === 'sigil') light(z.x, z.y, z.k === 'circle' ? z.r + 10 : 14);
    for (const p of W.proj) if (p.own !== 'e') light(p.x, p.y, 14);
    for (const n of activeNpcs()) if (n.id === 'ysolde') light(n.x, n.y - 8, 20);
    for (const pr of m.props) if (pr.kind === 'cauldron') light(pr.x, pr.y, 26);
    g.globalCompositeOperation = 'source-over'; this.darkTex.refresh();
    void night;
  }
}
function mapName(id: string) { return { home: 'Thistledown', village: 'Hollowmere', forest: 'Brindlewood' }[id] || id; }
export { mk, CRAFTS, CROP };
