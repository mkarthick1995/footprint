# Vision — Footprint

> **Tagline:** *Every walk leaves a footprint for the next person.*
> **Pitch:** An accessible-street co-pilot for JAPAC cities — instant on-device hazard alerts, Gemini for
> understanding and directions, and every walk makes a shared accessibility map better for the next person.
> Use the tagline as the closing line of the demo video and deck: it sells the community map (our differentiator).

## Problem
Blind and low-vision pedestrians in JAPAC cities face streets that Western-built tools handle poorly: potholes,
missing or blocked footpaths, open drains, speed breakers, two-wheelers, chaotic crossings.
A white cane detects what's within ~1 m; it says nothing about the road 10 m ahead or the route.
*(Deck stats — use only verified sources, e.g. WHO / The Lancet Global Health vision-loss estimates. Mark TODO until verified.)*

## Users
- **Primary:** blind / low-vision pedestrians walking familiar and unfamiliar routes.
- **Secondary:** caregivers; city / municipal bodies and NGOs who consume the hazard map.

## Solution pillars (in priority order)
1. **Instant hazard alerts (on-device, < 300 ms)** — approaching people, vehicles, bikes, obstacles. Voice + haptic.
2. **Gemini Live street understanding** — continuous ~1 fps scene reasoning: footpath present? surface? crossing safe?
   Conversational: *"Is there a footpath on my left?"*
3. **Walking guidance** — Google Maps walking route, narrated and adapted by Gemini ("footpath ends in 20 m, keep right").
4. **Shared accessibility map** — each walk logs hazards with GPS (no imagery) → public map + per-segment accessibility
   score → safer route suggestions for others; data useful to cities. **This is our main differentiator.**

## Why we can win (scoring strategy)
| Criterion | Our play |
|---|---|
| Tech & GenAI 40 | Layered real-time architecture (on-device + Gemini Live + Maps + Firestore); Gemini is central, multimodal, live |
| Impact 25 | Clear, underserved users; JAPAC-specific street conditions; voice from a real visually impaired user/org if possible |
| Innovation 25 | Personal assistant → **community infrastructure** (crowd-sourced accessibility map). Competitors don't do this |
| UX 10 | Voice-first, short spatial cues ("pothole, 2 steps, slightly left"), alert levels, fail-loud |

## Competition (details: `docs/research/COMPETITION.md`)
Google **Gemini Live "Guided Vision"** (reported launched ~2026-10-01, explicitly *not* for navigation/obstacles),
Be My Eyes on Meta glasses, Oorion / Scribe Me, Envision, Seeing AI, Aira.
**Our gap:** navigation + hazard alerts + shared map, tuned for JAPAC streets.

## Non-goals (for this hackathon)
- Native mobile app (except the Meta-glasses stretch goal) · training custom models from scratch
- User accounts / social features · storing video or images of people · replacing cane / guide dog / O&M training

## Safety & privacy principles (non-negotiable)
- **Assistive, not a mobility aid replacement** — stated in app, deck, and video.
- **Fail loud:** announce when camera, network, or model is unavailable; never go silent.
- Frames processed transiently; only hazard type + GPS + timestamp are stored. No faces, no raw video.

## Demo narrative (draft, < 3 min)
1. 0:00 Problem in one real street shot (JAPAC footpath with pothole / two-wheeler).
2. 0:20 First-person walk: on-device alert fires; user asks Gemini a question; directions narrated.
3. 1:30 Hazard map fills in live from the walk; accessibility score; safer route for the next user.
4. 2:15 Architecture in one slide-shot; scale path (city / NGO data partners, more languages, Meta glasses).
5. 2:45 Close: impact line + safety statement.
