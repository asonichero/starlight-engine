# The Fairy Shoe — progress notes

*Branch `claude/gifted-sagan-t3h56m`. See `FAIRY-SHOE-SPEC.md` for the design.*

## Files
| File | State |
|---|---|
| `fairy-shoe.html` | The playable game: morning assignment (drag or tap), day resolution, evening notes, live correction sandbox, Reprieves, graduation, runaway, backfill. |
| `fairy-shoe-rules.js` | All rules, with no rendering. Loads in the browser and in Node. |
| `fairy-shoe-rules.test.js` | `node fairy-shoe-rules.test.js` plays 400 random days and asserts the invariants (three at the table each morning, at most two events on different people, stats in 1–7). |
| `starlight-engine.js` | The engine, with dance code removed (`DANCE_*`, `createDancer`, `danceIK`, the dancer hooks). Presets replaced by the six residents and the Keeper. `fadeMarksMove` became `fadeMarksBy(ch, keep)`; the game calls it once a day. |
| `character-viewer.html` | The viewer, with the Dance section removed. Still has the discipline scene and pose editor. |
| `STARLIGHT-PROGRESS.md` | The old engine notes, kept for the technical history of the model and scene. |

## Running
Open `fairy-shoe.html` from the folder (it loads three.js r128 from a CDN). The first morning builds four bodies, about a second each.

## Tested
Headless Chrome with a local three.js: a full day (assign, three results, one live correction with a paddle and a clothing change mid-scene and Lines aftercare, one Reprieve, runaway check, next morning) with no console errors. The viewer loaded all seven presets and ran the scene.

## Open items
- Strap, wooden spoon and switch models; more positions than the lap.
- Paired chores (stubbed, as in the spec's v1 allowance). Rapport is wired in for Friction naming.
- Balance. With the live severity the baseline lands in the Moderate band, so low-Wilfulness residents are overshot by default; the spec intends this. Length and force thresholds are first guesses.
- Presets are first-pass: face, hair and clothes need a look in the viewer. Rapunzel's hair is the engine's "long" style, not her braid.
- Art for graduation (text-only for now).
