#!/usr/bin/env node
// Deploy Footprint (web + API, one container) to Cloud Run from source (R1.5, ADR-030).
//   npm run deploy            # uses gcloud on PATH and the defaults below
// Requires: `gcloud auth login`, project access, and permission to act as the runtime service account.
// No secrets are passed here: Gemini/Firestore auth comes from the attached service account.
import { spawnSync } from 'node:child_process';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'project-d8d384af-4155-46fa-a3c';
const REGION = process.env.GOOGLE_CLOUD_REGION || 'asia-southeast1';
const SERVICE = process.env.CLOUD_RUN_SERVICE || 'footprint';
const RUNTIME_SA = `footprint-api@${PROJECT}.iam.gserviceaccount.com`;

// Non-secret runtime config (keep in sync with .env.example).
const ENV = {
  GOOGLE_GENAI_USE_VERTEXAI: 'true',
  GOOGLE_CLOUD_PROJECT: PROJECT,
  GEMINI_SCAN_MODEL: process.env.GEMINI_SCAN_MODEL || 'gemini-3.8-flash',
  GEMINI_SCAN_LOCATION: process.env.GEMINI_SCAN_LOCATION || 'global',
  GEMINI_LIVE_MODEL: process.env.GEMINI_LIVE_MODEL || 'gemini-live-2.5-flash-native-audio',
  GEMINI_LIVE_LOCATION: process.env.GEMINI_LIVE_LOCATION || 'us-central1',
  FIRESTORE_DATABASE: '(default)',
};

const args = [
  'run', 'deploy', SERVICE,
  '--source=.',
  `--project=${PROJECT}`,
  `--region=${REGION}`,
  `--service-account=${RUNTIME_SA}`,
  '--allow-unauthenticated', // public link for judges and phone testing
  '--min-instances=0', // raise to 1 during judging (REL-03)
  '--max-instances=2', // cost cap (REL-04); revisit for the demo
  '--timeout=3600', // Live proxy WebSockets (ADR-030)
  '--memory=512Mi',
  '--port=8080',
  `--set-env-vars=${Object.entries(ENV).map(([k, v]) => `${k}=${v}`).join(',')}`,
  '--quiet',
];

// On Windows gcloud is a .cmd shim, which needs a shell; none of the args contain spaces.
const res = spawnSync('gcloud', args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(res.status ?? 1);
