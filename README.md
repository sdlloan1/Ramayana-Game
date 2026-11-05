# Ramayana: Legend of the Dharma

A cinematic third-person action-RPG prototype built for the browser — the playable
vertical slice of the *Ramayana: Legend of the Dharma* PRD, targeting the Nitro by
Overwolf overlay runtime.

Four story chapters, real-time weapon combat, a bow, cooldown-driven Divya Astras,
telegraphed boss patterns, wave progression and a defendable bridge at Setu.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

`npm run typecheck` runs the TypeScript compiler, `npm run build` produces a static
bundle in `dist/`.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse (click arena to capture) / Arrow keys | Orbit camera |
| Left click | Light attack — chains into a three-hit finisher |
| Right click | Heavy attack — breaks guard, staggers commanders |
| Shift / Space | Guard; press as a blow lands to parry |
| Hold Q, left click | Draw Kodanda and loose a seeking arrow |
| 1 | Agneyastra — fire wave in a forward cone, applies burn |
| 2 | Brahmastra — execution beam on the nearest commander |
| 3 | Hanuman's Aid — summoned after Chapter II |
| Esc / P | Pause |
| Ctrl + Tab | Overwolf overlay toggle (native hotkey; browser preview falls back to the same shortcut where the browser allows it) |

## Chapters

1. **The Exile** — Dandaka forest. Survive the Asura ambush and Dushana.
2. **The Alliance** — Kishkindha canyons. Break Vali's guard; unlock Hanuman's summon.
3. **The Ocean Bridge** — Setu. Wave defence while the bridge integrity holds.
4. **The War for Lanka** — boss rush: Kumbhakarna, Indrajit and the three-phase Ravana.

Progress, best scores and settings persist in `localStorage`.

## Technical notes

- **Rendering:** Three.js WebGL 2.0 pipeline with ACES tone mapping, directional
  shadows, instanced foliage/rocks and pooled additive particles. No post-processing
  pass, so the frame cost stays inside an overlay's budget.
- **Content:** every model, VFX and sound is generated at runtime from primitives and
  the Web Audio API. The initial payload is a few hundred KB, far below the PRD's
  150 MB streaming budget; recorded voice-over and OST can be added later without
  changing the game loop.
- **Audio:** procedural ambience and combat SFX (no CDN credentials required).
- **Overwolf:** `src/game/platform.ts` registers the native overlay hotkey and routes
  error telemetry to `overwolf.log` **only when the Overwolf API is present**. In a
  browser it falls back to console logging. `Ctrl + Tab` toggles the overlay in-app.
- **NitroPay:** reserved, non-combat banner placements on the main menu and game-over
  screens (`src/ui/AdSlot.tsx`), ready for the NitroPay SDK view.
- **Not in this slice:** Unity WebGL packaging, professional English voice-over,
  CDN-hosted audio assets, and real NITRO/Overwolf app-store submission. The browser
  build is the design-correct stand-in for those production steps.

## Environment

The sandbox run uses Node 22 (`docker-compose.base44.yml`, provided by the Base44
environment repository). Vite binds `0.0.0.0:3000`; when `BASE44_PREVIEW_MODE=1` the
dev server also accepts the sandbox preview host wildcard.
