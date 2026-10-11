# Handoff — @chill-guy-1234
Updated: 2026-10-11 · Tool: Claude Code · Branch: r1.8-face-blur

## Now
- Q4 (R1.8 face blur) done and in PR: `privacy.ts` (+15 tests), `faceBlur.ts`, `uploadGuard.test.ts`, `?debug=blur` view.
  77 tests + build green. Phone test (preview q04, Android, Brave): blur 30 ms, no measurable fps cost, head-area
  backstop caught a person the face model missed.
- docs/FOLLOWUPS.md added: Q1–Q3 review items, infra items for the owner (cost/abuse before Q6, Live region), blur and
  detector findings from the phone test.

## Next
1. Address review comments on the Q4 PR; owner verifies (`/verify`) and merges, then `npm run deploy`.
2. Next unclaimed queue step: Q5 (output safety filter, independent) or Q6 (Gemini scene scan, uses `getUploadJpeg`).
3. Re-test detector fps in Chrome with a charged phone (FOLLOWUPS #11) before the field test.

## Blockers
- None. gcloud is installed and logged in (Editor on the project); `npm run deploy` needs PREVIEW_TAG for previews.

## Gotchas / learned
- Only `FaceBlurrer.getUploadFrame/getUploadJpeg` may produce an upload frame — `uploadGuard.test.ts` fails otherwise.
- Always set `PREVIEW_TAG` before `npm run deploy`; without it the deploy is production.
- Repo-local git email is the noreply address; on Windows use PowerShell for gcloud (PATH needs the SDK bin dir).
- Preview revisions and tags q01–q04 remain on the `footprint` service; clean up after merge.
