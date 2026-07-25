// Builds the assets the docs site's live playground needs:
// - vendor/anima.js: this library bundled from source (three external)
// - vendor/gama/*.js: gama3d's npm dist re-bundled with code splitting
//   (entries share chunks; three/examples imports inlined)
// - vendor/scena.js: scena3d's npm dist bundled the same way
// - vendor/three.module.js: three's own ESM build, copied
// - docs/*.md: the guides, copied for client-side rendering
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

// The vendor bundles are served under FIXED filenames (vendor/anima.js and
// friends) because an import map cannot reference a content hash. That means
// a browser which has fetched them once will happily keep using the old
// library forever, however many times the docs are redeployed — the page and
// its hashed assets update, the library silently does not. So stamp a build
// token from the three library versions and hang it off the vendor URLs as a
// query: same versions, same URL, still cached; new release, new URL.
const version = (pkg) =>
  JSON.parse(readFileSync(join(root, pkg, 'package.json'), 'utf8')).version;
const stamp = [version('.'), version('node_modules/scena3d'), version('node_modules/gama3d')].join('-');
writeFileSync(join(pub, 'vendor', 'build.json'), JSON.stringify({ stamp }));
console.log(`vendor build stamp: ${stamp}`);
