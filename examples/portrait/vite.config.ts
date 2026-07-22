import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// gama3d + scena3d come from npm (devDependencies); anima3d aliases to
// this repo's live source so the demo always runs the working tree.
export default defineConfig({
  resolve: {
    alias: [{ find: /^anima3d$/, replacement: resolve(here, '../../src/index.ts') }],
    dedupe: ['three'],
  },
});
