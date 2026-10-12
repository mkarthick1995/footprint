#!/usr/bin/env node
// ST-17 privacy audit (Q12): lists what Firestore actually holds — collection names, document counts and FIELD NAMES
// only (never values), and flags any field outside the allowed set. Run after a walk: `npm run audit:privacy`.
// Uses your gcloud application-default login; read-only.
import { Firestore } from '@google-cloud/firestore';

const ALLOWED = {
  observations: ['accuracyM', 'confidence', 'expireAt', 'hazardId', 'lat', 'lng', 'notSeen', 'source', 'ts', 'type'],
  hazards: ['alpha', 'beta', 'firstSeen', 'geohash', 'id', 'lastSeen', 'lat', 'lng', 'notSeen', 'seen', 'status', 'type', 'updatedAt'],
};
const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || 'project-d8d384af-4155-46fa-a3c' });
let problems = 0;
const cols = await db.listCollections();
if (cols.length === 0) console.log('Firestore is empty.');
for (const c of cols) {
  const snap = await c.get();
  const keys = new Set();
  snap.docs.forEach((d) => Object.keys(d.data()).forEach((k) => keys.add(k)));
  const allowed = ALLOWED[c.id];
  const extra = allowed ? [...keys].filter((k) => !allowed.includes(k)) : [...keys];
  console.log(`${c.id}: ${snap.size} documents · fields: ${[...keys].sort().join(', ') || '—'}`);
  if (!allowed) (problems++, console.log(`  ✖ unexpected collection`));
  else if (extra.length) (problems++, console.log(`  ✖ unexpected fields: ${extra.join(', ')}`));
}
process.exit(problems ? 1 : 0);
