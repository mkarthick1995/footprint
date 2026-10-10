// Copies MediaPipe's WASM runtime into public/ so the app serves it itself (no third-party CDN at runtime;
// simpler CSP in Q13). Runs before dev and build. The output folder is gitignored.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// The package doesn't export package.json, so start from its main entry and walk up to the folder holding wasm/.
let pkgDir = dirname(require.resolve('@mediapipe/tasks-vision'));
while (!existsSync(join(pkgDir, 'wasm')) && dirname(pkgDir) !== pkgDir) pkgDir = dirname(pkgDir);
const src = join(pkgDir, 'wasm');
const dest = join(here, '..', 'public', 'mediapipe', 'wasm');

if (!existsSync(src)) {
  console.error(`MediaPipe wasm not found at ${src}`);
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copied MediaPipe wasm → ${dest}`);
