// Turns character grids into canvases. Each character maps to a color in a palette; '.' is transparent.
export const OUTLINE = '#120a18';

export function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

const cache = new Map<string, HTMLCanvasElement>();

export function sprite(key: string, rows: string[], pal: Record<string, string>, scale = 1, outline = true): HTMLCanvasElement {
  const ck = key + '|' + scale + '|' + (outline ? 1 : 0);
  const hit = cache.get(ck); if (hit) return hit;
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), pad = outline ? 1 : 0, W = w + pad * 2, H = h + pad * 2;
  const grid: (string | null)[] = new Array(W * H).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x]; if (ch && ch !== '.' && pal[ch]) grid[(y + pad) * W + x + pad] = pal[ch];
  }
  if (outline) {
    const base = grid.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (base[y * W + x]) continue;
      if ((x > 0 && base[y * W + x - 1]) || (x < W - 1 && base[y * W + x + 1]) || (y > 0 && base[(y - 1) * W + x]) || (y < H - 1 && base[(y + 1) * W + x])) grid[y * W + x] = OUTLINE;
    }
  }
  const c = mk(W * scale, H * scale), g = c.getContext('2d')!;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const col = grid[y * W + x]; if (col) { g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale); } }
  cache.set(ck, c); return c;
}

export function merge(base: string[], over: string[]): string[] {
  return base.map((row, y) => { const o = over[y] || ''; let s = ''; for (let x = 0; x < row.length; x++) { const ch = o[x]; s += ch && ch !== '.' ? ch : row[x]; } return s; });
}

export function scaleCanvas(src: HTMLCanvasElement, s: number): HTMLCanvasElement {
  const c = mk(src.width * s, src.height * s), g = c.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, c.width, c.height); return c;
}

const urlCache = new WeakMap<HTMLCanvasElement, string>();
export function url(c: HTMLCanvasElement): string { let u = urlCache.get(c); if (!u) { u = c.toDataURL(); urlCache.set(c, u); } return u; }

const whiteCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
export function whiteOf(c: HTMLCanvasElement): HTMLCanvasElement {
  let w = whiteCache.get(c); if (w) return w;
  w = mk(c.width, c.height); const g = w.getContext('2d')!; g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, w.width, w.height);
  whiteCache.set(c, w); return w;
}
export function tinted(c: HTMLCanvasElement, color: string, alpha = 0.55): HTMLCanvasElement {
  const w = mk(c.width, c.height); const g = w.getContext('2d')!; g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(0, 0, w.width, w.height); return w;
}
export function flipped(c: HTMLCanvasElement): HTMLCanvasElement {
  const w = mk(c.width, c.height); const g = w.getContext('2d')!; g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return w;
}
