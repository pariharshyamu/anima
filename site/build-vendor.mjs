// Builds the assets the docs site's live playground needs:
// - vendor/anima.js: this library bundled from source (three external)
// - vendor/gama/*.js: gama3d's npm dist re-bundled with code splitting
//   (entries share chunks; three/examples imports inlined)
// - vendor/scena.js: scena3d's npm dist bundled the same way
// - vendor/three.module.js: three's own ESM build, copied
// - docs/*.md: the guides, copied for client-side rendering
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'site', 'public');
mkdirSync(join(pub, 'vendor', 'gama'), { recursive: true });
mkdirSync(join(pub, 'docs'), { recursive: true });

const threeExternal = {
  name: 'three-exact-external',
  setup(builder) {
    builder.onResolve({ filter: /^three$/ }, () => ({ path: 'three', external: true }));
  },
};

await build({
  entryPoints: [join(root, 'src/index.ts')],
  bundle: true,
  format: 'esm',
  minify: true,
  outfile: join(pub, 'vendor', 'anima.js'),
  plugins: [threeExternal],
});

await build({
  entryPoints: [
    join(root, 'node_modules/gama3d/dist/index.js'),
    join(root, 'node_modules/gama3d/dist/templates.js'),
  ],
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  outdir: join(pub, 'vendor', 'gama'),
  plugins: [threeExternal],
});

await build({
  entryPoints: [join(root, 'node_modules/scena3d/dist/index.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  outfile: join(pub, 'vendor', 'scena.js'),
  plugins: [threeExternal],
});

copyFileSync(
  join(root, 'node_modules/three/build/three.module.js'),
  join(pub, 'vendor', 'three.module.js')
);

for (const file of readdirSync(join(root, 'docs'))) {
  copyFileSync(join(root, 'docs', file), join(pub, 'docs', file));
}

console.log('site vendor assets built');
