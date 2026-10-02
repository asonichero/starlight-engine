// The Fairy Shoe — game rules (no rendering). Loaded by fairy-shoe.html, and by Node for tests.
// Residents are adults who chose to come here and may leave at any time (the runaway state).
// There are no cards, decks or hands: every implement, clothing layer and aftercare option is
// always available, and a correction runs live in the scene for as long as the player wants.
// Severity is measured from what actually happened in the scene (see liveSeverity).
(function (root) {
'use strict';

const STATS = ['wilfulness', 'attention', 'resentment', 'satisfaction', 'valued', 'composure'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── Roster (spec §9). Base spreads and graduation thresholds. ─────────────────────────────
const ROSTER = {
  red:        { name: 'Red',        story: "Little Red's Lesson",        sex: 'f', base: [4, 2, 1, 4, 3, 2],
                grad: { wilfulness: ['<=', 2], resentment: ['<=', 1], valued: ['>=', 5], composure: ['>=', 4] } },
  goldilocks: { name: 'Goldilocks', story: 'Just Right',                 sex: 'f', base: [4, 3, 2, 4, 2, 1],
                grad: { wilfulness: ['<=', 3], attention: ['>=', 4], valued: ['>=', 4] } },
  rapunzel:   { name: 'Rapunzel',   story: 'From Braided to Bound',      sex: 'f', base: [2, 5, 4, 2, 1, 3],
                grad: { valued: ['>=', 5] } },
  jack:       { name: 'Jack',       story: 'Climbing Toward Consequence', sex: 'm', base: [6, 3, 1, 5, 4, 2],
                grad: { wilfulness: ['<=', 3] } },
  corren:     { name: 'Corren',     story: 'The Hand That Held Firm',    sex: 'm', base: [2, 4, 1, 4, 3, 1],
                grad: { composure: ['>=', 6] } },
  snowwhite:  { name: 'Snow White', story: 'Reddened',                   sex: 'f', base: [1, 5, 1, 2, 4, 2],
                grad: { composure: ['>=', 5], satisfaction: ['>=', 4] } },
};
const ROSTER_KEYS = Object.keys(ROSTER);
const PRON = {
  f: { Subj: 'she', Poss: 'her', Obj: 'her', Refl: 'herself' },
  m: { Subj: 'he', Poss: 'his', Obj: 'him', Refl: 'himself' },
};

// ── Chores (spec §3, solo only) ───────────────────────────────────────────────────────────
const CHORES = [
  { id: 'washing',   name: 'Washing',               d: 1 }, { id: 'sweeping',  name: 'Sweeping',              d: 1 },
  { id: 'water',     name: 'Fetching Water',        d: 1 }, { id: 'hens',      name: 'Feeding the Hens',      d: 1 },
  { id: 'mending',   name: 'Mending',               d: 2 }, { id: 'cooking',   name: 'Cooking Supper',        d: 2 },
  { id: 'scrubbing', name: 'Scrubbing the Floors',  d: 2 }, { id: 'garden',    name: 'Tending the Garden',    d: 2 },
  { id: 'canning',   name: 'Preserving / Canning',  d: 3 }, { id: 'hearth',    name: 'Chimney & Hearth Care', d: 3 },
];
// Outcome bands by effective Attention. Each row: [well, completed, partial] lower bounds.
const CHORE_BANDS = { 1: [5, 3, 2], 2: [6, 4, 2], 3: [7, 5, 3] };
function choreBand(d, eff) {
  const [well, done, partial] = CHORE_BANDS[d];
  return eff >= well ? 'well' : eff >= done ? 'completed' : eff >= partial ? 'partial' : 'failed';
}

// ── Effective Attention (spec §3) ─────────────────────────────────────────────────────────
function effectiveAttention(r) {
  const s = r.stats;
  const pen = Math.floor(
    Math.max(0, s.wilfulness - 5) * 0.5 + Math.max(0, 3 - s.composure) * 0.5 +
    Math.max(0, s.resentment - 5) * 0.4 + Math.max(0, 3 - s.satisfaction) * 0.4 + Math.max(0, 3 - s.valued) * 0.3);
  const bon = Math.floor(
    Math.max(0, s.composure - 5) * 0.5 + Math.max(0, s.satisfaction - 5) * 0.4 + Math.max(0, s.valued - 5) * 0.3);
  const mod = clamp(bon - pen, -3, 2);
  return { eff: clamp(s.attention + mod, 1, 7), mod };
}

// ── The house ─────────────────────────────────────────────────────────────────────────────
// opts.rng: () => [0,1). All randomness goes through it so tests can seed it.
function createHouse(opts = {}) {
  const rng = opts.rng || Math.random;
  const H = {
    rng, day: 0, residents: [], pool: [], collection: [], log: [], rapport: {}, pendingGrads: [],
  };
  const pick = a => a[Math.floor(rng() * a.length)];
  H.pick = pick;
  const fresh = key => ({ key, ...ROSTER[key], stats: Object.fromEntries(STATS.map((st, i) => [st, ROSTER[key].base[i]])),
    carry: { wilfulness: 0, satisfaction: 0 }, graduated: false, home: true });
  H.fresh = fresh;
  H.pool = shuffle(ROSTER_KEYS.slice(), rng);
  const pairKey = (a, b) => [a, b].sort().join('|');
  H.getRapport = (a, b) => H.rapport[pairKey(a.key, b.key)] ?? 4;
  H.addRapport = (a, b, d) => { H.rapport[pairKey(a.key, b.key)] = clamp(H.getRapport(a, b) + d, 1, 7); };
  H.log_ = m => H.log.push({ day: H.day, text: m });

  // Every stat change goes through here, so graduation is checked wherever a change originates.
  H.bump = (r, stat, d, why) => {
    if (!d || r.graduated) return 0;
    const before = r.stats[stat];
    r.stats[stat] = clamp(before + d, 1, 7);
    H.checkGraduation(r);
    return r.stats[stat] - before;
  };
  // Fractional deltas with a carry (Corren's halved Wilfulness, Snow White's slow Satisfaction).
  H.bumpCarry = (r, stat, d, factor) => {
    r.carry[stat] += d * factor;
    const whole = Math.trunc(r.carry[stat]);
    r.carry[stat] -= whole;
    return H.bump(r, stat, whole);
  };
  H.meetsGrad = r => Object.entries(r.grad).every(([st, [op, v]]) => op === '>=' ? r.stats[st] >= v : r.stats[st] <= v);
  H.checkGraduation = r => {
    if (r.graduated || !H.meetsGrad(r)) return false;
    r.graduated = true;
    if (!H.collection.includes(r.key)) H.collection.push(r.key);
    H.pendingGrads.push(r);
    H.log_(`${r.name} has graduated.`);
    return true;
  };
  // Residents who graduated since the last call (removed from the table), for announcing.
  H.takeGraduates = () => {
    const out = H.pendingGrads.splice(0);
    H.residents = H.residents.filter(r => !out.includes(r));
    out.forEach(r => { r.home = false; H.away = (H.away || []).concat(r.key); });
    return out;
  };
  H.atTable = () => H.residents.filter(r => !r.graduated);

  // ── Backfill (spec §1): unseen pool first, then graduates cycle back in, reset. ──
  H.backfill = (n = 3) => {
    const arrived = [];
    while (H.residents.length < n) {
      let key = H.pool.shift();
      if (!key) {
        const away = (H.away || []).filter(k => !H.residents.some(r => r.key === k));
        if (!away.length) break;
        key = away[Math.floor(rng() * away.length)];
      }
      H.away = (H.away || []).filter(k => k !== key);
      const r = fresh(key);
      H.residents.push(r); arrived.push(r);
    }
    return arrived;
  };

  // ── Morning ──
  H.dealChores = () => {
    const pool = shuffle(CHORES.slice(), rng);
    return H.residents.map((_, i) => ({ ...pool[i], slot: null }));
  };

  // ── Day resolution (spec §4, §8): chores → graduation → events → graduation → behaviour ──
  // `assign`: array of {resident, chore}.
  H.resolveDay = assign => {
    H.day++;
    const result = { chores: [], events: [], graduates: [], cards: [] };
    for (const { resident: r, chore } of assign) {
      const { eff, mod } = effectiveAttention(r);
      const band = choreBand(chore.d, eff);
      if (band === 'well') { H.bump(r, 'attention', 1); if (chore.d >= 2) H.bump(r, 'satisfaction', 1); }
      else if (band === 'completed') H.bump(r, 'attention', 1);
      else if (band === 'failed') { H.bump(r, 'satisfaction', -1); H.bump(r, 'attention', -1); }
      result.chores.push({ r, chore, band, eff, mod });
    }
    result.graduates.push(...H.takeGraduates());
    // Event rolls: each resident still here rolls; at most two events, on two different people.
    const rolls = [];
    for (const r of H.residents) {
      const s = r.stats;
      const pct = clamp(5 + (s.wilfulness + s.resentment) * 5 - (s.satisfaction + s.composure) * 3, 5, 70);
      const roll = rng() * 100;
      if (roll < pct) rolls.push({ r, margin: pct - roll });
    }
    rolls.sort((a, b) => b.margin - a.margin);
    for (const { r } of rolls.slice(0, 2)) {
      const ev = H.makeEvent(r);
      result.events.push(ev);
      applyEventEffects(H, ev);
    }
    result.graduates.push(...H.takeGraduates());
    // Behaviour cards: one per resident still here.
    for (const r of H.residents) {
      const c = result.chores.find(x => x.r === r);
      const ev = result.events.find(e => e.r === r);
      result.cards.push(buildBehaviour(H, r, c, ev));
    }
    return result;
  };

  H.makeEvent = r => {
    const s = r.stats, others = H.residents.filter(o => o !== r);
    const w = (x, lo) => 1 + 0.35 * Math.max(0, x - lo);
    const cats = [
      ['petty', 30 * w(s.wilfulness, 3)],
      ['boundary', 20 * w(s.wilfulness, 3)],
      ['friction', others.length ? 20 * w(s.resentment, 3) : 0],
      ['dishonest', 15],
      ['selfneglect', 10 * (1 + 0.5 * Math.max(0, 3 - s.satisfaction) + 0.5 * Math.max(0, 3 - s.composure)) * (r.key === 'rapunzel' ? 2.5 : 1)],
      ['cruelty', s.resentment >= 5 && others.length ? 5 * (s.resentment - 4) : 0],
    ];
    const total = cats.reduce((a, c) => a + c[1], 0);
    let x = rng() * total, cat = 'petty';
    for (const [k, v] of cats) { if ((x -= v) < 0) { cat = k; break; } }
    let second = null;
    if (cat === 'friction' || cat === 'cruelty') {
      let low = Infinity, cand = [];
      for (const o of others) { const p = H.getRapport(r, o); if (p < low) { low = p; cand = [o]; } else if (p === low) cand.push(o); }
      second = pick(cand);
    }
    const tpl = pick(TEMPLATES[cat]);
    const text = fill(tpl.t, r, second);
    return { r, cat, second, text, trap: !!tpl.trap };
  };
  return H;
}

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function fill(t, r, second) {
  const P = PRON[r.sex];
  return t.replace(/\{(\w+)\}/g, (_, k) => k === 'Name' ? r.name : k === 'Second' ? second.name : P[k]);
}

// On-reveal effects (spec §4), applied before any correction.
function applyEventEffects(H, { r, cat, second }) {
  if (cat === 'boundary') H.bump(r, 'wilfulness', 1);
  else if (cat === 'friction') { H.bump(r, 'resentment', 1); H.bump(second, 'resentment', 1); H.addRapport(r, second, -1); }
  else if (cat === 'dishonest') H.bump(r, 'valued', -1);
  else if (cat === 'selfneglect') { H.bump(r, 'satisfaction', -1); H.bump(r, 'composure', -1); }
  else if (cat === 'cruelty') { H.bump(second, 'resentment', 1); H.bump(r, 'valued', -1); }
}

// ── Behaviour Cards (spec §5): the evening's read-only note on a resident ─────────────────
const CHORE_LINES = {
  well: n => `${n.Name} did ${n.chore} beautifully — better than it needed to be.`,
  completed: n => `${n.Name} got through ${n.chore} without fuss.`,
  partial: n => `${n.Name} made a start on ${n.chore}, but it wasn't finished properly.`,
  failed: n => `${n.Name}'s attempt at ${n.chore} went badly wrong, and it shows.`,
};
const EVENT_MOD = { petty: 0, boundary: 1, friction: 1, dishonest: 1, selfneglect: 0, cruelty: 2 };
function buildBehaviour(H, r, c, ev) {
  const lines = [];
  const trouble = c && (c.band === 'partial' || c.band === 'failed');
  if (c) lines.push({ kind: 'chore', band: c.band, text: CHORE_LINES[c.band]({ Name: r.name, chore: c.chore.name.toLowerCase() }) });
  if (ev) {
    // Chore text first when it's trouble, else the event alone (spec §5 table).
    if (!trouble) lines.length = 0;
    lines.push({ kind: 'event', cat: ev.cat, text: ev.text, trap: ev.trap });
  }
  let mod = 0;
  if (ev) mod = EVENT_MOD[ev.cat] + (trouble ? 1 : 0);
  else if (trouble) mod = 1;
  return { r, lines, mod: Math.min(2, mod), chore: c, event: ev };
}

// ── Correction: live severity and banded match (spec §7, reworked for the sandbox) ───────
// Everything a correction can use is always available. What counts is what happens in the
// scene: each smack records the implement, clothing layer and force it was delivered with.
const IMPLEMENTS = { hand: { label: 'Hand', sev: 0 }, hairbrush: { label: 'Hairbrush', sev: 1 }, paddle: { label: 'Paddle', sev: 2 } };
const LAYERS = { over: { label: 'Over clothes', sev: -1 }, bottoms: { label: 'Bottoms down', sev: 0 }, briefs: { label: 'Briefs down', sev: 1 } };
const FORCES = [{ v: -2, label: 'Go easy' }, { v: -1, label: 'Lighter' }, { v: 0, label: 'Steady' }, { v: 1, label: 'Firmer' }, { v: 2, label: 'No mercy' }];
const BASE_SEVERITY = 2;
const lengthMod = n => n <= 6 ? -1 : n <= 14 ? 0 : n <= 24 ? 1 : 2;
// `swats`: [{ implement, layer, force }]. Returns the breakdown and the total.
function liveSeverity(swats) {
  const n = swats.length;
  if (!n) return { total: BASE_SEVERITY, n: 0, implement: 0, layer: 0, force: 0, length: 0 };
  const mean = f => Math.round(swats.reduce((a, s) => a + f(s), 0) / n);
  const implement = mean(s => IMPLEMENTS[s.implement].sev), layer = mean(s => LAYERS[s.layer].sev), force = mean(s => s.force);
  const length = lengthMod(n);
  return { total: BASE_SEVERITY + implement + layer + force + length, n, implement, layer, force, length };
}
const BAND_NAMES = ['Minimal', 'Light', 'Moderate', 'Firm', 'Severe'];
const bandOf = t => t <= 0 ? 0 : t === 1 ? 1 : t <= 3 ? 2 : t <= 6 ? 3 : 4;
const expectedBand = (wilfulness, mod) => clamp((wilfulness <= 1 ? 0 : wilfulness <= 3 ? 1 : wilfulness <= 5 ? 2 : 3) + mod, 0, 4);
const MATCH = {
  '0': { name: 'Well-matched' }, '-1': { name: 'Undershoot' }, '-2': { name: 'Undershoot by 2+' },
  '1': { name: 'Overshoot' }, '2': { name: 'Overshoot by 2+' },
};
function matchOf(total, wilfulness, mod) {
  const d = bandOf(total) - expectedBand(wilfulness, mod);
  const k = d === 0 ? 0 : d < 0 ? Math.max(d, -2) : Math.min(d, 2);
  return { diff: d, kind: k, name: MATCH[String(k)].name, got: BAND_NAMES[bandOf(total)], want: BAND_NAMES[expectedBand(wilfulness, mod)] };
}
const AFTERCARE = { corner: 'Corner Time', lines: 'Lines', heldafter: 'Held After', warm: 'Warm Words' };
const REPRIEVES = { stern: 'A Stern Word', kind: 'A Kind Word', reflect: 'Written Reflection' };

// Applies a finished correction. `after`: array of AFTERCARE keys. Returns a snapshot for the result
// screen (read it rather than looking the resident up: they may graduate as a result).
function applyCorrection(H, r, mod, swats, after = []) {
  const sev = liveSeverity(swats), m = matchOf(sev.total, r.stats.wilfulness, mod);
  const snap = { name: r.name, key: r.key, kind: 'correction', sev, match: m, before: { ...r.stats }, after: [], graduated: false };
  const wf = r.key === 'corren' ? 0.5 : 1;   // severity barely registers for Corren
  const W = (d) => H.bumpCarry(r, 'wilfulness', d, wf);
  const v = r.stats.valued;
  switch (m.kind) {
    case 0: W(v >= 5 ? -2 : -1); H.bump(r, 'resentment', v <= 3 ? 1 : -1); H.bump(r, 'valued', 1); break;
    case 1: W(-1); H.bump(r, 'resentment', 1); break;
    case 2: H.bump(r, 'resentment', 2); H.bump(r, 'valued', -1); break;
    case -2: H.bump(r, 'composure', -1); break;
  }
  for (const a of after) {
    if (a === 'corner') { H.bump(r, 'composure', 1); if (r.stats.valued <= 3) H.bump(r, 'resentment', 1); }
    else if (a === 'lines') { H.bump(r, 'composure', 1); H.bump(r, 'attention', 1); }
    else if (a === 'heldafter') { H.bump(r, 'valued', 1); H.bump(r, 'resentment', -1); }
    else if (a === 'warm') { H.bump(r, 'valued', 1); snap.after.push('warm'); H.bumpCarry(r, 'satisfaction', 1, r.key === 'snowwhite' ? 0.5 : 1); }
  }
  snap.after = after.slice();
  snap.now = { ...r.stats };
  snap.graduated = r.graduated;
  return snap;
}
function applyReprieve(H, r, kind) {
  const snap = { name: r.name, key: r.key, kind: 'reprieve', card: REPRIEVES[kind], before: { ...r.stats }, graduated: false };
  const goldiPenalty = r.key === 'goldilocks' && r.stats.valued < 4 && r.stats.wilfulness >= 4;   // reads as no consequence
  if (kind === 'stern') H.bump(r, 'wilfulness', -1);
  else if (kind === 'kind') { H.bump(r, 'valued', 1); H.bumpCarry(r, 'satisfaction', 1, r.key === 'snowwhite' ? 0.5 : 1); }
  else if (kind === 'reflect') { H.bump(r, 'composure', 1); H.bump(r, 'wilfulness', -1); }
  if (goldiPenalty) H.bump(r, 'resentment', 1);
  snap.now = { ...r.stats }; snap.graduated = r.graduated;
  return snap;
}

// Runaways resolve at the day boundary: Resentment 7 and Valued ≤ 2. Returns who left.
function resolveRunaways(H) {
  const gone = H.residents.filter(r => r.stats.resentment >= 7 && r.stats.valued <= 2);
  for (const r of gone) { H.residents.splice(H.residents.indexOf(r), 1); H.pool.push(r.key); }
  return gone;
}

// ── Event templates (spec §10), adjusted so they read as adults sharing a household ───────
const T = (t, trap) => ({ t, trap });
const TEMPLATES = {
  petty: [
    T("{Name} left a frog in someone's boot by the door. {Subj} isn't saying whose. {Subj} is very pleased about it."),
    T("{Name} 'lost' the mending needle rather than finish {Poss} sewing. It was in {Poss} pocket the whole time."),
    T("{Name} ate the last of the honey cake that was meant to be shared, and left the crumbs as the only evidence."),
    T("{Name} swapped the salt and the sugar in the kitchen jars, just to see what would happen at breakfast."),
    T("{Name} was asked to fetch water twice. Both times {Subj} came back with a very good reason why {Subj} hadn't."),
    T("{Name} hid in the hayloft during chore assignment and let everyone assume {Subj} had already left for the well."),
    T("{Name} drew a rather unflattering caricature of the Keeper on the fogged-up window and left it there."),
    T("{Name} answered every single question at supper with a riddle instead of an answer, and thought it was very funny."),
    T("{Name} 'accidentally' let the cat into the pantry. There is now cat in the butter."),
    T("{Name} rearranged everyone's boots by the door, left to right, just to watch the confusion."),
  ],
  boundary: [
    T("{Name} was told not to go past the garden wall. {Subj} went anyway, and came back with berries picked past it — sweetly, as if that settled it."),
    T("{Name} was asked to leave the Keeper's good coat alone. {Subj} wore it anyway, for 'just a minute,' which became most of the afternoon."),
    T("{Name} agreed to be in before the last lamp. {Subj} came back well after dark, unbothered, whistling."),
    T("{Name} was asked to knock before entering the study. {Subj} didn't. Twice."),
    T("{Name} was told the locked cupboard was not to be touched. {Subj} found a way in anyway and left it in a state."),
    T("{Name} was asked to stay until the house meeting finished. {Subj} got up halfway through and simply left."),
    T("{Name} was told the pudding was for after chores were done. {Subj} took it first and did the chores after, if at all."),
    T("{Name} agreed not to walk the forest road alone after dark. {Subj} did, and came back with leaves in {Poss} hair and no apology in mind."),
  ],
  friction: [
    T("{Name} took {Second}'s comb without asking, and broke it. {Subj} hasn't said anything about it."),
    T("{Name} snapped at {Second} over nothing at supper. Later {Subj} wouldn't say why."),
    T("{Name} and {Second} haven't spoken since yesterday. Neither will explain what happened."),
    T("{Name} took the last of the warm water before {Second} could have a turn, and didn't seem to notice or care."),
    T("{Name} said something sharp to {Second} in front of everyone. {Second} went quiet for the rest of the evening."),
    T("{Name} blamed {Second} for a chore {Subj} hadn't finished {Refl}. {Second} didn't argue, but didn't forget it either."),
    T("{Name} wouldn't sit near {Second} at supper, and moved {Poss} chair rather loudly to make the point."),
    T("{Name} read something of {Second}'s that wasn't meant to be read, and won't say what it was."),
  ],
  dishonest: [
    T("{Name} told two different stories about where the missing coin went, and neither one quite matched."),
    T("{Name} said {Subj} was fine. {Subj} was not fine — {Subj}'d been crying in the stairwell for the better part of an hour.", true),
    T("{Name} claimed {Subj} hadn't heard the call for supper. {Subj} was standing close enough to have heard it twice."),
    T("{Name} has been quietly slipping food into {Poss} pocket at meals, and won't say why, or where it's going.", true),
    T("{Name} said the broken jug wasn't {Poss} doing. The evidence rather strongly suggests otherwise."),
    T("{Name} has been saying {Subj}'s sleeping fine. {Subj} is not sleeping fine. The candle in {Poss} room burns very late.", true),
  ],
  selfneglect: [
    T("{Name} hasn't touched {Poss} supper in two days. When asked, {Subj} just shrugged."),
    T("{Name} has stopped singing at {Poss} chores. {Subj} used to sing at everything."),
    T("{Name} keeps the door of {Poss} room shut, even in daylight."),
    T("{Name} sat apart from everyone at breakfast again this morning, and left before anyone could ask why."),
    T("{Name} hasn't laughed in several days, not even at things that would usually get one out of {Obj}."),
    T("{Name} has been going to bed before the candles are even lit, and rising after everyone else has already started the day."),
    T("{Name} flinched when {Subj} thought no one was looking, over something entirely ordinary."),
    T("{Name} has stopped asking questions. {Subj} used to ask about everything."),
  ],
  cruelty: [
    T("{Name} told {Second} that nobody would miss {Obj} if {Subj} left. {Subj} said it to be cruel, and knew it."),
    T("{Name} mocked {Second} for still needing a lamp lit to sleep. {Second} didn't answer. {Subj} just went quiet for the rest of the evening."),
    T("{Name} took something small of {Second}'s and broke it in front of {Obj}, on purpose, to see {Poss} face fall."),
    T("{Name} repeated something {Second} had told {Obj} in confidence, loudly, in front of the others."),
    T("{Name} laughed when {Second} made a mistake at chores, and made sure {Second} knew {Subj}'d seen it."),
  ],
};

const API = {
  STATS, ROSTER, ROSTER_KEYS, CHORES, choreBand, effectiveAttention, createHouse,
  IMPLEMENTS, LAYERS, FORCES, BASE_SEVERITY, lengthMod, liveSeverity, BAND_NAMES, bandOf, expectedBand, matchOf,
  AFTERCARE, REPRIEVES, applyCorrection, applyReprieve, resolveRunaways, TEMPLATES,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FairyShoe = API;
})(typeof window !== 'undefined' ? window : globalThis);
