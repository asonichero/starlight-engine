# The Fairy Shoe — design (v1 prototype)

Adapted from the Birchwood House handoff spec. Retitled **The Fairy Shoe**. Read with `FAIRY-SHOE-PROGRESS.md`.

## Premise
A household of adults. The six residents are grown-up versions of the fairy-tale figures they are named for, long after (or in place of) the events they are known for. They come to the house knowing the dynamic they are entering, and they can leave whenever they like — that is the **runaway** state. Chores are adult household chores that build responsibility and resilience.

## What changed from the Birchwood spec

| Birchwood spec | The Fairy Shoe |
|---|---|
| 43-card shared deck, 7-card hand, draw/reshuffle, 3 card slots, rarity of heavy cards and Reprieves | **No cards, no deck, no hand.** Every implement, clothing layer, force level, aftercare option and Reprieve is always available. Severity is entirely the player's call. |
| A correction is assembled from cards, then resolved | A correction is **live**: the player begins it, delivers each smack in the 3D scene, and ends it. Nothing is scripted; there is no fixed swat count. |
| Severity = 2 + card values | Severity = 2 + what the scene recorded (see below) |
| Card-table presentation | Plain panel UI beside the 3D scene |
| Dance mechanics (Starlight) | Removed from the engine |
| Starlight cast | The six residents, plus the Keeper (the player's body in the scene) |
| Event text written for the original tone | Reworded as adults sharing a household (curfew → "before the last lamp", and so on) |

Unchanged: the Morning → evening loop, chore bands and Effective Attention, the occurrence formula and event categories, Behaviour notes (read-only), banded severity match and its outcome table, aftermath effects, Reprieve effects (played alone, staged then confirmed, not scored), graduation checked on every stat change, runaway at the day boundary, backfill with graduates cycling back, per-character thresholds and tone tweaks (Corren's halved Wilfulness movement, Snow White's sluggish Satisfaction, Rapunzel's withdrawal bias, Goldilocks's poor response to early Reprieves).

## Live severity
Each smack records the implement, clothing layer and force it was delivered with. At the end:

`total = 2 + implement + clothing + force + length`

- **Implement** (swat-weighted mean, rounded): Hand 0 · Hairbrush +1 · Paddle +2
- **Clothing**: Over clothes −1 · Bottoms down 0 · Briefs down +1
- **Force** (dial, changeable at any time): Go easy −2 · Lighter −1 · Steady 0 · Firmer +1 · No mercy +2
- **Length** (smack count): ≤6 −1 · 7–14 0 · 15–24 +1 · 25+ +2

A correction needs at least one smack (no free pass). Bands, expected band (from Wilfulness plus the evening's situational modifier) and the match table are exactly as in the Birchwood spec. Aftercare (Corner Time, Lines, Held After, Warm Words) is any combination, applied on finishing.

## Not yet in the engine
- Strap, wooden spoon and switch have no models. The engine has the hand, hairbrush and paddle.
- The engine has one position (over the lap). There is nothing to choose there yet.
- The Stripped layer has no separate model from Briefs down.
