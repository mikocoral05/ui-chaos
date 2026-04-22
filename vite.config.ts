import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'UiChaos',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => {
        if (format === 'es') {
          return 'index.js';
        }

        if (format === 'cjs') {
          return 'index.cjs';
        }

        return 'ui-chaos.umd.js';
      }
    }
  }
});
