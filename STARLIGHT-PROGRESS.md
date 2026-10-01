# Starlight — Progress Notes

*Session handover, 2026-09-28 (second session). Read this with `STARLIGHT-GAME-DESIGN.md`, which describes the campaign loop and cast.*

## Files

| File | State |
|---|---|
| `starlight-engine.js` | **New.** The shared engine: character models, the discipline-scene engine, the dance-move library, finger wrap and hair simulation. Everything is on `window.Starlight`. |
| `starlight-game.html` | The playable campaign, now built on the engine. It uses the move-choice mechanic and only the active dancer is on stage. Corrections are driven by the discipline engine. |
| `character-viewer.html` | The viewer, now a thin UI over the engine. Use it to tune models, the scene and moves; changes to the engine show up in the game too. |
| `starlight-3d (1).html` | Original prototype. Kept for reference only. |
| `aya-model-viewer.html` | Superseded metaball experiment. |

Both HTML files load `starlight-engine.js` from the same folder, so keep the three together.

## Done this session

### 1. Mechanics
- **Move choice replaces the 4-lane highway.** A routine is 12 moves (11 random from the library plus the Final Bow), one per bar. Each bar shows the move name and four options. The player picks with D F J K, arrows, 1–4 or a click.
  - **Timing:** the window is 3.5 beats. Perfect means answering within the first 40% of it; later is Good. A wrong pick or a timeout is a Miss.
  - **Options:** they come from the 19-move library. When the move has a mirrored twin, the twin is always one of the three distractors, so L and R are distinct answers. "Hold the Pose" can be the answer or a distractor; it's never first and never appears twice in a row.
  - **The dancer performs whatever was picked:** prep straight away, then the hit on the next half beat. A wrong pick performs the wrong move, and a timeout stumbles.
- **Staging:** a dance run shows only the dancer whose run it is. The finale still shows all three.
- **Tuning constants** are at the top of the ROUTINE section: `ROUTINE_MOVES`, `PROMPT_BEATS`, `WINDOW_BEATS`, `PERFECT_SHARE`.

### 2. Engine integrated into the game
- **Characters:** the four are built once at load (about 1.2–1.4 s each). The title screen shows progress and enables Begin when they're ready. The same four instances are reused in every scene.
- **Dance:** each character gets a per-character dance player (`createDancer`). Level runs call `prep`/`hit`/`stumble` from the player's answers; the finale schedules them from the recorded results.
- **Corrections:**
  - The disciplinarian sits on the flight case with hands resting on the thighs, and the subject stands at their side for the dialogue. The fade then goes to the engine's lap scene.
  - The engine has a new **driven** swing mode: `raise(dur)`, `strike(strength, dur)`, `lower(dur)`.
  - The hand lifts before each swat and waits raised. Space starts the strike, which lands after `scn.timing.strike`.
  - `scn.onImpact` fires as each swat lands; it plays the sound and queues the next lift. Lift and hold times come from `scn.timing` and are shortened to fit fast swats.
  - A Firm swat gives the full reaction and Uneven gives 60%. On a Hesitated swat the hand stays raised.
- **Kenji's scene:** the same engine, with Kenji as disciplinarian and Aya as subject. Strikes are scheduled so each one lands on its swat. Rin and Kiko stand facing the back wall in the new `Wait` pose.
- **Cameras:** one camera moves between named shots (`SHOTS` in the game file).
  - Dance runs default to a slight three-quarter view from the dancer's left, and cut every three moves.
  - On portrait screens the field of view widens so shots keep their side-to-side framing.
- **Lighting:** a softer key light, a sky/ground fill and shadow `normalBias`, the last of which fixed shadow acne under the jaw.

### 3. Model fixes (all in the engine, so the viewer and the game share them)
- **Hip crease and shading line:**
  - *Cause of the line:* the torso loft's monotone cubic is smooth in slope but not in curvature, so at the widest hip ring the curvature jumped, showing a line across the hips and glutes.
  - *Fix:* the loft table is now Gaussian-smoothed along Y (`makeLoft(rings, smooth)`), and the ring values are pre-corrected so every measured ring is still hit (checked to within 0.1 mm).
  - *Cause of the crease:* the loft's flat end cap sat on the surface just below the crotch line.
  - *Fix:* the loft now tapers to a close 3% of height below the crotch, where the cap is buried at least 1.5 cm inside the thighs.
- **Face:**
  - The head and upper neck are meshed separately at 40% of the body voxel size (4 mm at the 10 mm default) and merged into the same skinned mesh.
  - The join is a 2 cm overlap band on the straight part of the neck, with the coarse copy drawn in by 0.3–1.5 mm. The band has to stay off the concave throat, or coarse triangles poke through.
- **Hands (resting-hand gap and mitten hands):**
  - Hands are now a palm, four separate fingers and a thumb, meshed at 30% of the voxel size (3 mm) with the same overlap-band method at the wrist.
  - A new `fingers` bone per hand curls the fingers; they rest at a 16° curl by default.
  - In the discipline scene, the disciplinarian's fingers curl each frame until the fingertip pads meet the subject's skin. This happens on the back, on the thigh at rest, and on the glute at contact, and closes the gap on rounded surfaces.
  - The subject's fingers stay flat on the floor.
- **Hair:**
  - The ponytail and Rin's long hair (back sheet and two side strands) are now simulated chains (`hairStep`). Each is anchored to the head, hangs under gravity with a light pull toward its styled shape, and is pushed out of capsules around everyone on set and above the floor.
  - A head-down subject's ponytail now falls past the head instead of pointing up the back into the disciplinarian.
  - The ponytail starts slightly to one side (`bias`) so it doesn't balance on the spine.
- **Build size:** about 42–55k vertices per character.
- **Per-frame cost:** the scene update with finger wrap and hair runs at about 0.4 ms typical. Spikes of 10–14 ms happen when the existing strike-fit search reruns.

## Update 2026-09-29: correction redesign
- **Correction interface:** the marker track is gone. Corrections are now a timed window in the player's own rhythm, with Space or a single on-screen button.
  - The scene starts relaxed. Each press runs one engine `scn.cycle()`: the arm lifts, lands on the next contact site, and holds there until the next press. Sides alternate from the second smack.
  - A shorter gap between presses gives a quicker lift and a firmer reaction.
  - A press made while the arm is still moving is buffered, one at most.
- **Window and pass level:** these scale linearly with the dancer's misses, Every window is capped at 30 s. The pass level scales from 20 smacks for a clean run (the maintenance scene, with its own dialogue) to 40 when all 12 moves were missed (`DISC_FULL_FAIL`), so a full fail needs a smack about every 0.75 s against 1.5 s for maintenance. The pass level is never shown.
- **Scoring:**
  - *Rhythm:* the evenness of the press gaps.
  - *Severity:* smacks against the pass level. Below the pass level the effect falls off; from 1× to 2.5× it counts in full; beyond 2.5× nerves reduce it.
  - The results card shows smacks, rhythm, severity (Too light / Measured / Too harsh) and the confidence change.
- **Confidence:** Rin's and Kiko's confidence starts at 60 and carries between rehearsals. Each session blends 35% dance accuracy and 65% the correction, then merges into the stored value, which counts 35% against the session's 65%.
  - In the finale, each move goes wrong with chance (1 − confidence) × 0.85 if they missed it in their own run, or × 0.16 otherwise (`FINALE_SLIP`).
  - At confidence 60 with 3 missed moves, that averages about 1.6 finale mistakes.
- **Kenji's scene** uses the same cycle, automatically, and now plays after every finale. Its smack count has no upper limit:
  - *Base:* 25 smacks (`KENJI_BASE`). A flawless finale gets exactly this, framed as a maintenance correction with its own dialogue.
  - *Mistakes:* each finale mistake adds 6.25 (`KENJI_PER_MISTAKE`), so 12 mistakes gives 100.
  - *Player severity:* the player's average severity in their corrections that rehearsal (smacks ÷ pass level, see `playerSeverity()`) adds 20 for each multiple of the pass level away from 1×, too harsh or too lenient alike (`KENJI_PER_SEVERITY`). A player at 2× adds 20; at 0.5× it adds 10.
  - *Pace:* more smacks means faster. The gap starts at 1.2 s and tightens 0.008 s per smack above the base, down to 0.4 s (`KENJI_GAP`, `KENJI_TIGHTEN`, `KENJI_MIN_GAP`), so 100 smacks come every 0.6 s. The swing speeds up and the raised and contact holds shorten with the gap, interpolated from `KENJI_EASY` to `KENJI_HARD`. `scn.cycle()` takes an optional raised hold.
  - *Duration:* because the pace speeds up, it levels off around a minute across the mid range (100 smacks and 150 both take about 60 s), then grows once the gap reaches its floor.
  - *Measured:* a maintenance run landed 25 smacks in 31.7 s.
- **Debug panel:** opened from the Debug link under Begin, or the backquote key anywhere.
  - *Aya's correction:* pick the subject, and set run mistakes, run accuracy and confidence before. The panel shows the resulting window and pass level. Continue afterwards carries on from that level.
  - *Kenji's correction:* set finale mistakes (0–36) and the player's severity (0–5× the pass level). The panel shows the time, count and gap.
- **Wall:** Rin and Kiko are told to face the wall with hands on their heads. The new engine flag `ch.handsOnHead` places each palm on the crown by IK, and the fingers curl onto the scalp.
- **Studio:** the room is now 9 m wide, with the back wall 4 m behind centre stage and 4 m walls (`ROOM` in the game). The front is left open for the cameras.
- **Tested headless:** maintenance with steady presses scored Measured and raised confidence from 60 to 86; mashing scored Too harsh; the finale ran with no errors. Kenji's scene landed all 20 smacks for a one-mistake finale and all 50 for a twelve-mistake finale.

## Testing
The game and viewer were driven headless in Chrome with puppeteer. Test hooks are `window.__game` and `window.__viewer`. A full cycle ran with no console errors, covering the dance with a wrong answer and a timeout, a correction, the finale and Kenji's scene. Every press landed an impact, and every one of Kenji's scheduled swats landed.

## Next session (suggestions)
- **Play-feel pass:** try the move-choice window (`WINDOW_BEATS`) and the Perfect threshold at each level's BPM; 3.5 beats at 116 BPM is about 1.8 s.
- **Poses:** the parked brief item to rework neutral and dance poses that look unnatural is still open. The viewer's Dance tab is the place to do it.
- **Hands:** one curl drives all four fingers. Per-finger curl, and finger poses for dance hits (open hand, point), would be the next step. The thumb is still rigid.
- **Hair:** Kiko's buns and the scalp are part of the body mesh, which is fine. The long-hair sheet could use one more segment if it looks beaded close up.
- **Separate garment meshes** (Kiko's skirt, Rin's hoodie), if wanted, are the open clothing-design item.

## Update 2026-10-01: briefs down, clearance pass

- **Problem:** the lowered briefs' gusset clipped into Kiko's (and Rin's) crotch in the Spread pose, by up to 24 mm. The gusset was stitched to rolls running right round each thigh, so with the legs wide it was dragged across the crotch.
- **Briefs and thongs (not trunks):**
  - *Band:* it now runs only round the outside of each leg and straight across the gap between them; there are no inner rolls round the thighs.
  - *Gusset:* it hangs from the band's front and back strands as a strip, free at its sides.
    - *Shape:* the strip tapers from full width where it meets the band to a narrow waist between the legs. Widths are × height: briefs and hipsters 0.075 in front, 0.09 behind and 2 × `gusset` between; a thong 0.03, 0.012 and 0.01.
    - *Closing legs:* between the legs it's never wider than the gap between them (less 1 cm), so it gathers as they close.
    - *Hang:* briefs' strip carries 0.1 × height of fabric (was 0.14), so it hangs about 5 cm, not 9.
  - *Briefs lower:* briefs and hipsters now sit `BRIEFS_DOWN.below` = 0.04 × height (about 7 cm) below the thigh's crease, up from 0.012. That's the smallest drop at which the band clears in both poses.
- **Shorts closer to the knee:** `LOWER_BAND[0]` is 0.045 (was 0.075). The band now starts about 8 cm above the knee joint instead of 13 cm. Kenji's trunks, lowered as shorts, move with it.
- **Measured against the posed skin,** in the Relaxed and Spread poses, all four characters:
  - gussets are at least 3 mm clear;
  - the band's centre line is at least 4.5 mm clear.
  - `restClearance` was the wrong tool for this: it carries a point between spread legs back to the rest pose through one thigh, into the other leg.
- **Still open:** in the correction's relaxed beat, the disciplinarian's resting hand (halfway down the back of the thigh) lies on a lowered briefs roll.

## Update 2026-10-01: briefs down

- **Viewer:** a **Briefs down** button sits beside Bottoms down. Like Bottoms down, it's per character and is kept through rebuilds and in the discipline scene.
- **Engine (`setLowered(ch, 'briefs', on)`):**
  - *Briefs and hipsters (Rin, Kiko):* the rolled band sits just below the thigh's crease (lowered further in the clearance pass above). That's the crease's lowest point on either thigh (`spec.dims.creaseLow`, recorded when the crease is measured), plus `BRIEFS_DOWN.below` × height, so the band is clear of the buttock all round.
  - *Thong (Aya):* the band sits near the knees, `BRIEFS_DOWN.thong` (78%) of the way down the thigh. Its crotch is a narrow strip, 3 cm wide at the front band and 1.2 cm at the back. The strip hangs from the band's front and back strands, sagging between them, and is free at its sides.
  - *Trunks (Kenji):* lowered exactly as shorts are, to the knees (`bottomCoverage`'s lowered shorts band).
  - *No paint:* lowered briefs, hipsters and thongs paint nothing on the thighs. They're just the rolled band and the fabric between the legs. Their roll is thinner than a waistband from bottoms (0.008 × height; a thong's 0.006).
- **Several garments down at once:** each lowered garment has its own gathered waistband. `ch.bunch` became `ch.bunches`, a Map keyed by layer. `removeBunches(ch, L)` removes one waistband, or all of them without `L`. `bunchStep` steps every waistband.
- **Hidden under bottoms:** lowered briefs' waistband is hidden while bottoms are still up (`dress`). Kiko's hipsters are also hidden under her skirt.
- **Still open:** in the correction's relaxed beat, the disciplinarian's resting hand on the back of the thigh ends up just against a lowered briefs roll.

## Update 2026-09-30: paddle contact revised (Rin and Kiko)

- **Contact pose re-set in the pose editor,** on Aya with Rin and with Kiko. The two edits agreed closely, so `WIDE_CONTACT` is now their average:
  - roll 58.2° (was 82.4°): the blade tilts about 24° further toward face-down;
  - a new `yaw` of 2.7°, the blade turned within its face's plane;
  - slide 0.8 cm and drop 1.6 cm;
  - the higher site 20 mm into the face (was 2 mm);
  - a new elbow direction, brought in toward the body.
- **Against each report:** face centre within 2 mm, face angle within 0.3°, long axis within about 1°, wrist within 6 mm. The elbow is within 1.7 cm; the two edits' elbows were 3 cm apart, and the rule takes their average direction.
- **Checked:** Kenji with Aya gets the same pose. The press reaches 27–29 mm, with nothing showing through the blade's edges.

## Update 2026-09-30: paddle raised from the pose editor

- **New raised pose (engine):** the paddle's Arm raised beat is the pose set on Aya in the pose editor, reproduced to the millimetre. The paddle is held high to her right, blade up, the right shoulder drawn back. The same pose scaled to Kenji's height was checked and approved, so there's no per-character override. Rin and Kiko get it scaled too.
  - *Rule (`WIDE_RAISED`):* the blade's face centre is given as an offset from the right shoulder, scaled by height like the old `raisedPt`, with its face normal and long axis in world directions. The elbow sits in the plane of the stored upper-arm direction. The fingers ease into `[3, 0, 70]` toward the top of the swing.
  - *Shoulder:* `IMPLEMENTS.paddle.giver.raised` sets `clavR [8.9, -11.9, 3.2]`.
  - *Replaced:* the old raised pose for wide implements, with a straight wrist, the palm turned in and the blade edge-on over the shoulder.
  - *Swing:* along the whole swing, the blade's face stays 75–82 mm from the disciplinarian's own body (Aya, Kenji, Rin), and doesn't touch the subject before contact.
- **Contact fit crash fixed:** with some shoulder positions (Kenji's during a swing), every contact elbow was dropped by the wrist-angle filter and the fit read from an empty list. The contact pose picks its elbow by the stored direction anyway, so that filter no longer applies to it; the rest search keeps it.
- **Arm solve for wide implements:** the arm is now solved to the wrist the blade's placement implies, and the hand then takes exactly the requested turn. Before, IK went to the palm centre and the hand was turned afterwards, which left the blade up to a centimetre off; only the learnt correction at rest and contact hid that.
  - *Side effect at rest:* the resting paddle moved about 1 cm and 3°, to the pose the rest fit always asked for.

## Update 2026-09-30: paddle contact from the pose editor

- **New contact pose (engine, so the game too):** the paddle now lands on edge against the sit spots. The pose was set by hand in the pose editor (Aya with Kiko) and is reproduced exactly: face centre, wrist and elbow within 3–4 mm, face angle within 1.2°.
  - *Rule (`WIDE_CONTACT`):* the blade's long axis runs along the level line between the two sites, with its face rolled 82.4° about that line from facing straight down. Its centre sits 2 cm toward the far site and 1.6 cm below the sites' midpoint, with the higher site 2 mm into the face. The offsets scale with height.
  - *Arm:* the elbow goes to the upper-arm direction from the editor, in the torso's frame. No comfort limits apply. By the fit's own measure, the wrist is at about 64° radial deviation, well past a real wrist's range (about 25°). That's deliberate: the pose was chosen by eye.
  - *Torso:* `IMPLEMENTS.paddle.giver.contact` layers over `GIVER_BEAT.contact` for the paddle only. It keeps the relaxed torso the pose was set on and adds the right shoulder's lift (`clavR [2.5, 4.2, -8]`). `scn.giverQ(beat)` applies such layers.
  - *Hand:* after the IK, a wide implement's hand is set to exactly the rotation the fit asks for. The IK's own hand frame was a few degrees off it.
  - *Rest is unchanged:* the old roll/yaw/slide search still sets it, as the fit's `rest`. The swing turns the hand from the rest pose to raised to contact.
- **Deep press:** the glutes stand up to about 4 cm through the blade's face, so the press has a depth (`uPressDepth`, the `depth` argument of `setPress`). The hand keeps 2 cm; the paddle gets whatever stands through its face, plus 4 mm. The blade's footprint now flattens fully out to its edges and corners, then eases back to the natural surface over about 6 cm, so the flesh round it rises out of a dent. Before, the outer quarter of the blade only pressed partway and skin showed through the edges.
- **Contact correction:** the learnt correction at contact now puts the higher site at `WIDE_CONTACT.depth`, not the highest skin in the footprint. That would have lifted the blade clear of the sites and onto the glutes.

## Update 2026-09-30: pose editor (viewer)

- **What it does:** the viewer's Pose editor section freezes the discipline scene at the current beat so it can be reshaped by hand. It then reports the result as numbers, so a pose doesn't need trial and error.
- **Freezing:** Edit pose runs the scene until it settles at the beat (`PE.settle`) and takes that as the base. While editing, `scn.update` isn't called.
- **Saved per beat:** edits are kept per pairing, implement, beat and side (`PE.saved`), so switching beats or implements keeps them. Stopping hands the scene back to its own pose.
- **Joints:** a dot sits on each joint of the chosen character (disciplinarian or subject); left is blue, right is red and the selected one is gold.
  - *Dragging:* a wrist or ankle moves by two-bone IK and keeps its own rotation. With hands pinned, an elbow swings round the held hand. The pelvis moves the whole body, and any other joint turns its parent bone.
  - *Clicking:* shows sliders and exact number boxes for the bone's local Euler angles (YXZ degrees, the pose tables' convention). The pelvis also gets body position sliders.
- **Pin hands:** after any edit that isn't to that arm, the hands are put back where they were. Only a *change* in wrist roll is shared with the forearm; the engine's `setHandWorld` would move the existing wrist twist into the forearm each frame.
- **Implement:** the gold dot is the striking face's centre, with lines for its normal and long axis. Dragging it, or setting its position (world cm) and roll, pitch and turn (from the scene's own angle), places the hand by IK so the face lands there. The skin press follows the hand or blade.
- **Report:** for every edited beat it lists:
  - changed bones: scene → edited, the pose-table value, and the local delta;
  - joints that moved, in world cm;
  - how far the implement moved and turned;
  - clearance of what the right hand holds from the subject's skin: `restClearance` for the hand and hairbrush, `seatExcess` for the paddle.
  It's copied to the clipboard.
- **Engine:** the hairbrush now returns `faceN` and `axis`, like the paddle does. `restClearance` and `PARENT` are exported.

## Update 2026-09-30: implements (hairbrush)
- **`IMPLEMENTS`** (engine): what the disciplinarian holds in the right hand, set with `scn.setImplement(name)`; the scene's `dispose` puts it down. Each has a `mark` weight, how many hand smacks one of its smacks counts toward the colour (`addMark(..., weight)`), so it follows the same build-up curve, coverage (one glute at a time) and fading, just faster.
- **Hairbrush** (`mark: 5/3`: the hand's early 3% becomes 5%):
  - *Shape:* a wooden paddle brush with a dark bristle bed (`buildHairbrush`, parented to the right hand bone).
  - *Finger joints (new, engine-wide):* each hand's fingers were one straight bone and could only tilt at the knuckle. The middle and end joints are now bent in the vertex shader (`FINGER_BEND_GLSL`, `setFingerBend`): in the rest pose, before skinning, finger vertices past each joint (`FINGER_JOINTS`: 42% and 72% of the middle finger's length) turn about it, the far joint first, and normals turn with them. It's off (0) unless something is gripped. Shadows don't include the bend.
  - *Grip:* a fist (`grip: { curl: 60, bend: 80 }`: knuckle curl, then each joint). `fistPocket` traces the curled finger's centreline and finds the largest round handle it encloses together with the palm (about 8 mm radius on Aya). The handle sits there, across the fist with a slight lean, so the fingers close round it instead of it floating beyond them. The oval head stands out past the thumb with its wooden back facing the way the palm does. The head is 15% larger than the first version.
  - *Contact:* the hand is placed so the back of the head, not the palm, lands on the target: the head's offsets from the palm plus a per-side correction (`scn.toolFix`), learnt while the brush is on the skin, from where its striking face actually is. Measured: the striking face about 2 mm into the skin on both sides (the palm uses 4), where the skin compression is.
  - *At rest:* the head's back lies on the subject's thigh, just touching (`REST_GAP`, 1 mm), with no compression (the press is off at rest).
    - *Tilt:* the palm tilts 18° (`REST_TILT`), so the head end dips onto the thigh and the fist lifts clear.
    - *Probes:* sample points cover everything held (`probes`: the brush's vertices, and the gripping fingers' centrelines with their radius, from `fistPocket`).
    - *Fit:* a per-side rest correction, refitted every third frame, sets the lowest probe 1 mm off the skin and keeps the head's face over the rest point across the skin.
    - *Exact clearance:* clearance comes from the subject's own distance field, each probe taken back to the rest pose through the nearest pelvis or leg bone (`REST_SEGS`). A nearest-skin-point test was fooled in the crease between thigh and glute, reading 1 cm "inside" where nothing was.
    - *Measured* (exact): 1.0 mm on Aya→Kiko, Aya→Rin and Kenji→Aya, before and after strikes, with the press at 0.
  - *Colour, measured:* 3 brush smacks a side = 10.1% (5 hand smacks' worth); 10 a side = 52.3% against the hand's 38.7%.
- **Viewer:** an Implement choice (Hand, Hair brush) in the discipline scene section. The brush has its own sound, a sharper, drier crack with a hollow knock.
- **Game:** doesn't use implements yet; `stage.scn.setImplement('hairbrush')` after the scene starts is all it needs.

## Update 2026-09-30: paddle (a wide implement)
- **What it is** (`IMPLEMENTS.paddle`, `buildPaddle`, `PADDLE`): a wide, thick wooden paddle.
  - *Shape:* the blade is 28 × 13 × 2 cm, with rounded far corners and shoulders tapering over a 4 cm neck to a round handle with a knob. The fist sits right up against the shoulders, as in the reference photos.
  - *Wide* (`tool.wide`): the blade lands flat across both contact sites at once. Each smack marks both sides at `mark: 8/3`, so the hand's early 3% becomes 8%, on each side. Measured: 3 smacks give 26.6% a side, exactly 8 hand smacks' worth.
  - *Reaction:* the subject's reaction is centred (`SUBJ_REACT_Q.B`, halfway between left and right). There's no far-side shoulder turn.
- **Grip:** a hammer grip. The handle slants across the palm (`lean: 0.7`) and the blade is turned −75° about the handle's line in the fist (`twist`), so its face sits most of the way toward the thumb side.
  - Both values came from a sweep, as the grip that gives each pairing's arm a straight wrist.
  - With the palm-plane grip (twist 0), the wrist needed about 50° of extension, or the elbow went behind the back.
- **Placement** (`wideFit`): the blade's pose is fitted first, and the hand follows from how the paddle sits in the fist.
  - *Level:* the blade's long axis runs level along the line from the near site to the far one, tip at the far side.
  - *Yaw:* it may turn up to `WIDE_YAW` about the vertical, and slide along its axis by up to `WIDE_SLIDE`. A gap at either site is penalised: each degree of yaw lifts the near site about 2.3 mm, so the fit settles at yaw 0.
  - *Roll:* the roll about the axis is whichever angle leaves the least skin standing above the face. That comes out 50–56° from horizontal, because the fold sites face the feet. It's the same as the upright blade against the seat's side in the reference photos.
  - *Arm:* every elbow position is scored on the wrist (extension, flexion, radial and ulnar deviation), the shoulder's range and twist, the elbow clear of the torso, and the forearm clear of the subject. Anything past a limit is penalised, not dropped, so there's always a pose.
    - The shoulder's range (`SHOULDER_BACK`, 50°) is measured behind the plane of the chest, not from hanging down. That allows the reference photos' elbow: out, up and back, with the forearm coming down to the fist at the hip.
    - `elbowClearAround` lets the elbow pass behind the torso, not only beside it. The wide arm uses plain `armIK`, because `armIKClear` would push it out sideways.
  - *Cost:* about 25–34 ms per refit, cached until the sites or the shoulder move 1 cm.
- **Clearance:** `seatExcess` gives the highest posed skin point inside the blade's footprint, measured from its face plane. It uses the seat's mesh patch (`seatPoints`, indexed once per scene).
  - Exact for a flat face.
  - `restClearance` (now shared with the hairbrush) mapped probes back to rest pose through the wrong bone over a blade this large. The nearest-skin-point test was fooled by the glute/thigh crease under the blade's near end. Both disagreed with the rendered mesh by 15–20 mm.
  - The face's mesh has vertices only round its rim, so a 1 cm grid of probes covers the middle.
- **Rest:** the paddle rests where it strikes, the same hand lifted to `REST_GAP` (1 mm) with no press. It has its own learnt correction, as the hairbrush does.
- **Contact:** the face is `WIDE_DEPTH` (5 mm) into the skin. The press footprint is now a capsule the blade's shape (`uPressAx`, set by `setPress`'s new `axisW`/`halfLen`, zero for the hand and hairbrush).
- **Swing:** the hand turns steadily from the contact orientation to the raised one and back.
  - *Raised:* wrist straight, palm turned in, so the paddle stands up edge-on beside the head.
  - *Arc:* the fist's path bows out to the side (`WIDE_ARC`). A straight line took it through the disciplinarian's own right shoulder.
- **Measured**, Aya→Kiko, Aya→Rin and Kenji→Aya:
  - *Blade:* level (0.0°), with both sites 5–10 cm inside its ends and centred across it.
  - *Rest:* face 1.0 mm off, sites within 3 mm of the face, press 0.
  - *Contact:* face 5.1 mm in (4.4 on Kenji), sites 0–4 mm in.
  - *Wrist:* within 3° of straight (Kenji's contact extension up to 15°).
  - *Elbow:* 21–23 cm clear of the torso, 30–35° behind the chest plane.
  - *Swing:* through the whole swing the paddle stays at least 20 mm clear of the disciplinarian's own body (posed mesh, own arm excluded). The fist stays 6–17 mm off the subject at rest and contact.
  - *Regressions:* the hand and the hairbrush are unchanged, and all their smacks land.
- **Viewer:** the Implement choice has Paddle, with its own sound, a full, heavy crack with a deep body.
- **Game:** as for the hairbrush, `setImplement('paddle')` is all it needs. The engine copy in the `starlight-game` folder predates this.
- **Open:** the blade has no holes (the reference paddle has them). The gripping fingers are the shared fist curl, closed round a round handle.

## Update 2026-09-30: paddle grip rework
- **Board:** the paddle is now one extruded board, 1.6 cm thick: blade 28 × 13 cm, shoulders sweeping in over 3.5 cm to a flat handle 2.6 cm wide and 11.5 cm long (`PADDLE`). The old round stub and knob, which rendered detached, are gone.
- **Grip** (as asked): the board's faces are parallel to the palm, so the palm and its heel face the way the striking face does.
  - The handle's back face lies on the palm, 2 cm in from the knuckles toward the heel (`seat`), slanting 0.25 toward the fingertips at the thumb end (`lean`).
  - The fingers close over the front face. `flatGrip` picks the tightest fist that still brings the middle fingertip back over the face, with every finger checked, allowing up to 3 mm of skin give. It returns per-character values: about 70° at the knuckle and 55° at the other joints on Aya.
  - The thumb is on the other side of the handle from the palm, its pad on the front face.
- **Thumb bones (new, engine-wide):** `thumbL/R` (at the base, in the heel of the palm) and `thumb2L/R` (at the knuckle), with the thumb's primitives moved onto them (`THUMB` holds its geometry). They stay at rest unless an implement sets them. The paddle's fit turns the base (out of the palm, across it, and lifted) and bends the knuckle until the pad rests on the front face without touching the back face or the curled fingers. It runs once, on pick-up (about 0.3 s).
- **Placement:** with the palm facing the blade, the blade now turns up to 32° within its own plane (`WIDE_YAW`), not about the vertical, so it lies diagonally across the seat with both sites still touching. That turn is what lets the forearm come in from the disciplinarian's side.
- **Measured** at contact (Aya→Kiko, Aya→Rin, Kenji→Aya, Rin→Kiko): both sites touched (gap ≤ 2 mm), wrist extension within 15°, elbow 9–12 cm clear of the torso, forearm clear of the subject, nothing past a limit. Kenji's wrist has 23° of radial deviation, the most of any pairing. Hand, hairbrush and paddle all landed every smack in a loop test, with no console errors.
- **Limits of the hand model:** the fingers grow from the palm's mid-plane and the palm is rigid, so a fully clenched fist has only about 1 cm of room inside it. The handle's size and seat are the tightest this allows. The thumb's pad reaches the front face near its wrist-side edge, not the middle. Sawtooth shading between the bent fingers predates this.

## Update 2026-09-29: mouth animation, moods
- **Expressions:** Aya's, Rin's and Kiko's updated to your slider values.
- **Mouth** (painted, like the lips; the fragment shader, from `uMouthOpen` = half-width, half-height, teeth):
  - `teeth` (0…1): the lips draw back off clenched teeth, a parting narrower than the mouth, with the upper and lower rows meeting at a bite line.
  - `mouthOpen` (0…1): an oval opening whose perimeter always equals twice the mouth line, so it narrows as it opens and is a circle at 1 (`mouthOpening(w, t)`: Ramanujan's perimeter, solved for the half-width). Checked numerically at 0, 0.5, 0.8 and 1: exactly 1.000 × in each case, and at 1 a circle of 12.7 mm radius for a 20 mm half-width mouth.
  - *Inside:* a dark interior, the upper teeth hanging from the top of the parting (some showing even when not bared) and the lower rising from the bottom, shaded toward the corners; the lips ring the opening. Corner bends apply to all of it.
- **Moods** (`MOODS`, `setMood(ch, name)`): offsets added to the character's own expression, blended in and out over about a quarter of a second, clamped to each value's range (`EXPR_RANGE`).
  - *Effort:* teeth bared and clenched, corners down, brows furrowed and drawn down, lower lids tight, upper lids heavy.
  - *Enjoyment:* teeth bared, corners well up, a crinkle under the eyes (squint), outer brows lifted.
  - *Open:* mouth open, brows raised, eyes wide.
- **Per-character moods:** a preset's `moods[name]` replaces the shared `MOODS` entry for that character (`moodFor`). In the viewer, picking a mood switches the Expression sliders to editing that character's version: they show the face as it looks (rest plus mood), and each change is stored as the difference from their resting value, so later changes to the resting face carry through. None goes back to editing the resting face. Eye movement, contact and blink rate aren't part of moods. Show JSON exports the edited preset, `moods` included. Checked on Kiko's Effort: only hers changed, and Aya kept the shared version.
- **Preset moods** (your tuning; checked: the viewer's sliders match your screenshots exactly):
  - *Aya:* her own Effort and Enjoyment.
  - *Rin:* her own Enjoyment, a closed-mouth smile with the furrow easing (`teeth: 0` overrides the shared bared teeth).
  - *Kiko:* her own Enjoyment, a full open grin with her eyes wide, not crinkled.
  - *Shared:* Rin's and Kiko's Effort, everyone's Open, and all of Kenji's moods.
- **Viewer:** Teeth bared and Mouth open sliders; mood buttons (None, Effort, Enjoyment, Open) for the selected character.
- **Checked:** all four characters at rest and in each mood. The game isn't using moods yet: `setMood` is ready for events such as the correction impacts or the finale's hits.

## Update 2026-09-29: expressions
- **Face defaults:** updated to your second round of slider values, in each preset.
- **Expression** (`EXPR_DEFAULTS`, a preset's `expr`, `setExpression`, `faceStep`): the face's shape is fixed at build, so expression lives in its moving parts, which update every frame (both render loops call `faceStep` with everyone on set).
  - *Brows:* `browInner`, `browOuter` (raise, −1…1: the brow moves by their mean and rolls by their difference), `browFurrow` (0…1: inner ends drawn down and in), `browAsym` (left higher + / right −).
  - *Eyelids (new):* skin-coloured shells over each eye, trimmed along the lid line by a clipping plane (`renderer.localClippingEnabled`, set in both pages). `lidUpper` (−1…1: heavy to wide), `squint` (0…1: the lower lid raised). The upper lid follows the gaze up and down; lash lines ride the lid edges. `setSkin` retints them.
  - *Gaze:* `gazeX`, `gazeY` (−1…1): the resting gaze.
  - *Mouth:* `mouthL`, `mouthR` (−1…1): each corner of the painted mouth bent up or down, by up to 5 mm (`uMouthCorner`).
  - *Idle life:* blinks every 2–6 s ÷ `blink` (0.16 s, the lids closing fully); eye movements whose frequency and range follow `saccade`, returning to the resting gaze with probability `contact`.
- **The four expressions**, from the character briefs:
  - *Aya* (watchful composure): lids a touch lifted, brows level, corners exactly level; few eye movements, gaze held, slow blinks.
  - *Rin* (quiet preoccupation): a faint concentration furrow, gaze a little lowered, corners fractionally down; frequent, wide eye movements that rarely settle on you.
  - *Kiko* (asymmetric readiness): her left corner cocked up (0.6) and the right barely (0.05), eyes wide, brows lifted with the left higher; quick eye movements that snap back to you (contact 0.85).
  - *Kenji* (steady absorption): gaze resting off to one side and up, lower lids raised with the upper a touch heavy (the tension round the eyes), corners a hair up; slow eye movements.
- **Viewer:** an Expression section with a slider for each value, applied live (no rebuild), and a toggle to freeze blinks and eye movement.
- **Checked:** all four at rest, front and three-quarter, and all four mid-blink (fully shut). Game dance run and corrections have no errors.
- **Not yet:** the briefs' changes of state (Rin softening when safe, Kiko's face dropping when unobserved, Kenji's slow smile) would need expressions that change over time or on events. These values are only the resting face.

## Update 2026-09-29: faces, head camera, collapsible viewer
- **Face structure** (engine, `buildSpec`; the game gets it too):
  - Added: a brow ridge (so the eyes sit in shallow sockets); cheekbones under the outer eye corners; and a nose (see below). Lips are painted, not modelled (see below).
  - The mandible blends wider, which removed the crease under the cheeks, and the mouth mass and jaw sit a little further back (the lower face read as a muzzle).
- **Face parameters** (`FACE_DEFAULTS`, `faceParams(m)`): `eye`, `eyeGap`, `brow` (a raise, −1…1), `nose` (tip length), `bridge` (bridge height), `hump` (−1…1), `tipTilt` (−1…1), `noseWidth`, `lips`, `mouth`, `mouthHeight` (−1…1), `cheeks`, `jaw`, `chin`. Apart from the four ranged ones, they're multipliers of the build's base face, 1 by default; `jaw` defaults to 1.12 on male builds, as before. Any preset can set them.
- **Nose:**
  - *Ridge:* runs straight from the root between the eyes to the top of the tip, as two cones meeting at its middle. `bridge` sets how far the root stands off the face; `hump` bends the middle out (a dorsal hump) or in (scooped), and 0 is straight. The old bridge ellipsoid, which always made a bump, is gone.
  - *Tip:* `nose` moves it out from the face. `tipTilt` turns the tip lobule, and the top of the columella under it, about the nostril line (up to ±26°), so the nostrils stay put.
  - *Pieces:* an elongated lobule (so its angle reads), a nostril each side, and a columella down to the lip.
  - *Checked* in profile: straight by default, a clear hump at +1 and a scoop at −1 (the hump moves the ridge's middle 0.0065 × head height, enough to survive the blend), and tilt drooping at −1 and upturned at +1.
- **Preset faces:** set from your slider choices (Aya, Rin, Kiko and Kenji each carry their face values in their preset).
- **Eye height** (`eyeHeight`, −1…1): moves the eyes, brows and brow ridge ±0.006 × head height, with the cheekbones following halfway.
- **Youth** (`youth`, 0…1; 1 on Rin and Kiko, both adults of 21 and 20): a young-adult face rather than a middle-aged one.
  - *Eyes:* more open, with the white 18% taller, the upper lash line lifted clear of the iris instead of resting over it, and the iris 8% larger.
  - *Lower face:* shorter, with the chin 0.008 × head height higher and less deep, and the mouth following, since it's anchored between the nose and the chin.
  - *Cheeks and jaw:* the cheek fullness moves up and forward to the apples of the cheeks and grows 20%; the jaw narrows 7%, rounds and blends softer.
  - *Brows:* level instead of drooping at the outer ends.
  - Checked close up on both, with Youth off and on.
- **Head camera framing:** it now frames the head, hair and shoulders, anchored halfway between the shoulder line and the top of the hair. The distance fits the shoulders' width at the 30° field of view.
- **Mouth height** (`mouthHeight`, −1…1): the mouth line defaults to 0.008 × head height above halfway between the base of the nose (`noseBaseY`, where the columella meets the lip) and the bottom of the chin; that's the old +1, which you preferred. The slider moves it a further ±0.008 × head height.
  The mouth mass behind the lips moves with it. Checked in profile at −1 and +1.
- **Lips are painted:** modelled lips (two ellipsoids) only ever read as a bulge at this mesh resolution: parted when they met along a groove, pouting when blended into one. So there's no lip geometry. The shape (`spec.mouth`, from the mouth line) is an upper and a lower half-ellipse tapering to the corners, `lips` × their height and `mouth` × their width. The fragment shader paints it from each pixel's rest position (`uMouth`, `uMouthZ`, in front of the face only), so the edges are clean whatever the mesh spacing, with a fine closed-mouth line (40% darker, a fraction of a millimetre plus a pixel). Checked: every character reads as a closed, neutral mouth.
- **Eyes and brows** (`addHead`): an almond of white set into the face, with a coloured iris (`eyeColor`, default dark brown), a pupil, a dark lash line along the upper lid and a softer one below. Eyes are turned slightly to follow the face. Brows are in the hair colour, heavier on male builds, and follow the eye spacing and brow height.
- **Lip colour:** the skin warmed toward a rose, less on male builds (or `lipColor`). `setSkin` retints the lips.
- **Viewer:**
  - *Head camera* (View): turning it on aims at the selected character's face, front on. After that it follows only the face's height, so orbit, zoom and angle are yours to keep. It re-aims only when another character is picked; a slider rebuild or the scene's copy of the same character keeps the view. Checked: an orbited side view was unchanged after a slider rebuild, and picking another character re-aimed front on.
  - *Face sliders:* a Face section under Measurements.
  - *Collapsible sections:* every sidebar heading folds its section, remembered in the browser.
- **Limit:** the head mesh is 4 mm voxels, so nostrils stay soft; finer detail would need a finer head voxel (`HEAD_VOXEL`) at some build-time cost.

## Update 2026-09-29: lowered garments as one piece
- **Waistband loop** (`buildBunches`, `bunchStep`, called by both render loops each frame): replaces the two per-leg rolls. One gathered loop round both legs at the top of the lowered band hugs the outside of each leg and spans the gap in front and behind (the hull of the two legs' cross-sections). It's rebuilt each frame from the legs' bones, so it stretches as they part (thinning across the gap) and gathers as they close. Its folds are fixed to the fabric, so they stretch with it.
- **Inner rolls:** the hull loop only covers the outside of each leg, so a second gathered roll (`inner`, `BUNCH_IN` points each) runs round the inner half of each leg, from the back strand to the front one; each leg is fully wrapped.
- **Seat:** one panel from the bunched fabric round one leg to the other. Its front and back edges run along the loop's strands (sag included); its sides follow the centre of the inner rolls, so the seam is inside the roll. Slack (`seat`: 10% of height, 16% for loose trousers) hangs down in the middle, less as the legs part, never below the floor. Applies to every lowered garment. Checked from below and below-behind on Rin, Kiko, Aya (calves) and Kenji (ankles), standing, in Spread and across the lap.
- **Trousers to the ankles, loose** (`lowerTo: 'ankle'`, Kenji's trousers): painted from `LOWER_ANKLE` (80% down the shin); a thicker pile standing well off each ankle, with broader, rounder folds. The strands across hang slack (`slack`: 34% of height) until the feet are further apart than that.
- **Resting hand:** moved to halfway down the back of the thigh, clear of the loop.

## Update 2026-09-29: skirt sleep; viewer toggles
- **Skirt sleep:** once her waist and everyone near her (their hips and hands) have held still for `SKIRT_SLEEP` (1.5 s), the cloth stops simulating, so it no longer quivers on the spot; any movement wakes it, as does gathering. Measured in Hands on head: it settles in about 2 s as the arms come up, then holds exactly still.
- **Viewer:** the Clothing panel has **Bottoms down** (for anyone with a `bottom` layer) and **Gather skirt at back** (for anyone with a skirt). Each follows that character onto the turntable and into the discipline scene in either role, and is kept through look changes and rebuilds. The scene's subject is only lowered when their toggle is on (it used to be always).

## Update 2026-09-29: which correction, the wall, leggings to the calf
- **First correction over shorts:** the game counts each girl's corrections (`G.corrections`). Rin's and Kiko's first is over their shorts; from the second on, the shorts come down (`createDisciplineScene(..., { lower })`, decided in `stageAcrossLap`). Aya's leggings come down for every one of Kenji's. The viewer always lowers.
- **Aya's leggings:** lowered to mid-calf, not the knee (`lowerTo: 'calf'` on the layer): painted from `LOWER_CALF` (45%) down the shin to the hem, with the bunched roll there, carried by the shin bone.
- **At the wall (Kenji's scene):** Rin and Kiko both have their shorts down, and Kiko's skirt hem is gathered at her waist behind (`setSkirtGathered`: the hem's back columns, within 60° of straight behind, are pinned just outside and below the waistband, and the fabric between folds over).
- **Bunches only when worn:** `dress` hides the rolls whenever the lowered garment isn't part of what's worn (a different look, or unticked in the viewer).
- **Reset:** `clearStage` pulls everyone's bottoms back up and lets the skirt fall before each new scene is set.
- **Checked in the game:** at the wall (both lowered, skirt gathered); Kiko's first correction (shorts on) and second (shorts down); Aya with Kenji (leggings at mid-calf).

## Update 2026-09-29: clothing in corrections
- **Lowered to the knees** (`setLowered(ch, id, on)`, engine): a worn garment is measured as lowered. Its paint covers only a band round each knee, from `LOWER_BAND[0]` (7.5 cm) above the joint to 2 cm below for shorts, or on down the shin for leggings. A crumpled roll of fabric round each leg at the top of the band (`buildBunches`) is sized by probing the leg and carried by the thigh bone. `ch.layers` keeps the original layers, so colours and looks are unaffected.
- **In every correction:** `createDisciplineScene` lowers the subject's `bottom` (Rin's and Kiko's shorts, Aya's leggings in Kenji's scene) and takes off a skirt; `dispose` restores both. The standing talk beforehand is unchanged. Works the same in the viewer.
- **Resting hand:** the disciplinarian's left hand now rests on the back of the subject's thigh, 60% of the way from hip to knee (it was 85%, on the knee, where the roll now is). Strikes still land on both sides for all three pairings.
- **Kiko's skirt in the game** (`kikoSkirt`, `G.kikoInShorts`): until her first correction she wears it for her runs. After that she rehearses in her shorts (her runs, watching Rin's correction) and puts it on to perform: the finale and Kenji's scene that follows. Traced through every stage in the game.
- **Test hook:** `__game.stageDanceScene` and `LEVELS` added.
- **Open:** garments change during the fade between the standing talk and the lap, with nothing on screen to say so.

## Update 2026-09-29: feet on the floor, skirt edges, fit fixes
- **Feet on the floor** (`groundFeet`, run for every dancer after the pose, in the viewer and the game):
  - *Before:* each pose set its own knee bends against a fixed body drop, so feet landed at different heights. Spin & Land had one foot floating 3 cm and the other sunk 9 cm; Cross-Step, Bend & Reach and Arms Wide were off by 3–6 cm.
  - *Now:* any foot within `PLANT_MAX` (15 cm) of the floor is planted. The body comes down only if a straightened leg can't reach; each planted leg is re-solved with two-bone IK (knee kept in its own direction), and the foot is laid flat, keeping its heading. A higher foot (a kick) stays in the air.
  - *Measured:* every planted sole within 0.1 cm of the floor in all 12 moves, for Aya and Kiko.
- **Skirt:**
  - *Edges:* particle collisions alone let the cloth straddle a limb (a kicking thigh swinging up between two rows) or a curve, with every particle outside but the triangles between them cutting through. The midpoint of every ring and column edge is now tested against her own body too, and pushes both ends out together.
  - *Side it came from:* particles are pushed out of her body on the side they came from (the direction at their previous position), so a leg sweeping up under the fabric lifts it rather than passing through. The raised thigh in either Kick now lifts the skirt and drapes it.
  - *Cost:* collisions run on the last three constraint passes and the edge test once a frame, about 8 ms a frame (up from 4). A candidate for optimising later.
  - *Off for corrections:* `createDisciplineScene` takes the subject's skirt off (`setSkirtOff`: hidden, not simulated) and `dispose` puts it back on, restarting the cloth from rest. It stays on for the standing dialogue before the lap. Why: the contact shader compresses both bodies' skin on the GPU where they press together, but the cloth collides with the uncompressed shapes, so fabric squeezed between hips and thigh (and under the resting hand) could not be kept out of either. A fix would mean mirroring that compression on the CPU for the cloth. Checked in the game: on in dialogue, off across the lap, back on (and simulating) for the finale.
- **Base of the pelvis (perineum piece) and the gusset:** the body had no surface of its own between the thighs: just where the torso's tapered end met the thighs. Stopping briefs at the thigh crease cut the gusset away (that skin moves partly with the thighs), and exempting a fixed strip either side of the centre line painted onto the inner thighs when the legs spread. Now:
  - *Shape:* a narrow rounded strip runs front to back along the base of the pelvis between the thighs (an ellipsoid tagged `perineum`, on the pelvis bone, blended into the torso).
  - *Coverage:* briefs cover skin where that piece's share of the vertex exceeds 15% (the skin weights recorded at build), and nothing else past the crease.
  - *Aya's thong:* its strip widens into the gusset at the bottom.
  - *Checked:* all three from below, front and back, in Relaxed and Spread.
- **Hair:**
  - *Aya's ponytail:* a stub of hair from the scalp out through the scrunchie is held proud of the head (the chain's first two nodes are fixed, `fixed: 2`), and the tail falls from its end.
  - *Kiko's bobbles:* set further out along each bun, so the whole ring clears the head and wraps fully round.
  - *Kiko's clips:* further back and higher (over the side of the head, above the temple), lying front to back.
- **Kiko's sports bra:** the straps cross the shoulder near the neck (`strapOut: 0.1`), off the skin that moves with a raised arm, so they stay clean with her hands on her head.

## Update 2026-09-29: Kiko's skirt (cloth); hair accessories
- **Skirt** (wardrobe kind `skirt`, `buildSkirt` and `skirtStep` in the engine). A separate blue cloth mesh, which Kiko wears in Rehearsal over her shorts; it can be ticked on or off in the viewer.
  - *Shape:* 12 rings × 40 columns of particles. The waistband is `above` (1 cm) over the shorts' top, and the skirt is `length` × height long (0.18). It falls straight down from the widest part of the hips with 10% ease below the band (`SKIRT_EASE`, room for the hips to flex over a lap) plus a 4 mm gap, and flares by `flare` × height (0.025) at the hem.
  - *Motion:* the waistband is pinned to the body with blended pelvis/spine skinning. The rest is Verlet cloth: gravity, damping, springs around the rings, down the columns and across, and weak bending so it hangs loose. The hem ring's longer rest length keeps the flare. Each frame the cloth is first carried with 90% of the waist's travel (`SKIRT_FOLLOW`), so drops don't snag it on the legs, but only 30% of its turning (`SKIRT_FOLLOW_ROT`), so it lags and flies up in a spin. In Spin & Land the hem rises to within 5 cm of the hip joint, then settles.
  - *Collisions (every constraint pass):*
    - Her own body, two ways: her contact proxies catch cloth that ends up deep inside, such as a thigh swinging up into it; and her posed skin (mesh vertices in the skirt's height band, re-skinned each frame and bucketed in a 3 cm grid) handles the surface itself.
    - Other bodies on set: their contact proxies, padded 8 mm. Their hands are capsules, applied last so a palm lands on the cloth.
    - The floor, and solid objects passed in (the flight case).
  - *Wiring:* both render loops call `skirtStep` after hair.
  - *Measured:* against the posed skin, at most 3 of 440 particles more than 5 mm inside during Spin & Land, Kick, Floor Touch and Extend & Turn. Across the lap, 3 are inside, where her belly is pressed onto Aya's thigh. From behind a face-down subject you can see up the hem; that's the cloth hanging toward the floor, not clipping.
  - *Cost:* about 4 ms a frame.
  - *Checked:* standing, Kick, Spin & Land (over time), Floor Touch, after a routine, and across Aya's lap in the viewer and in the game's correction.
  - *Limit:* the cloth is a single sheet with no thickness, so the shorts can show through where it bunches on a lap.
- **Hair accessories** (`outfit` in the presets, built in `addHead`):
  - *Aya:* a white gathered scrunchie round the ponytail's knot at the scalp (`scrunchie`), and a glossy black bobble near the tip of the tail (`bobbles[0]`), carried by the last simulated segment so it swings with the tail. The tail is gathered through the scrunchie: it starts where the hair leaves the hole, with a slim first segment. The scrunchie is solid to the hair simulation (12 capsules round its tube, `ch.hairRings`). Measured: the tail stays at least 2 cm clear through a routine and 4 cm across the lap.
  - *Kiko:* a blue bobble round the left bun and a pink one round the right (`bobbles`), and a clip each side of the fringe in the other colour (`clips`: pink on the left, blue on the right), set on the hair surface just above the hairline and lying along the scalp, front to back, angled slightly outward.
  - *Fit:* ring sizes are probed from the knot's own shape in the ring's plane, so they sit snugly.

## Update 2026-09-29: marks at the contact sites; viewer impact sounds
- **Marks** (`addMark`, `clearMarks`, `markStrength` in the engine):
  - *Recording:* each landed smack converts the skin point under the palm (the strike fit's `skin`) into the subject's rest space through the pelvis bone, moves that side's running centre toward it, and adds one to that side's count. The scene calls it on every impact (`scn.mark`).
  - *Strength* (`markStrength`, per side):
    - *Up to `MARK_KNEE` (10) smacks:* the S-curve `n^2.5 / (n^2.5 + 12^2.5)`, about 3% at 3 and 39% at 10 (`MARK_HALF`, `MARK_POW`). This is the part you were happy with.
    - *Beyond that:* logarithmic, `39% + 61% × ln(n/10) / ln(10)`, reaching full depth at `MARK_FULL` (100 smacks a side, 200 in total). It's about 57% at 20, 68% at 30, 82% at 50 and 92% at 75; it used to reach 91% at 30.
    - *Inverse:* `markCount` inverts both pieces exactly (checked), so smacks on a faded mark build on what's left. In a long scene the slow time fade takes a little off as it goes: 200 smacks landed over several minutes finished at the equivalent of about 87 per side.
  - *Spread:* the colour spreads out from the centre at the same rate. The solid core reaches `mix(0.3, 1.45, f)` of the way to the edge of that side's region, so at full strength it covers all of it: the whole glute behind, up to 0.035 × height above the hip line or just below the character's own underwear waistband if that is lower, so no colour shows above the band (checked at full strength on all three women), out to the hip's side, in to the midline, and at the bottom full to the crease where each thigh meets the glute, then fading out over `MARK_THIGH` (3 cm) down the thigh along the crease's curve, with no hard line. Each vertex's distance to the crease is the `creaseD` attribute, set by `dress` (`markRegion`).
  - *Colour:* the skin is mixed toward `MARK_COLOR` (a deep red) before the clothing layers are painted, so clothing is never tinted.
  - *Lifetime:* marks persist outside the discipline scenes and fade slowly on their own (`fadeMarks`, called every frame for every character, on stage or off). Two fades: each dance move keeps `MARK_FADE_MOVE`, so a 12-move routine takes 100% to 55% at any tempo (holds and stumbles count, `fadeMarksMove`); and time fades it proportionally, all the time, off stage too. The time fade is tuned so that a typical cycle, `MARK_CYCLE_MIN` (6) minutes from one correction to the same character's next with one routine danced, ends at `MARK_AFTER_CYCLE` (25%). Time can never take more than that share since the side's last smack (`MARK_TIME_FLOOR`), so a slow player can't push a mark below 25%. Simulated: 3 minutes ends at 37%; 6, 12 or 30 minutes end at 25%. The game holds marks steady through the finale (`ch.marksHeld`, set in `startFinale`, cleared in `finishFinale`): measured unchanged across a full finale. The area shrinks with the strength. Later smacks build on what's left: the remaining strength counts as its equivalent number of smacks (`markCount`) plus one. The game no longer clears marks between rehearsals. The viewer carries them between the turntable and the scene, and through rebuilds (`copyMarks`), and still has a Clear marks button.
- **Viewer:** a Smack button lands one smack at a time, as in the game. Impacts play the game's clap, louder for a firmer smack, with a Sound toggle. Checked: one clap per impact, and none when muted.

## Update 2026-09-29: contact, lap placement, thumbs, briefs crease (engine, so the game too)
- **Contact between bodies** (`CONTACT` in the engine):
  - *Proxies:* each character carries proxy shapes fitted to its own body (`buildProxies`). The torso is a stack of elliptical slices read off the loft every 3 cm, and the bust, glutes, limbs, neck and head use their own primitives. Hands are left out, since IK and the press slots place them.
  - *Each frame:* `updateContacts` poses each character's nearest partner's proxies into world space as uniforms. The vertex shader pushes any skin vertex inside them back out along the proxy normal and flattens the normal there.
  - *Softness:* both sides give way in proportion to how soft each is at that point (the `soft` vertex attribute, from `softness()`): belly, glutes and bust 1, thigh 0.7, shin 0.35, hands and feet 0.15. A belly on a thigh therefore compresses mostly the belly.
  - *Bust:* `bustContact` first moves each bust bone out of the partner's actual body (their distance field, reached through the nearest bone), so the breast flattens against the surface. The shader then takes up whatever is left.
  - *Wiring:* both render loops call `bustContact` and then `updateContacts` after `bustSpring`. Shadows still use the undisplaced mesh.
- **Lap placement** (`LAP_ALONG`, `LAP_SETTLE`): the subject's pelvis now sits on the centre line of the disciplinarian's actual seated right thigh, 70% of the way to the knee, at the thigh's own height there. It was halfway along, about 10% inside the thigh line. Strikes still register on both sides for Aya→Kiko, Aya→Rin and Kenji→Aya, and the game's Kenji scene runs.
- **Thumbs:** a metacarpal set into the palm, then a separate phalanx with the fingers' tight blend. The tip reaches the middle of the index finger's first segment (0.68 × hand length), where before the thumb stopped as a nub at 0.5.
- **Briefs crease:** briefs (not trunks) stop at the crease where each thigh takes over (`thighCreases`, `creaseDistance`), so they no longer paint skin that swings out with the legs. The crease is a smooth curve around the thigh axis taken from the skin weights (smoothed weight over `THIGH_LIMIT`), which keeps the edge clean.
- **Open:** slight dark specks between the fingers on close-ups (the fine hand mesh where fingers nearly touch). Contact uses one partner per character, the nearest.

## Update 2026-09-29: male front (engine, so the game too)
- **Shape:** male builds get a soft rounded volume at the front of the pelvis, just above the crotch, so trunks and trousers aren't flat there. It's one ellipsoid on the pelvis bone, tagged `groin`, and clothing treats it as torso, so anything covering the pelvis covers it. At its fullest it stands about 0.022 × height (4 cm on Kenji) proud of the pelvis. It's a mannequin's form, not anatomy.
- **Checked:** bare, in trunks and in trousers, from the front, side and three-quarter angle. In the lap scene, Aya's nearest point is 13.8 cm from its centre, and its largest radius is 5.1 cm.

## Update 2026-09-29: no web between the thighs (engine, so the game too)
- **Cause:** each leg group was smooth-joined, with an 8 cm blend (`join: 0.05 × H`), to everything built before it, including the other leg. The inner thighs start only a few centimetres apart in the rest pose, so the blend filled the gap between them with a web. The web was skinned to the pelvis, so whenever the legs opened (Spread, Floor Touch, Kick) it stretched into a flat sheet across the crotch, and the briefs couldn't follow it.
- **Fix** (`field`, groups flagged `leg`): each leg is smooth-joined to the torso alone, which keeps the hip crease smooth, and then added with a plain union, so nothing fills the gap between the legs. The grouping skip test for legs is against the torso's distance, which is exact, because a smooth-min of values further apart than its radius is a plain min.
- **Crotch, mannequin-style (later the same day):** fixing the web left a groove where the tops of the inner thighs met, up the front and back. Rest-pose probes show at most 5 mm of groove, so the divot came from posing: skin near the centre was split between both thighs and the pelvis, and opening the legs dragged it into a slot. Two changes fix it:
  - *Shape:* the old crotch filler is replaced by a wider rounded pelvic volume spanning between the thigh tops (tag `glute`, bottom just below the crotch line), which closes the torso over them.
  - *Skin weights:* above the body's crotch point and near the centre line the pelvis carries the skin, handing over to each thigh halfway out to its hip joint. Below the crotch point the inner thighs stay entirely with their legs.
- **Briefs rewritten:** one continuous edge rule for torso and thighs alike, instead of relying on the crease where the thighs take over, which was high on the front and left Kiko with almost no front. The gusset depth comes from each body's probed crotch point (`crotchY`). See the comment on `briefsCoverage`.
- **Elbows and knees:** the two segments lie in a line at rest, so the distance softmax shared vertices between them over about ±5 cm, and a strong bend pinched the joint thin (Hands on head). Their combined weight is now split across the joint over ±`HINGE_BLEND` (0.012 × height, about 2 cm), so a bent elbow keeps its thickness to a defined point. Checked in Hands on head and in the lap scene's seated knees.

## Update 2026-09-29: layered clothing (viewer only so far)
- **Layers:** a preset's `wardrobe` holds named garment layers, and its `looks` list which ones are worn, innermost first. The shader paints them over the skin in that order, up to 8 (`MAX_LAYERS`). `outfit` now only holds the hair.
  - *Kinds:* `bra` (styles `bralette`, `classic`, `sports`; see `BRA_STYLES`, and any setting can be overridden on the layer), `briefs` (`rise`, and optionally `riseBack`, a higher waistband at the back that the band sweeps up to over the hips, as on Aya's thong at 1.0; `side`, the leg opening's height at the side seam, which front and back share, so the opening runs continuously around the hip; then a back style: `full`, `brief` with `backCurve`, or `thong` with `thong`, where the front narrows into the waistband. One edge rule for torso and thighs; `leg` gives trunks legs. See the comment on `briefsCoverage`), `top`, `bottom`, `shoes`. The last three are the old outfit, unchanged.
  - *No rebuild:* the mesh build keeps each vertex's 8 strongest primitives (`geo.userData.basis`), so `S.dress(ch)` recomputes the clothing in about 70–100 ms. Colour and skin changes only update uniforms (`S.setSkin`).
- **Base layer:**
  - *Aya:* a black bralette and a black thong, the thinnest cover.
  - *Rin:* a white classic bra and white cotton briefs, triangular behind, leaving the lower outer cheeks bare.
  - *Kiko:* a navy support bra (scoop front, racer back) and navy hipster shorts cut high across the cheeks.
  - *Kenji:* grey trunks, since he wasn't in the brief.
  - *Contact site:* all three women's backs leave part of it uncovered. The discipline scene strikes along the fold where the lower glute meets the thigh, and prefers the lowest point.
- **Looks:** each character has Underwear and Rehearsal. Since the later change, Rehearsal is the full underwear set (bra and briefs) with the clothes over it, and the game uses it. Bra straps show at the scoop necklines: Rin's white straps, Kiko's navy racer back, and Aya's thin straps above her crop top.
- **Skin:** each preset has its own `skin` tone. All four still use the old shared tone.
- **Viewer:**
  - A Clothing panel with look buttons that apply to everyone, per-layer checkboxes and colours, and skin-tone swatches plus a custom colour.
  - An **All** tab for the lineup.
  - A **Hands on head** pose, which is Relaxed plus the `handsOnHead` IK.
  - A **Spread** pose: hands on head in a wide stance, from the engine's `S.wideStance(ch, width)`, which returns the pose and a `drop`. The ankles end up `width` × shoulder width apart, centre to centre (measured exactly for all four at 2×), with straight legs and flat soles. The body comes down by `drop` so the soles stay on the floor (measured at 0 mm), and the viewer eases it in with the pose. The lineup spacing widens to 1.25 m for it.
  - Show JSON now exports the full edited preset, clothing included.
- **Limits:**
  - Straps narrower than about 1.5 voxels break up, because the edge can't be resolved between vertices.
  - Clothing is painted onto the skin, so it has no thickness.
  - A strap can still bead slightly on a raised shoulder.
- **Open:** keep the visible straps, or give Rin and Kiko crew-neck tops (`neck: 'crew'` on the top layer)?

## Update 2026-09-29: stall fix, pose pass
- **Dance stall fix:** `updateDance` now judges every window that has closed before moving on, so a long frame or a hidden tab can't skip a prompt. Before, a skipped prompt kept `result: null`; a skipped Final Bow meant `finishDance` never fired. Prompts that never reached the screen are judged `quiet` (scored as timeouts, nothing shown). Tested headless by freezing the page for 9 s mid-run and again across the Final Bow: all 12 were judged, and the run finished.
- **Poses** (engine, so the viewer and the game both get them). Checked in front, side and three-quarter renders:
  - *Neutral:* `Relaxed` and `DANCE_BASE` no longer stand at attention. The arms hang a little off the body with soft elbows, the feet are slightly apart and the knees soft. `DANCE_BASE` now sets the legs, so moves that don't set them keep a ready stance instead of locking straight.
  - *Spin & Land:* the arms open low to the sides rather than hanging between the knees, and the head is no longer thrown back.
  - *Final Bow:* the free arm settles slightly behind the body rather than sticking out.
  - *Cross-Step:* the arm sweeps across below the chest without cutting into it or covering the face.
  - *Floor Touch:* a deeper fold, so the hand reaches the floor beside the bent knee.
  - *Forward Reach:* the drawn-back hand rests by the hip, not in the middle of the chest.
  - *Unchanged, looked right:* Kick, Arms Wide, Extend & Turn, Step & Reach, Sway & Sweep, Bend & Reach, Stumble.
- **Still open on poses:** `Wait` and `Downcast` keep their stiffer arms, since IK places the hands in both scenes that use them. No moves use finger poses yet.

## Update 2026-09-29: move hints, cameras, dialogue
- **Move hints:** each move has an emoji (`MOVE_EMOJI`). Left and right versions share one, with a gold L or R badge showing the dancer's own left and right. The emoji appear on the move label and on all four buttons.
- **Fixed option slots:** a routine's four options are drawn once, in `generateRoutine`, so each move sits in the same button in all three runs and the finale.
- **Cameras:** a single rig (`useShot(name, { dur, clock, t0, beat })`, `updateCamera`). A shot can glide from `p` to `p2` over its duration, or compute its framing each frame with `fn`.
  - *Dance and finale:* a new moving shot every two bars on the song clock, with a small push-in on every beat (`DANCE_SHOTS`, `FINALE_SHOTS`).
  - *Correction dialogue:* cuts between over-the-shoulder shots of whoever is speaking.
  - *Across the lap:* five angles (`LAP_ANGLES`): Wide, Front (mid-close), Shoulder (over the disciplinarian's right shoulder), Contact, and Head. Head is a close-up from the subject's head side, framed against `stage.backdrop`: the watching bandmate in Aya's scenes, and Rin and Kiko at the wall in Kenji's.
  - *Which angle:* Aya's correction cuts to a new angle every five smacks. In Kenji's the player picks with buttons or keys 1–5, drags to orbit the shot's pivot in any direction, and scrolls or pinches to zoom. Picking an angle resets the orbit.
- **Wall positions:** in Kenji's scene Rin and Kiko now stand along the back wall toward the subject's head side (x 0.35 and 1.65), so the Head shot sees both past Aya's head.
- **Dialogue:** a click anywhere, or Space, moves every line on straight away, auto-played ones included.


## Over the case (new position)

- **What it is:** `createDisciplineScene(parent, g, s, { position: 'case' })`. The subject stands facing +X, bent at the hips, arms down to palms flat on the lid of a flight case; the disciplinarian stands at the subject's left (world −Z), facing +Z and turned `CASE_YAW` toward the subject's hips. The swinging (right) arm points at the subject's rear exactly as it does from the seat, so the strike fit, press, marks and far-side shoulder turn are shared with the lap. The default (`'lap'`) is unchanged.
- **Where it lives:** tables and helpers (`CASE_*`, `standAt`, `casePalm`, `buildCase`) sit just above `buildBench`. `scn.baseQ`/`reactQ`/`giverBaseQ` hold the position's poses. `sceneAnchors` has a new `lowback` anchor (the disciplinarian's resting left hand); the right hand rests on the hip (`glute`) instead of the thigh.
- **Tuning:** `CASE_PITCH` (torso pitch, 84°), `CASE_GIVER_AT` / `CASE_YAW` (where the disciplinarian stands), and `opts.caseHeight` (default 0.88 × the subject's hip-joint height, so the lid scales per character). Palms go where `casePalm` puts them (arms 94% of a straight reach).
- **Paddle:** works over the case too; see the last bullet of this section.
- **Viewer:** a Position choice (Across the lap / Over the case) in the Discipline scene section.
- **Checked** headlessly (Aya→Kiko, Kenji→Rin): relaxed, raised and contact on both sides, hand and hair brush, with the shorts down; a 10-smack loop ran without errors. Not done: the game (`starlight-game.html`) doesn't use the case position yet, and the reaction pose (`CASE_SUBJECT_REACT`) has only had a first look.

- **Fingers compress the skin (all positions):** `setFingerCaps` hands the skin shader up to `CAPS` finger capsules (`uCapA`/`uCapB`). Skin inside one is pushed in along its own normal until it clears the finger, so fingers dent the flesh as the palm plane does. The resting left hand is always on; the swinging hand ramps in at contact and is off while an implement is held (its fingers are round the handle). The thumb isn't included yet.
- **Over-the-case legs:** from a pose-editor report, the subject's legs are nearly straight (thighs −80°, shins −2°, feet flat) in the base pose and the reaction alike, so toes and heels both meet the floor.
- **Paddle over the case:** the wide-implement fit is shared with the lap; the position supplies its own contact and raised settings (`CASE_WIDE_CONTACT`: roll 66°, elbow preference out to the side; `caseWideRaised()`: the lap's raised blade turned with the disciplinarian's yaw) and no paddle layer on the stance. First pass: the blade lies flat across both cheeks at contact and rests against the hip, but the raised pose hasn't been tuned in the pose editor. The viewer's pose-editor edits are now keyed by position too, and its report says when it is over the case.
- **From the paddle pose-editor report (over the case):** the blade's contact roll is 82.5° (`CASE_WIDE_CONTACT`), and the disciplinarian's standing stance (`CASE_GIVER_BASE`) now has nearly straight legs and flat, planted feet for every beat and implement. The subject's legs got the same treatment earlier.
- **From the hand pose-editor reports (over the case):** at rest the swinging hand floats `CASE_REST_HOVER` (16 mm) over the near cheek (new `cheekL` anchor, the strike strip's x at hip height) with the thumb tucked (`CASE_REST_THUMB`); the fingers wrap to about 34°, as the editor's 33°. The left thumb lies along the back (`CASE_THUMB_L`). A far-side (right) hand strike leans the spine forward a further `CASE_FAR_LEAN` and lifts the right shoulder (`CASE_FAR_CLAV`), eased in with the shoulder turn. Not applied: the small left-arm and hand-angle nudges in the same reports (the IK and the palm-angle slider cover them).
- **Paddle at rest over the case** (`CASE_WIDE_REST`, from a pose-editor report on Kenji with Aya): the blade is held low at the right side, pointing forward, instead of resting against the hip. It is placed from the shoulder (m, for 1.7 m tall) in the frame before the disciplinarian's yaw, so it applies to every disciplinarian; `wideFit` uses it as the fit's `rest` when `scn.wideRest` is set (the lap still searches the seat). Checked against the report: hand and blade face land on the edited positions to a millimetre.
- **Subject's palms stay on the lid through every reaction (over the case):** the palms are planted at rest as before; when the reaction lifts or draws back the shoulders beyond what the arm can reach, the palm now slides back along the lid, flat, instead of the arm straightening to the floor (which put the hands into the lid). All implements, both sides.
- **Paddle rest elbow:** the swinging arm's elbow follows a set direction (`CASE_WIDE_REST.elbow`, from the shoulder, from a pose-editor report on Aya with Kiko) rather than the fit's candidate elbow, which the disciplinarian's later lean made inconsistent; it now lands within about a centimetre of the edited elbow.

## Hands on head (new position)

- **What it is:** `createDisciplineScene(parent, g, s, { position: 'head' })`. The subject stands free and upright facing +X, palms on the back of the skull (`HEAD_PALM`: direction on the cranium ellipsoid, fingers along it, elbows out), no case. The disciplinarian stands as over the case (same stance and side; the standing code is shared, `scn.atCase` is true for both and `scn.atHead` marks this one). Their right hand strikes the rear; their left hand hangs at their side while relaxed and eases to rest against the subject's navel (new `navel` anchor, on the front) as the arm comes up, pressing the skin once it's there. Both hands hang at the sides when relaxed, with the right hand's implement at its side (the paddle uses `CASE_WIDE_REST`).
- **Standing contact:** a standing subject's glutes stand well proud of the low strike sites, so for the paddle the blade's plane meets the rear-most skin under its footprint (`wideFit`, `scn.atHead`), then goes `depth` in.
- **Tuning:** `HEAD_SUBJECT_BASE`/`REACT` (the struck back hollows, the head lifts), `HEAD_PALM`, plus the disciplinarian's stance constants shared with the case. Not yet tuned in the pose editor; the disciplinarian stoops quite far to reach the lower glute.
- **Viewer:** Position now has Hands on head.
- **Hands on head, disciplinarian's place and turn (from a pose-editor report):** they stand behind the subject's rear plane at `HEAD_GIVER_AT` (pelvis x −26.6 cm, z −38.6 cm) for every beat. Relaxed: back straight (`HEAD_GIVER_BEAT.relaxed`), facing the subject squarely (`HEAD_YAW_RELAXED`, −2°), head turned to look at them (the scene's gaze does that), both hands hanging by their sides (`HEAD_HANG`, from the shoulder, scaled by height). As the arm comes up they turn to `HEAD_YAW_STRIKE` (30°, toward the subject's hips) about the vertical through the pelvis, so the feet stay put; raised and contact keep the earlier lean. The paddle's rest and raised poses are turned with the matching yaw.
- **Hands on head, from the 10:55–11:02 reports:** relaxed turns a further 11° (`HEAD_YAW_RELAXED` 9°). Raised and contact re-plant the feet with their own leg angles (`HEAD_STRIKE_LEGS`); raised also takes the edited back (`spine1`/`spine2`) and a gaze trim (`HEAD_GAZE_RAISED`, eased in and out around the raised beat). The left palm rests at the subject's waist line (the `navel` anchor is now at `Y.waist`), the same for raised and contact. The raised right arm is the edited one: the hand continues the forearm with the elbow set (`HEAD_RAISED_HAND`, `HEAD_POLE_RAISED`: pole from the shoulder as it is *now* after the lean, and no torso-clearance push while raised, which had been moving the elbow); checked against the report to about 2 cm. The subject's hands now rest on the back of the head, fingers pointing toward each other and loosely curled (`HEAD_PALM`, `HEAD_SUBJECT_BASE.fingers*`), measured from the editor's final arm angles. **Not applied:** the Kenji-as-disciplinarian raised report (knees bent to lower a taller body, a different spine twist); those are per-character and want a rule rather than copying.
- **Hands on head, contact (from the 11:23 report):** the disciplinarian's contact back is the edited one (`HEAD_GIVER_BEAT.contact`: straighter, with a sideways lean), and the gaze trim now stays through contact (`HEAD_GAZE`, raised's offsets easing to contact's). The subject's reaction is the edited one (`HEAD_SUBJECT_REACT`: chest up, head back) and they rise onto their toes (`HEAD_RISE`: 3.8 cm for a 1.58 m subject, feet pitched 18–19°, scaled by reaction), while the disciplinarian's left hand holds its place so the body slides under the palm. The strike lands higher on the cheek than seated (`HEAD_STRIKE_K` 7, the top of the strip; the edited hand sat above where it had been). Checked against the report: head, neck, subject's pelvis and foot, and the left hand within a centimetre; the right hand within about 2 cm. A far-side (right) strike matches the left as closely as it can, with a small extra lean and shoulder turn (`HEAD_FAR_LEAN` 4°, `HEAD_FAR_TURN` 10°, down from 9.7° and 20°); the hand reaches the far cheek.
- **Hands on head, left hand and the paddle's reaction (11:46 report):** the disciplinarian's left hand now rests on the front of the subject's left side at the waist, fingers running around the front (`navel` anchor shifted left by 0.0506 H; `HEAD_NAVEL_FINGERS`). It is a skinned anchor, so it moves with the subject's chest and side as they react (the earlier hold-in-place is gone), for raised and contact with every implement. The paddle's reaction is different (`scn.buck`, `HEAD_BUCK`): the subject bucks away from it, hips forward about 5.7 cm with the feet planted flat (the body pitches 4° about the feet and the back hollows), where the hand and hair brush rise onto the toes. The editor report's left wrist is reproduced to about 2.5 cm.
- **Paddle with a shorter disciplinarian (hands on head):** the paddle's contact sites now use the same higher strike site as the hand (`HEAD_STRIKE_K`), which raises the blade about 7.5 cm. With Kiko disciplining Aya this took the blade from low on the thigh to flat across the glutes, face centre (−8.2, 81.1, −0.2) against the editor's (−5.1, 82.2, −2.6), without moving the disciplinarian. **Still open:** the hairbrush's elbow sits high and near the subject for a shorter disciplinarian (the brush face itself already matches the editor's "before"); an elbow-height term in the strike fit was drafted but not applied or checked.
- **Paddle reaction over the case (12:13 report):** like the hands-on-head position, the paddle bucks away (`CASE_BUCK`, `scn.buck`): the hips come forward 6.6 cm and sink 2.5 cm (for a 1.58 m subject, scaled by height and reaction), the knees bend about 23°, and the feet stay planted where they were in the raised beat, turned to stay flat (checked: pelvis exactly at the editor's, feet within about 2 cm, head within 1 cm). The hand and hair brush reactions are unchanged. The report's other sections (hair brush and paddle with Kiko disciplining Aya) repeat the previous report; see the open item above.
- **Disciplinarian over the case, paddle on contact (12:16 report):** the upper back twists 36° toward the subject (`IMPLEMENTS.paddle.giverCase`, with the left collar lowered), the look is trimmed back (`CASE_PADDLE_GAZE`), and the resting left hand holds its place while the subject's hips move forward under it (`CASE_BUCK.leftHand` is the small lift and pull toward the disciplinarian as set). Checked against the report: neck, head, collar and shoulder to the millimetre, the left hand to about 1 mm. The other sections repeat the earlier report (open item: hair brush elbow for a shorter disciplinarian).

## Hands on knees (new position)

- **What it is:** `createDisciplineScene(parent, g, s, { position: 'knees' })`. The subject stands free with straight legs, bent forward at the hips (`KNEES_PITCH` 85°, nearly level) with the legs leaning back 12° so the hips sit behind the feet and the weight stays over them, palms on the front of the knees with the fingers down and loosely curled, elbows out (`KNEES_SUBJECT_BASE`; the hands are placed each frame from the shin joints, so they follow the legs). Struck, the back hollows and the head lifts (`KNEES_SUBJECT_REACT`). There is no case.
- **Disciplinarian:** identical to over the case (`scn.atCase` is true; `scn.atKnees` marks this one): same stance and side, left hand on the small of the back, right hand resting by the near cheek, paddle rest/raised/contact settings. The paddle's buck reaction is not used here (it is leg angles for the case's pose).
- **Checked** (Aya disciplining Kiko): relaxed, contact on both sides with the hand, and the paddle on contact all render cleanly. **First pass:** nothing is tuned in the pose editor yet (pitch, knee bend, the strike height, the disciplinarian's lean for a lower, more rearward target).
- **Viewer:** Position now has Hands on knees.
- **Hands on knees, revised:** legs straight in relaxed and raised, with the extra bend taken at the hips (centre of gravity over the feet). Hand and hair brush: only the head moves when struck (`KNEES_SUBJECT_REACT`). Paddle: a light knee buckle and forward lean (`KNEES_BUCK`: hips 3 cm forward and 4.5 cm down, 6° more lean, scaled by height and reaction), with the ankles held planted by a per-frame leg solve (`kneesBody`). First pass, not pose-editor tuned.
- **Hands on knees, from the 12:46 report:** the stance now matches the edited arm-raised pose for relaxed and raised (`KNEES_STANCE`: pelvis 5.8 cm back and 1.1 cm lower than stood, ankles 6.8 / 9.2 cm closer to the hips; all scaled by height, legs re-solved each frame by `kneesBody`, pelvis and feet within a millimetre of the report). Hand and hair brush on contact: the pelvis comes forward 4.1 cm and up 0.3 cm with the feet planted (`KNEES_CONTACT`), the back hollows a little more (`spine2`), the head moves as before. Paddle on contact: the hip bend reduces by `KNEES_UP` (7°) so the subject comes up, with the pelvis and feet where they were (the old forward lean and drop, `KNEES_BUCK`, is gone). Not applied: the report's relaxed section (asked to ignore) and the paddle section's torso and arm angles (the hands follow the knees and the back curve is the hand's).
- **Hands on knees, from the 12:52 report (now applied and rendered):** `KNEES_UP` raised to 12° (more upward hip bend on paddle contact); the blade's contact roll is 95° (`KNEES_ROLL`); the disciplinarian's contact upper back leans to 17.6° for the hand and hair brush (`KNEES_GIVER_BEAT`). `KNEES_PADDLE_BACK` (the paddle's extra back hollow: spine1 −8.4°, spine2 −18.6°) is wired into the paddle's contact reaction.
- **Hands on knees, swinging hand at rest (12:54 and 12:56 reports):** the empty hand hangs close by the hip, the hair brush hangs at the side with the fingers down, the palm in and the head forward past the thumb, and the paddle hangs a little further back (`KNEES_REST`, `KNEES_PADDLE_REST`: offsets from the shoulder, scaled by height; the hanging hand no longer leans the body). Checked against the reports: the empty hand to 2 mm, the brush's hand and face within 2 cm (face 4 cm low at worst), the paddle's hand and face within 3 cm.
- **Hands on knees, hair brush at rest (13:04 report):** hangs further back with the palm turned more toward the subject (`KNEES_REST.brush`). Checked: elbow within 4 mm, hand within 1.2 cm, face within about 4 cm (a little low and back).
- **Crotch flap when bent over (all clothing states):** bent forward with the legs straight (over the case, hands on knees), a flat flap of crotch skin stood out between the glutes. It was skinning, not clothing or the perineum strip: the skin there was shared between the thighs and the pelvis, so the two hip joints pulled it apart. The band where the pelvis alone carries it (`CROTCH_LO`/`CROTCH_HI` in the skin-weight step) is raised from −0.4 %/2 % to 5 %/9 % of height above the crotch point. Rendered clean on Kiko (shorts on) and Aya (bare). **Not checked:** extreme splits and lunges, where this skin now follows the pelvis more; look at those if the crotch looks webbed.
- **Swinging hand sinking into the cheek (hands on knees, contact):** the palm's press depth is `KNEES_PRESS_DEPTH` (3 mm, 12 mm elsewhere); the bent-over rear is steeper, and the shader's compression made the 12 mm look like clipping. Rendered on the near cheek: the hand now lies on the surface. **Open:** the relaxed swinging hand hangs at the side per the editor and showed no clipping in my renders; what does touch the glute in relaxed is the resting left hand's fingertips on the small of the back.

## Bent over, feet spread (new position)

- **What it is:** `createDisciplineScene(parent, g, s, { position: 'spread' })` (`scn.atSpread`, which also sets `atKnees`). The hands-on-knees pose with the feet wide apart (`SPREAD_ANKLE` 27.5 cm either side of the centre line for a 1.58 m subject, toes turned out 30° left and 20° right) and the palms on the fronts of the thighs, 70% of the way down. The legs are solved in 3D each frame (`spreadLegs`: ankle on its target, knee forward of the hip-to-ankle line, thigh and shin aimed with the least twist, foot flat). The subject's reaction, the paddle's rise and everything else are the hands-on-knees ones.
- **Disciplinarian:** stands wider and back and turns toward the hips (`SPREAD_GIVER_AT`, `SPREAD_YAW` 43°). The report (Kenji with Aya, arm raised with the paddle) put the pelvis at (−35, −69) cm, which is too far for the resting hand to reach the back and for any strike to land, so the placement is pulled in to (−30, −52) cm; the 43° turn is the report's. Rendered with Aya disciplining Kiko: relaxed, and contact on both sides with the hand reach the back and cheeks.
- **Not applied from the report:** the disciplinarian's arm-raised arm and legs (a raised paddle arm well behind the head), and the subject's arm angles (the hands follow the thighs instead). First pass, not pose-editor tuned; the hair brush and paddle haven't been rendered here.
- **Viewer:** Position has Bent over, feet spread.
- **Spread feet: paddle only, and the relaxed stance (13:59 report, Aya with Rin):** the position is offered only to dual-strike implements (`IMPLEMENTS.dual`, the paddle for now; any other implement falls back to the paddle, and the viewer disables the other buttons there and switches to the paddle). The report's relaxed disciplinarian is applied to every beat until arm raised and contact are edited: pelvis at (−4.5, −64.3) cm turned 33° back from the 43° the figure stands at (`SPREAD_GIVER_AT`, `SPREAD_YAW`, `SPREAD_GIVER_STANCE`), the upper back and feet as set, the left hand hanging by the hip (`SPREAD_HANG_L`) and the paddle hanging behind (`SPREAD_PADDLE_REST`). Checked against the report: pelvis, feet, right hand, elbow and blade face within 1 cm, the left hand and elbow within 5 mm. **Raised and contact:** the stance stays put but the strike and the resting left hand at 64 cm from the subject may not reach; they wait for the edits.
- **Spread feet, left hand on their own hip (all beats):** the disciplinarian's left hand lies on the curve of their left hip in relaxed, raised and contact, heel at the top, fingers down and a little forward round it (`scn.hipL`: a skinned point on the side of the pelvis just below the waist, found once in rest space; `hipSelf`; the fingers wrap the hip's own skin). This replaces the earlier hanging hand (`SPREAD_HANG_L`, now unused) and the resting hand on the subject's back; no press is applied to the subject. Rendered in all three beats with Aya and Rin.
- **Spread feet, contact (14:16 report, Aya with Kiko):** the disciplinarian's contact leans the upper body further forward (`SPREAD_CONTACT_BACK`: spine1 [28.9, −9.3, −11.4]). Checked against the report: spine, neck and head to the millimetre, the elbow within 1 cm, the hand within 1.5 cm, the blade's face within 1.5 cm.

## The rod (second dual-site implement)

- **What it is:** `IMPLEMENTS.rod` (`dual`, `stripe`): a 22 mm round bar (the hair brush handle's thickness), 34.5 cm beyond the grip against the paddle's 28 cm blade, built by `buildPaddle(g, true)` with `ROD` so it shares the paddle's grip, thumb fit, wide-implement fit, rest/raised/contact placement and press (a 4 cm strip). Offered where dual implements are (spread feet); the viewer gets a Rod button and a sharper sound.
- **Contact site:** random along the full height of the glutes, redrawn on every lift (`scn.rodT`, 0 at the fold to 7 at the top of the strip, interpolated between strip points). The bar lies along the skin there, its face the sites' mean normal.
- **Colour:** no scaling and no spreading. Each landed contact adds a stripe across both cheeks at that height (`addStripe`, rest space through the pelvis, so it stays put as the body moves): +25% of full colour (`STRIPE_ADD`) where it touched, `STRIPE_HALF` wide, drawn in the skin shader after the marks (`uStripe*`), up to 16 kept, fading with time and per move like the marks. Two on one line add up. Rod strikes don't build the hand/paddle colour.
- **Checked** (Aya with Rin, shorts and briefs down): six strikes landed at varied heights and left separate pale-red stripes. **Not checked:** the stripe's width and strength by eye at close range, and the stripe on other body types.
- **Rod colour:** pale cane (0xc99a5b) rather than dark wood, which vanished against the dark scene.
- **Rod, revised:** 14 mm thick (`ROD`). Strike heights run from a quarter of the glute's height down the thigh below the fold to a quarter of the way down from the top of the glute (`ROD_REACH`; new `rodL`/`rodR` anchor strips, 12 points, skinned by the thigh below the fold); 70% of rolls land in the upper half (`ROD_UPPER`, `rodRoll`). Stripes colour only where the bar touched: at the strike's height, across the bar's own length (`x0`/`x1` in rest space), not the cleft it bridges, behind the body only. Each adds 15% (`STRIPE_ADD`, up to 32 kept); overlapping stripes add, going from red toward purple as they deepen (shader, `stripeCol`). Rendered: 14 strikes, mostly high, stripes red to purple on the upper cheek and thigh. Not checked: the cleft mask width and the stripe ends up close.
- **Rod, third pass:** 10 mm thick and 43 cm long (`ROD`). Stripes are 7 mm wide (a little under the bar, `STRIPE_HALF`), only on skin facing straight back (`vRestN`, new rest-space normal varying), so they sit on the very tops and backs of the glutes and thighs and don't wrap round the sides. Colour deepens within red rather than to purple (`stripeCol`; the hand and paddle marks are unchanged). Only the latest 6 stripes (`STRIPES_FRESH`) keep the marks' slow fading; older ones drop to 2% per second and are removed (`STRIPE_GONE_PER_SEC`). Checked: 9 strikes left 9 stripes, 3 flagged old; after 2 s only the latest 6 remained.
- **Rod contact poses (14:49 and 14:54 reports, Kenji with Aya):** the rod now has its own contact settings per position (`ROD_CONTACT`), restored for every other implement. Lap: face rolled to 52.9° (the surface-normal default otherwise); over the case: 82.5°; each with the elbow direction taken from the report (converted to the torso's frame from the edited elbow and the shoulder as it stands, 31 cm in every case, so the figures are consistent). **Hands on head:** the disciplinarian stands at (−24.9, −49.3) cm and strikes at 1° of turn instead of 30° (`at`, `yawStrike`), for every beat; hands on knees: elbow only. Spread feet, arm raised (`ROD_RAISED_SPREAD`): the rod's raised pose (face, normal, axis, elbow out to the side) from the 14:54 report, matched to the millimetre; its contact for the rod in spread wasn't in the reports, so it uses the paddle's. **Reading of the unlabelled reports:** I took the lap, case, hands-on-head and hands-on-knees contacts from the report order and the disciplinarian's start positions (head: pelvis at its (−26.6, −38.6) stand; knees: the case's stance); say if one was another position. Strike height is random, so a single report's hand position can't be matched exactly (the hand lands within about 7 cm).
- **Rod stripes add to other marks (shader):** the stripe's strength is added to whatever mark colour is already there rather than replacing it (`mk = min(1, mk + sadd)`), and the red deepens as the total builds. Not looked at close up over a marked glute.
