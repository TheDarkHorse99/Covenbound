import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes a normal multi-file build in dist/ (used by the desktop app and any website).
// `npm run build:single` makes one self-contained HTML file in dist-single/ (used for the shareable Claude artifact).
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 4000,
  },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
}));
