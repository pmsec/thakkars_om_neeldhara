import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The deliverable is handed to an architect who may have no dev environment, so the
// production build must run by double-clicking index.html (file:// origin). That rules
// out ES-module script tags and external asset requests: everything is inlined into a
// single HTML file, including the builder's original plan used as the 2D underlay.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    // Large enough to inline the 465 KB builder's plan JPEG as a data: URI.
    assetsInlineLimit: 4 * 1024 * 1024,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 8000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
})
