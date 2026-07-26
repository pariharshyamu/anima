import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Mirror `docs/` into the site's static assets.
 *
 * The guide fetches `./docs/<page>.md` at runtime, so the markdown has to be
 * under `site/public/`. That mirror is gitignored and used to be kept by
 * hand, which means a page could be written, committed and linked in the
 * sidebar and still be a month out of date on the deployed site with
 * nothing anywhere saying so.
 */
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, 'public/docs');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(resolve(here, '../docs'), target, { recursive: true });
