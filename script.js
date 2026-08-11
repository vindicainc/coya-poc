// script.js — simulation engine.
//
// Design rules this file follows:
//   1. Identity never sets a circumstance. It conditions a roll, and the roll
//      is shown to the player alongside the distribution it came from.
//   2. Every biased outcome reports its counterfactual. If a callback rate was
//      multiplied by 0.67, the player is told what the number would have been.
//      The bias is the content, so hiding it in the math defeats the exercise.
//   3. Deterministic and offline. Seeded RNG, no network, no model calls.

(function () {
  'use strict';

  const D = window.GAME_DATA;
  if (!D) throw new Error('GAME_DATA did not load — check that data.js is included before script.js');

  // ── RNG ──────────────────────────────────────────────────────────────────
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = Math.random;
  const roll = () => rng();

  // ── State ────────────────────────────────────────────────────────────────
  let ch = null;
  const SAVE_KEY = 'cyoa.character.v2';

  // ── DOM ──────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const el = {};
  function cacheDom() {
    [
      'creation', 'game', 'feed', 'nameInput', 'identitySelect', 'startBtn',
      'resetBtn', 'ageUpBtn', 'exportBtn', 'actionSheet', 'actionList',
      'sheetTitle', 'closeSheet', 'tabBar', 'statAge', 'statHealth',
      'statWealth', 'statSmarts', 'statAddiction', 'barHealth', 'barSmarts',
      'barAddiction', 'charName', 'charSub', 'conditionsPanel', 'conditionsBody',
      'conditionsBtn', 'closeConditions', 'addictionRow', 'livesCount', 'moreBtn'
    ].forEach((k) => { el[k] = $(k); });
  }

  // ── Feed ─────────────────────────────────────────────────────────────────
  function say(html, kind) {
    const d = document.createElement('div');
    d.className = 'entry ' + (kind || '');
    d.innerHTML = html;
    el.feed.appendChild(d);
    el.feed.scrollTop = el.feed.scrollHeight;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── Weighted sampling over a {key: prob} map ─────────────────────────────
  function sampleDist(dist) {
    const r = roll();
    let cum = 0;
    const keys = Object.keys(dist);
    for (const k of keys) {
      cum += dist[k];
      if (r <= cum) return k;
    }
    return keys[keys.length - 1];
  }

  const pct = (x) => (x * 100).toFixed(0) + '%';

  // ── Character creation ───────────────────────────────────────────────────
  function rollCircumstance(identityKey) {
    const out = {};
    const detail = {};
    for (const track of Object.keys(D.circumstance)) {
      const spec = D.circumstance[track];
      const cond = spec.byIdentity[identityKey] || spec.population;
      const landed = sampleDist(cond);
      out[track] = landed;
      detail[track] = {
        landed,
        conditional: cond[landed],
        population: spec.population[landed]
      };
    }
    return { values: out, detail };
  }

  function effectsFor(track) {
    return D.circumstanceEffects[track][ch.circumstance[track]];
  }

  function createCharacter(name, identityKey) {
    const seed = (Date.now() & 0xffffffff) ^ (identityKey.length * 7919);
    rng = mulberry32(seed);

    const rolled = rollCircumstance(identityKey);
    const hh = D.circumstanceEffects.household[rolled.values.household];

    ch = {
      id: 'char_' + Date.now(),
      seed,
      name,
      identity: identityKey,
      circumstance: rolled.values,
      circumstanceDetail: rolled.detail,
      age: 0,
      monthsPassed: 0,
      health: 100,
      wealth: hh.startWealth,
      debt: 0,
      academicPerformance: 0,
      addiction: 0,
      job: 'unemployed',
      salary: 0,
      yearsEmployed: 0,
      flags: {},
      childhoodDone: false,
      timeline: []
    };
  }

  // ── The conditions panel: the thesis, made legible ───────────────────────
  function renderConditions() {
    const id = D.identities[ch.identity];
    let h = '';

    h += '<h4>What you chose</h4>';
    h += '<p class="dim">Identity does not set your circumstances in this model. It changes how other people treat you.</p>';
    h += '<table class="cond">';
    h += row('Identity', id.label);
    h += biasRow('Callback rate on applications', id.callbackMultiplier);
    h += biasRow('Rate of involuntary police contact', id.stopMultiplier, true);
    h += biasRow('Cost of carrying a record', id.recordPenalty, true);
    h += biasRow('Likelihood of being treated for pain', id.painDiscount);
    h += '</table>';

    h += '<h4>What the world assigned you</h4>';
    h += '<p class="dim">Each of these was rolled from a distribution conditioned on your identity. You did not choose any of it, and neither did anyone in the simulation.</p>';
    h += '<table class="cond">';
    for (const track of Object.keys(D.circumstance)) {
      const spec = D.circumstance[track];
      const det = ch.circumstanceDetail[track];
      const label = spec.levelLabels[det.landed];
      const lift = det.population > 0 ? det.conditional / det.population : 1;
      const liftTxt = lift >= 1.15
        ? `<span class="worse">${lift.toFixed(1)}× the population rate</span>`
        : lift <= 0.87
          ? `<span class="better">${lift.toFixed(1)}× the population rate</span>`
          : `<span class="dim">about the population rate</span>`;
      h += `<tr><td>${esc(spec.label)}</td><td><strong>${esc(label)}</strong><br>
            <small class="dim">${pct(det.conditional)} of people with your identity land here; ${pct(det.population)} of everyone does.</small><br>
            <small>${liftTxt}</small></td></tr>`;
    }
    h += '</table>';

    h += '<h4>What that adds up to right now</h4>';
    h += '<table class="cond">';
    const fs = effectsFor('familySupport');
    const hc = effectsFor('healthCoverage');
    const nb = effectsFor('neighborhood');
    h += row('Share of a financial shock you can absorb', pct(fs.shockAbsorb));
    h += row('Chance someone bails you out', pct(fs.bailoutChance));
    h += row('Medical cost multiplier', hc.medicalCostMultiplier.toFixed(1) + '×');
    h += row('Base police contact per year', pct(nb.stopBase * D.identities[ch.identity].stopMultiplier));
    if (ch.flags.record) h += row('Criminal record', '<span class="worse">on file</span>');
    if (ch.debt > 0) h += row('Debt', '$' + Math.round(ch.debt).toLocaleString());
    h += '</table>';

    h += `<p class="credit-foot">
            <strong>${readLives().toLocaleString()}+</strong> lives lived<br>
            Built by <strong>Patrick Kim</strong> &middot; Governor's Academy, Class of 2027
          </p>`;

    el.conditionsBody.innerHTML = h;

    function row(k, v) { return `<tr><td>${esc(k)}</td><td>${v}</td></tr>`; }
    function biasRow(k, m, higherIsWorse) {
      const neutral = Math.abs(m - 1) < 0.02;
      const bad = higherIsWorse ? m > 1.02 : m < 0.98;
      const cls = neutral ? 'dim' : (bad ? 'worse' : 'better');
      return `<tr><td>${esc(k)}</td><td class="${cls}">${m.toFixed(2)}×</td></tr>`;
    }
  }

  // ── Childhood ────────────────────────────────────────────────────────────
  const PHASES = [
    { label: 'PreK', start: 0, end: 4 },
    { label: 'Elementary', start: 5, end: 10 },
    { label: 'Middle', start: 11, end: 13 },
    { label: 'High', start: 14, end: 17 }
  ];

  function fillTemplate(str, ctx) {
    return (str || '')
      .replace(/\{\{(\w+)\}\}/g, (m, k) => (ctx[k] !== undefined ? ctx[k] : ''))
      .replace(/\s{2,}/g, ' ')   // optional lines leave gaps when empty
      .replace(/\s+\./g, '.')
      .trim();
  }

  // "a well-resourced" vs "an under-resourced"
  function withArticle(phrase) {
    return (/^[aeiou]/i.test(phrase) ? 'an ' : 'a ') + phrase;
  }

  function phaseContext(phase) {
    const sf = D.circumstance.schoolFunding.levelLabels[ch.circumstance.schoolFunding].toLowerCase();
    const sfx = effectsFor('schoolFunding');
    const hhx = effectsFor('household');
    const hcLabel = D.circumstance.healthCoverage.levelLabels[ch.circumstance.healthCoverage].toLowerCase();
    const hhLabel = D.circumstance.household.levelLabels[ch.circumstance.household].toLowerCase();
    const nb = ch.circumstance.neighborhood;

    return {
      name: esc(ch.name),
      household_desc: hhLabel,
      coverage_desc: hcLabel,
      early_care: ch.circumstance.household === 'upper' || ch.circumstance.household === 'middle'
        ? 'a structured preschool program'
        : (roll() < 0.5 ? 'a relative during the day' : 'whatever could be arranged around work schedules'),
      school_quality: withArticle(sf),
      class_size: sfx.classSize,
      counseling: sfx.counseling,
      enrichment: hhx.enrichment,
      teacher_line: roll() < 0.55
        ? 'One teacher takes an interest and it matters more than anything on the curriculum.'
        : 'No one teacher has the bandwidth to notice much.',
      peer_line: roll() < 0.6
        ? 'The peer group is mostly steady.'
        : 'The peer group churns as families move for rent.',
      policing_line: nb === 'high_stress'
        ? 'There is a school resource officer, and discipline referrals go to him.'
        : 'Discipline stays inside the building.',
      ap_line: sfx.apAccess
        ? 'AP and honors courses exist here, and getting into them depends on a referral.'
        : 'There are no AP courses offered at this school, so there is nothing to be referred to.',
      work_line: ch.circumstance.household === 'low' || ch.circumstance.household === 'lower_middle'
        ? 'You work about twenty hours a week, which comes out of homework time.'
        : 'You do not need to work during the school year.',
      hardship_line: ''
    };
  }

  function runChildhood() {
    say(`<strong>${esc(ch.name)}</strong> is born.`, 'beat');

    for (const ph of PHASES) {
      ch.age = ph.start;
      const ctx = phaseContext(ph);

      // Phase-level drift from circumstance
      const sfx = effectsFor('schoolFunding');
      const hhx = effectsFor('household');
      const years = ph.end - ph.start + 1;

      ch.academicPerformance += sfx.academicPerYear * (years / 4);
      ch.wealth += hhx.yearlyDrag * (years / 4);

      // Shock, absorbed or not
      const shockP = 0.12 + (ch.circumstance.household === 'low' ? 0.12 : 0);
      if (roll() < shockP) {
        const absorb = effectsFor('familySupport').shockAbsorb;
        const raw = -900;
        const net = raw * (1 - absorb);
        ch.wealth += net;
        ctx.hardship_line = absorb >= 0.7
          ? 'A financial shock hits the household and is absorbed without anyone under eighteen noticing.'
          : `A financial shock hits the household and it is felt. (${Math.round(net)} to savings; a solid cushion would have absorbed ${pct(0.8)} of it.)`;
        if (absorb < 0.7) ch.academicPerformance -= 1;
      }

      const prose = fillTemplate(D.templates.childhood[ph.label], ctx);
      say(`<span class="age-tag">Age ${ph.start}–${ph.end}</span> ${prose}`, 'beat');
      ch.timeline.push({ phase: ph.label, summary: prose.slice(0, 160) });
      renderStats();
    }

    ch.age = 18;
    ch.childhoodDone = true;
    say('You turn eighteen. Everything above is now simply your record, and nobody who reads it will see any of the context.', 'beat major');
    renderStats();
    openStage(18);
    save();
  }

  // ── Life stages ──────────────────────────────────────────────────────────
  // A gate returns { open: true } or { open: false, why: "..." }. The "why" is
  // shown on the locked option — a closed door with a stated reason carries the
  // argument better than an option that simply isn't there.

  const STAGE_GATES = {
    always: () => ({ open: true }),

    militaryEligible() {
      if (ch.flags.record) {
        return { open: false, why: 'a criminal record disqualifies you at the recruiter' };
      }
      if (ch.health < 45) {
        return { open: false, why: 'you would not pass the medical screening' };
      }
      return { open: true };
    },

    // Elite admission is the genuinely gated one. The AP clause is the sharper
    // barrier and the more accurate one: you cannot be denied a course your
    // school never offered, but the application still reads the absence as you.
    eliteEligible() {
      const ap = ch.academicPerformance;
      if (!effectsFor('schoolFunding').apAccess && ap < 2) {
        return { open: false, why: 'your school offered no AP or honours courses, and the application reads that as you' };
      }
      if (ap < -4) {
        return { open: false, why: `your transcript is not competitive here (${apLabel(ap)})` };
      }
      return { open: true };
    },

    // State universities are broadly accessible. A weak transcript is a
    // headwind on the odds, not a locked door — only the floor is a wall.
    stateEligible() {
      const ap = ch.academicPerformance;
      if (ap < -12) {
        return { open: false, why: `your transcript falls below the admissions floor (${apLabel(ap)})` };
      }
      return { open: true };
    }
  };

  function apLabel(ap) {
    if (ap >= 6) return 'strong transcript';
    if (ap >= 1) return 'solid transcript';
    if (ap >= -6) return 'mixed transcript';
    return 'weak transcript';
  }

  function checkGate(name) {
    if (!name) return { open: true };
    const g = STAGE_GATES[name];
    return g ? g() : { open: true };
  }

  // ── Odds machinery ───────────────────────────────────────────────────────
  // Outcomes are ordered best-first by convention in data.js. A tilt multiplier
  // below 1 shifts mass away from the best outcomes toward the worst.
  function tilt(outcomes, m) {
    const n = outcomes.length;
    if (n < 2 || Math.abs(m - 1) < 0.001) return outcomes.map((o) => o.chance);
    const w = outcomes.map((o, i) => o.chance * Math.pow(m, n - 1 - i));
    const total = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / total);
  }

  // Returns the multiplier applied to an action, plus a human explanation.
  function biasFor(action) {
    const id = D.identities[ch.identity];
    let m = 1;
    const why = [];

    if (action.tags.includes('job') || action.tags.includes('college')) {
      m *= id.callbackMultiplier;
      if (id.callbackMultiplier < 0.99) {
        why.push(`applications screened at ${id.callbackMultiplier.toFixed(2)}×`);
      }
    }
    if (action.tags.includes('health') && id.painDiscount < 0.99) {
      m *= id.painDiscount;
      why.push(`reported symptoms discounted at ${id.painDiscount.toFixed(2)}×`);
    }
    if (ch.flags.record && (action.tags.includes('job') || action.tags.includes('housing'))) {
      const penalty = 1 / id.recordPenalty;
      m *= penalty;
      why.push(`record costs you ${penalty.toFixed(2)}× here (${id.recordPenalty.toFixed(2)}× the penalty applied to a White applicant with the same record)`);
    }
    if (ch.addiction >= 40 && (action.tags.includes('job') || action.tags.includes('college'))) {
      m *= 0.85;
      why.push('substance use is affecting reliability');
    }

    // Circumstance mods declared on the action
    const mods = action.mods || {};
    if (mods.schoolFunding) {
      const lvl = ch.circumstance.schoolFunding;
      const b = lvl === 'well' ? 1.12 : lvl === 'moderate' ? 1.0 : 0.88;
      m *= b;
      if (b !== 1) why.push(`${lvl === 'well' ? 'well' : 'under'}-resourced schooling (${b.toFixed(2)}×)`);
    }
    if (mods.familySupport) {
      const lvl = ch.circumstance.familySupport;
      const b = lvl === 'solid' ? 1.15 : lvl === 'thin' ? 1.0 : 0.88;
      m *= b;
      if (b !== 1) why.push(`family cushion (${b.toFixed(2)}×)`);
    }
    if (mods.coverage) {
      const lvl = ch.circumstance.healthCoverage;
      const b = lvl === 'employer' ? 1.15 : lvl === 'medicaid' ? 0.95 : 0.75;
      m *= b;
      why.push(`${D.circumstance.healthCoverage.levelLabels[lvl].toLowerCase()} (${b.toFixed(2)}×)`);
    }
    if (mods.academicPerformance) {
      const b = 1 + Math.max(-0.2, Math.min(0.25, ch.academicPerformance / 60));
      m *= b;
    }
    if (mods.hiring && ch.flags.record) {
      m *= 0.8;
    }

    return { m, why };
  }

  function pickOutcome(outcomes, weights) {
    const r = roll();
    let cum = 0;
    for (let i = 0; i < outcomes.length; i++) {
      cum += weights[i];
      if (r <= cum) return i;
    }
    return outcomes.length - 1;
  }

  // ── Eligibility ──────────────────────────────────────────────────────────
  function parseFlag(spec) {
    const idx = spec.indexOf(':');
    if (idx === -1) return [spec, true];
    const k = spec.slice(0, idx);
    const v = spec.slice(idx + 1);
    return [k, v === 'true' ? true : v === 'false' ? false : v];
  }

  function eligible(a) {
    const r = a.requires || {};
    if (r.age_min !== undefined && ch.age < r.age_min) return false;
    if (r.age_max !== undefined && ch.age > r.age_max) return false;
    if (r.wealth_min !== undefined && ch.wealth < r.wealth_min) return false;
    if (r.addiction_min !== undefined && ch.addiction < r.addiction_min) return false;
    if (r.apAccess !== undefined && effectsFor('schoolFunding').apAccess !== r.apAccess) return false;
    if (r.job_not && r.job_not.includes(ch.job)) return false;
    if (r.flags_all) for (const s of r.flags_all) { const [k, v] = parseFlag(s); if ((ch.flags[k] ?? null) !== v) return false; }
    if (r.flags_not) for (const s of r.flags_not) { const [k, v] = parseFlag(s); if ((ch.flags[k] ?? null) === v) return false; }
    if (r.flags_any) {
      let ok = false;
      for (const s of r.flags_any) { const [k, v] = parseFlag(s); if ((ch.flags[k] ?? null) === v) { ok = true; break; } }
      if (!ok) return false;
    }
    return true;
  }

  // ── Applying effects ─────────────────────────────────────────────────────
  function setJob(key) {
    const j = D.jobs[key];
    if (!j) return;
    ch.job = key;
    ch.salary = j.salary;
    ch.yearsEmployed = 0;
  }

  function applyEffects(fx) {
    if (!fx) return;
    if (fx.setJob) setJob(fx.setJob);
    if (fx.durationMonths) {
      ch.monthsPassed += fx.durationMonths;
      while (ch.monthsPassed >= 12) { ch.age++; ch.monthsPassed -= 12; }
    }
    if (typeof fx.health === 'number') ch.health = Math.max(0, Math.min(100, ch.health + fx.health));
    if (typeof fx.wealth === 'number') {
      let w = fx.wealth;
      // Medical costs scale with coverage
      if (w < 0 && fx.medical) w *= effectsFor('healthCoverage').medicalCostMultiplier;
      ch.wealth += w;
    }
    if (typeof fx.debt === 'number') ch.debt = Math.max(0, ch.debt + fx.debt);
    if (typeof fx.academicPerformance === 'number') ch.academicPerformance += fx.academicPerformance;
    if (typeof fx.addiction === 'number') ch.addiction = Math.max(0, Math.min(100, ch.addiction + fx.addiction));

    // Anything that would take you below zero is borrowed, not owned.
    if (ch.wealth < 0) {
      ch.debt += Math.round(-ch.wealth);
      ch.wealth = 0;
    }
  }

  function setFlags(obj) {
    if (!obj) return;
    for (const k of Object.keys(obj)) ch.flags[k] = obj[k];
  }

  // ── Taking an action ─────────────────────────────────────────────────────
  function doAction(actionId) {
    const a = D.actions[actionId];
    if (!a) return;
    closeSheet();

    if (a.cost) {
      if (a.cost.wealth) ch.wealth -= a.cost.wealth;
      if (a.cost.health) ch.health -= a.cost.health;
    }

    const { m, why } = biasFor(a);
    const base = a.outcomes.map((o) => o.chance);
    const weights = tilt(a.outcomes, m);
    const idx = pickOutcome(a.outcomes, weights);
    const out = a.outcomes[idx];

    applyEffects(out.effects);
    setFlags(out.flags_set);

    let html = `<span class="age-tag">Age ${ch.age}</span> <strong>${esc(a.label)}</strong><br>${esc(out.text)}`;

    // The counterfactual. This is the point of the exercise.
    if (Math.abs(m - 1) > 0.02) {
      const bestBefore = base[0];
      const bestAfter = weights[0];
      const dir = bestAfter < bestBefore ? 'worse' : 'better';
      html += `<div class="odds ${dir}">Best outcome: <strong>${pct(bestAfter)}</strong>`;
      html += ` &middot; unbiased it would have been <strong>${pct(bestBefore)}</strong>`;
      if (why.length) html += `<br><small>${esc(why.join('; '))}</small>`;
      html += '</div>';
    }

    say(html, 'action');
    ch.timeline.push({ age: ch.age, action: actionId, outcome: out.id, tilt: m });
    renderStats();
    checkDeath();
    save();
  }

  // ── Age up: the BitLife loop ─────────────────────────────────────────────
  function ageUp() {
    if (ch.pendingStage) return;   // a decision is outstanding
    ch.age++;
    say(`<span class="age-tag age-major">Age ${ch.age}</span>`, 'year');

    // Passive drift
    const nb = effectsFor('neighborhood');
    ch.health += nb.healthPerYear;

    // ── The year's ledger ──────────────────────────────────────────────────
    const E = D.economy;
    const livingIndependently = !!ch.flags.housed;

    let earned = 0;
    if (ch.salary > 0) {
      earned = ch.salary;
      ch.yearsEmployed++;
      // annual raise
      const raise = D.jobs[ch.job].raise;
      ch.salary = Math.round(ch.salary * (1 + raise));
    }

    // A dependent with no income is carried by the household; they don't pay
    // a full share. Independence is what makes cost of living bite.
    let col;
    if (livingIndependently) {
      col = E.costOfLivingBase;
    } else if (earned === 0) {
      col = E.costOfLivingDependent;
    } else {
      col = E.costOfLivingAtHome;
    }

    const net = earned - col;
    ch.wealth += net;

    // Money can't go negative — a shortfall is borrowing, and it compounds.
    if (ch.wealth < 0) {
      const shortfall = Math.round(-ch.wealth);
      ch.debt += shortfall;
      ch.wealth = 0;
      say(`You cover a $${shortfall.toLocaleString()} shortfall on credit.`, 'bad');
    }

    if (earned > 0) {
      say(
        `<strong>${esc(D.jobs[ch.job].title)}</strong> &middot; earned $${earned.toLocaleString()}, ` +
        `cost of living $${col.toLocaleString()} &rarr; ` +
        `<strong class="${net >= 0 ? 'better' : 'worse'}">${net >= 0 ? '+' : '−'}$${Math.abs(net).toLocaleString()}</strong>`,
        'minor'
      );
    } else {
      say(`No income this year. Cost of living $${col.toLocaleString()}.`, 'minor');
    }

    // Promotion
    const promo = E.promotion[ch.job];
    if (promo && ch.yearsEmployed >= 2) {
      const needsMet = !promo.needs || promo.needs.some((s) => {
        const [k, v] = parseFlag(s);
        return (ch.flags[k] ?? null) === v;
      });
      if (needsMet) {
        // Promotion is a hiring decision, so identity bias applies here too.
        const id = D.identities[ch.identity];
        const p = promo.chance * id.callbackMultiplier;
        if (roll() < p) {
          const from = D.jobs[ch.job].title;
          setJob(promo.to);
          let m = `<strong>Promoted.</strong> ${esc(from)} &rarr; ${esc(D.jobs[ch.job].title)}, now $${ch.salary.toLocaleString()}.`;
          if (id.callbackMultiplier < 0.99) {
            m += `<div class="odds worse">Promotion chance this year: <strong>${pct(p)}</strong> &middot; unbiased it would have been <strong>${pct(promo.chance)}</strong></div>`;
          }
          say(m, 'action');
        }
      }
    }

    // Layoff
    if (ch.salary > 0) {
      const risk = D.jobs[ch.job].layoffRisk * (ch.flags.record ? 1.4 : 1) * (ch.addiction >= 50 ? 1.5 : 1);
      if (roll() < risk) {
        say(`<strong>Laid off</strong> from ${esc(D.jobs[ch.job].title)}.`, 'bad');
        setJob('unemployed');
      }
    }

    // Debt interest
    if (ch.debt > 0) {
      const interest = Math.round(ch.debt * E.debtInterest);
      ch.debt += interest;
      say(`Debt accrues <strong>$${interest.toLocaleString()}</strong> in interest.`, 'minor');
    }

    // Addiction drag
    if (ch.addiction >= 20) {
      const drain = ch.addiction >= 60 ? -6 : ch.addiction >= 40 ? -3 : -1.5;
      ch.health += drain;
      ch.wealth -= ch.addiction >= 40 ? 900 : 300;
      say(`Substance use costs you health and money this year.`, 'minor');
      if (ch.addiction >= 70 && roll() < 0.08) {
        const cost = Math.round(-2400 * effectsFor('healthCoverage').medicalCostMultiplier);
        ch.health -= 14;
        ch.wealth += cost;
        say(`<strong>Overdose.</strong> You survive it. The bill is $${Math.abs(cost).toLocaleString()}, scaled by your coverage.`, 'bad');
      }
    }

    // Police contact — the one place identity multiplies a rate directly
    const id = D.identities[ch.identity];
    const stopP = Math.min(0.6, nb.stopBase * id.stopMultiplier + (ch.flags.record ? 0.05 : 0));
    if (roll() < stopP) {
      const r = roll();
      if (r < 0.72) {
        ch.health -= 1;
        say(`Stopped and questioned. Released. <span class="odds worse">Annual stop probability for you: ${pct(stopP)} · at the population rate it would be ${pct(Math.min(0.6, nb.stopBase))}</span>`, 'bad');
      } else if (r < 0.94) {
        ch.wealth -= 220;
        say(`Stopped and cited. The fine is $220 and the court date is on a workday.`, 'bad');
      } else {
        ch.health -= 4;
        setFlags({ record: true, charged: true });
        say(`<strong>Arrested.</strong> Charges filed. This will follow you into every application from here.`, 'bad');
      }
    }

    // A random life event
    const evKeys = Object.keys(D.events);
    const totalW = evKeys.reduce((s, k) => s + D.events[k].weight, 0);
    if (roll() < 0.55) {
      let r = roll() * totalW, chosen = evKeys[0];
      for (const k of evKeys) { r -= D.events[k].weight; if (r <= 0) { chosen = k; break; } }
      const ev = D.events[chosen];
      const idx = pickOutcome(ev.outcomes, ev.outcomes.map((o) => o.chance));
      const out = ev.outcomes[idx];

      const fx = Object.assign({}, out.effects);
      let absorbedNote = '';
      if (ev.absorbable && fx.wealth < 0) {
        const absorb = effectsFor('familySupport').shockAbsorb;
        if (absorb > 0) {
          const saved = Math.round(fx.wealth * absorb);
          fx.wealth = fx.wealth - saved;
          absorbedNote = ` <span class="odds better">Your family absorbed $${Math.abs(saved).toLocaleString()} of this.</span>`;
        } else {
          absorbedNote = ` <span class="odds worse">You absorb all of this yourself.</span>`;
        }
      }
      applyEffects(fx);
      setFlags(out.flags_set);
      say(`<strong>${esc(ev.label)}.</strong> ${esc(out.text)}${absorbedNote}`, 'event');
    }

    renderStats();
    checkDeath();

    // A new stage may open at this age
    if (D.stages[ch.age] && ch.health > 0) openStage(ch.age);

    save();
  }

  function checkDeath() {
    if (ch.health <= 0) {
      say(`<strong>${esc(ch.name)} dies at ${ch.age}.</strong>`, 'beat major');
      summarize();
      el.ageUpBtn.disabled = true;
      el.tabBar.classList.add('disabled');
    }
  }

  function summarize() {
    const id = D.identities[ch.identity];
    let h = '<h4>Final</h4><table class="cond">';
    h += `<tr><td>Age</td><td>${ch.age}</td></tr>`;
    h += `<tr><td>Net worth</td><td>$${Math.round(ch.wealth - ch.debt).toLocaleString()}</td></tr>`;
    h += `<tr><td>Education</td><td>${esc(ch.flags.education || 'none')}</td></tr>`;
    h += `<tr><td>Record</td><td>${ch.flags.record ? 'yes' : 'no'}</td></tr>`;
    h += '</table>';
    h += `<p class="dim">You were assigned a ${esc(D.circumstance.schoolFunding.levelLabels[ch.circumstance.schoolFunding].toLowerCase())} school district, a ${esc(D.circumstance.household.levelLabels[ch.circumstance.household].toLowerCase())} household, and ${esc(D.circumstance.familySupport.levelLabels[ch.circumstance.familySupport].toLowerCase())}. Your applications were screened at ${id.callbackMultiplier.toFixed(2)}× throughout.</p>`;
    say(h, 'beat');
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  // Bars scale on the compositor rather than animating width.
  function setBar(node, value0to100) {
    const v = Math.max(0, Math.min(100, value0to100));
    node.style.transform = 'scaleX(' + (v / 100) + ')';
  }

  function renderStats() {
    if (!ch) return;
    el.statAge.textContent = ch.age;
    el.statHealth.textContent = Math.round(ch.health);
    el.statWealth.textContent = '$' + Math.round(ch.wealth).toLocaleString();
    const smarts = Math.max(0, Math.min(100, 50 + ch.academicPerformance * 2));
    el.statSmarts.textContent = Math.round(smarts);
    setBar(el.barHealth, ch.health);
    setBar(el.barSmarts, smarts);

    if (ch.addiction > 0) {
      el.addictionRow.classList.remove('hidden');
      el.statAddiction.textContent = Math.round(ch.addiction);
      setBar(el.barAddiction, ch.addiction);
    } else {
      el.addictionRow.classList.add('hidden');
    }

    el.charName.textContent = ch.name;
    const bits = [D.identities[ch.identity].label];
    if (ch.salary > 0) bits.push(D.jobs[ch.job].title + ' · $' + ch.salary.toLocaleString());
    if (ch.flags.education) bits.push(String(ch.flags.education).replace(/_/g, ' '));
    if (ch.flags.record) bits.push('record');
    if (ch.debt > 0) bits.push('$' + Math.round(ch.debt).toLocaleString() + ' debt');
    el.charSub.textContent = bits.join(' · ');
  }

  // ── Stage decisions ──────────────────────────────────────────────────────
  // Rendered inline in the feed, not in a sheet: this is the main thing being
  // asked, so it should sit in the story rather than behind a menu.

  function openStage(age) {
    const stage = D.stages[age];
    if (!stage) return;
    ch.pendingStage = age;
    ch.pendingExpand = null;
    renderStage();
    save();
  }

  function renderStage() {
    const stage = D.stages[ch.pendingStage];
    if (!stage) return;

    // Never leave two decision cards in the feed
    const old = el.feed.querySelector('.decision');
    if (old) old.remove();

    const card = document.createElement('div');
    card.className = 'decision';

    if (ch.pendingExpand === 'collegeTiers') {
      card.innerHTML =
        `<h3>Which college?</h3>
         <p class="decision-sub">Where you can go was largely decided before you applied.</p>`;
      const list = document.createElement('div');
      list.className = 'decision-options';
      for (const tier of D.collegeTiers) {
        list.appendChild(optionButton({
          label: tier.label,
          blurb: oddsBlurb(tier),
          icon: 'school',
          gate: checkGate(tier.gate),
          onPick: () => resolveCollegeTier(tier.id)
        }));
      }
      card.appendChild(list);
      const back = document.createElement('button');
      back.className = 'decision-back';
      back.textContent = '← Back';
      back.onclick = () => { ch.pendingExpand = null; renderStage(); save(); };
      card.appendChild(back);
    } else {
      card.innerHTML =
        `<h3>${esc(stage.title)}</h3>
         <p class="decision-sub">${esc(stage.prompt)}</p>`;
      const list = document.createElement('div');
      list.className = 'decision-options';
      for (const opt of stage.options) {
        list.appendChild(optionButton({
          label: opt.label,
          blurb: opt.blurb,
          icon: opt.icon,
          gate: checkGate(opt.gate),
          onPick: () => pickStageOption(opt)
        }));
      }
      card.appendChild(list);
    }

    el.feed.appendChild(card);
    el.feed.scrollTop = el.feed.scrollHeight;
    syncLock();
  }

  function optionButton({ label, blurb, icon, gate, onPick }) {
    const b = document.createElement('button');
    b.className = 'decision-option' + (gate.open ? '' : ' locked');
    b.disabled = !gate.open;
    b.innerHTML =
      `<span class="tab-icon" data-icon="${icon || 'age'}"></span>
       <span class="decision-text">
         <strong>${esc(label)}</strong>
         <small>${gate.open ? esc(blurb || '') : esc('Closed — ' + gate.why)}</small>
       </span>`;
    if (gate.open) b.onclick = onPick;
    return b;
  }

  // Best-case odds for a college tier, with the bias applied and stated.
  function oddsBlurb(tier) {
    const pseudo = { tags: ['college'], mods: { academicPerformance: 1, familySupport: 1 } };
    const { m } = biasFor(pseudo);
    const w = tilt(tier.outcomes, m);
    const base = tier.outcomes[0].chance;
    const cost = tier.cost && tier.cost.wealth ? ` · $${tier.cost.wealth} to apply` : '';
    if (Math.abs(m - 1) > 0.02) {
      return `${pct(w[0])} best case (unbiased ${pct(base)})${cost}`;
    }
    return `${pct(base)} best case${cost}`;
  }

  function pickStageOption(opt) {
    if (opt.expands) {
      ch.pendingExpand = opt.expands;
      renderStage();
      save();
      return;
    }
    const r = opt.resolve || {};
    if (r.setJob) setJob(r.setJob);
    if (r.flags) setFlags(r.flags);
    if (typeof r.health === 'number') ch.health += r.health;

    clearStage();
    say(`<span class="age-tag">Age ${ch.age}</span> <strong>${esc(opt.label)}.</strong> ${esc(r.text || '')}`, 'action');
    narrateStage(opt.id, opt.label, r.text || '');
    renderStats();
    save();
  }

  function resolveCollegeTier(tierId) {
    const tier = D.collegeTiers.find((t) => t.id === tierId);
    if (!tier) return;
    if (tier.cost && tier.cost.wealth) ch.wealth -= tier.cost.wealth;

    const pseudo = { tags: ['college'], mods: { academicPerformance: 1, familySupport: 1 } };
    const { m, why } = biasFor(pseudo);
    const base = tier.outcomes.map((o) => o.chance);
    const weights = tilt(tier.outcomes, m);
    const out = tier.outcomes[pickOutcome(tier.outcomes, weights)];

    applyEffects(out.effects);
    setFlags(out.flags_set);

    let html = `<span class="age-tag">Age ${ch.age}</span> <strong>${esc(tier.label)}.</strong> ${esc(out.text)}`;
    if (Math.abs(m - 1) > 0.02) {
      const dir = weights[0] < base[0] ? 'worse' : 'better';
      html += `<div class="odds ${dir}">Best outcome: <strong>${pct(weights[0])}</strong>` +
              ` &middot; unbiased it would have been <strong>${pct(base[0])}</strong>`;
      if (why.length) html += `<br><small>${esc(why.join('; '))}</small>`;
      html += '</div>';
    }

    clearStage();
    say(html, 'action');
    narrateStage('college_' + tierId, tier.label, out.text);
    renderStats();
    save();
  }

  function clearStage() {
    const old = el.feed.querySelector('.decision');
    if (old) old.remove();
    ch.pendingStage = null;
    ch.pendingExpand = null;
    syncLock();
  }

  // Age Up is disabled while a decision is outstanding.
  function syncLock() {
    const locked = !!ch && !!ch.pendingStage;
    el.ageUpBtn.disabled = locked || (ch && ch.health <= 0);
    el.tabBar.classList.toggle('disabled', locked);
    el.ageUpBtn.classList.toggle('waiting', locked);
    const lbl = el.ageUpBtn.querySelector('span:last-child');
    if (lbl) lbl.textContent = locked ? 'Choose above first' : 'Age Up';
  }

  // ── Action sheet ─────────────────────────────────────────────────────────
  const CATEGORIES = [
    { key: 'school', label: 'School' },
    { key: 'work', label: 'Work' },
    { key: 'money', label: 'Money' },
    { key: 'housing', label: 'Housing' },
    { key: 'health', label: 'Health' },
    { key: 'substance', label: 'Substance' },
    { key: 'justice', label: 'Justice' },
    { key: 'network', label: 'People' }
  ];

  function openSheet(catKey) {
    const cat = CATEGORIES.find((c) => c.key === catKey);
    el.sheetTitle.textContent = cat.label;
    const items = Object.entries(D.actions).filter(([, a]) => a.category === catKey);

    el.actionList.innerHTML = '';
    let anyEligible = false;

    for (const [id, a] of items) {
      const ok = eligible(a);
      if (ok) anyEligible = true;
      const b = document.createElement('button');
      b.className = 'action' + (ok ? '' : ' locked');
      b.disabled = !ok;

      let sub = '';
      if (ok) {
        const { m } = biasFor(a);
        if (Math.abs(m - 1) > 0.02) {
          const w = tilt(a.outcomes, m);
          const cls = w[0] < a.outcomes[0].chance ? 'worse' : 'better';
          sub = `<span class="odds-chip ${cls}">${pct(w[0])} best case &middot; ${pct(a.outcomes[0].chance)} unbiased</span>`;
        } else {
          sub = `<span class="odds-chip">${pct(a.outcomes[0].chance)} best case</span>`;
        }
        if (a.cost && a.cost.wealth) sub += `<span class="cost-chip">-$${a.cost.wealth}</span>`;
      } else {
        sub = `<span class="odds-chip dim">${esc(lockReason(a))}</span>`;
      }

      b.innerHTML = `<span class="action-label">${esc(a.label)}</span>${sub}`;
      if (ok) b.onclick = () => doAction(id);
      el.actionList.appendChild(b);
    }

    if (!items.length || !anyEligible) {
      const p = document.createElement('p');
      p.className = 'dim pad';
      p.textContent = 'Nothing available here yet.';
      el.actionList.appendChild(p);
    }

    el.actionSheet.classList.add('open');
  }

  function lockReason(a) {
    const r = a.requires || {};
    if (r.age_min !== undefined && ch.age < r.age_min) return `from age ${r.age_min}`;
    if (r.age_max !== undefined && ch.age > r.age_max) return `no longer available`;
    if (r.wealth_min !== undefined && ch.wealth < r.wealth_min) return `needs $${r.wealth_min.toLocaleString()}`;
    if (r.addiction_min !== undefined && ch.addiction < r.addiction_min) return `not applicable`;
    if (r.apAccess && !effectsFor('schoolFunding').apAccess) return `your school does not offer this`;
    if (r.job_not && r.job_not.includes(ch.job)) return `you already hold this or better`;
    if (r.flags_any) return 'needs schooling, a trade, or service first';
    return 'requirements not met';
  }

  function closeSheet() { el.actionSheet.classList.remove('open'); }

  function buildTabs() {
    el.tabBar.innerHTML = '';
    for (const c of CATEGORIES) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.dataset.cat = c.key;
      b.innerHTML = `<span class="tab-icon" data-icon="${c.key}"></span><span class="tab-label">${c.label}</span>`;
      b.onclick = () => openSheet(c.key);
      el.tabBar.appendChild(b);
    }
  }

  // ── AI narration ─────────────────────────────────────────────────────────
  // The engine has already decided what happened before any of this runs. The
  // model only writes the scene describing a settled outcome — it never picks
  // an outcome, never sees a probability, and never changes a stat. If the call
  // fails, is slow, or is disabled, play continues on the deterministic text.

  const AI_ENDPOINT = '/api/narrate';
  let aiEnabled = true;      // flipped off after repeated failures
  let aiFailures = 0;

  function narrateStage(choiceId, label, resolvedText) {
    narrate({
      kind: 'stage_choice',
      choice: choiceId,
      label,
      resolved: resolvedText
    });
  }

  // Posts STRUCTURED STATE ONLY — never a caller-supplied prompt. The function
  // builds the prompt server-side from these fields.
  async function narrate(payload) {
    if (!aiEnabled) return;

    const slot = document.createElement('div');
    slot.className = 'entry beat ai-pending';
    slot.innerHTML = '<span class="ai-dots"><i></i><i></i><i></i></span>';
    el.feed.appendChild(slot);
    el.feed.scrollTop = el.feed.scrollHeight;

    const body = {
      kind: payload.kind,
      choice: payload.choice || null,
      label: payload.label || null,
      resolved: payload.resolved || null,
      name: ch.name,
      age: ch.age,
      identity: D.identities[ch.identity].label,
      circumstance: {
        schoolFunding: ch.circumstance.schoolFunding,
        household: ch.circumstance.household,
        neighborhood: ch.circumstance.neighborhood,
        familySupport: ch.circumstance.familySupport,
        healthCoverage: ch.circumstance.healthCoverage
      },
      job: ch.job,
      hasRecord: !!ch.flags.record,
      education: ch.flags.education || null
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);

    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.text) throw new Error('empty');

      aiFailures = 0;
      slot.classList.remove('ai-pending');
      slot.classList.add('ai-text');
      slot.innerHTML = esc(data.text);
    } catch (e) {
      clearTimeout(timer);
      slot.remove();                       // fail soft, silently
      if (++aiFailures >= 3) aiEnabled = false;
    } finally {
      el.feed.scrollTop = el.feed.scrollHeight;
    }
  }

  // ── Lives counter ────────────────────────────────────────────────────────
  // Seeded at 200 and incremented per life started.
  //
  // NOTE: this is per-device, not global — it reads and writes localStorage,
  // so two people each see their own count on top of the same seed. Making it
  // genuinely universal needs somewhere shared to keep the number; the two
  // functions below are the only places that would have to change.
  const LIVES_KEY = 'cyoa.lives';
  const LIVES_SEED = 200;

  function readLives() {
    try {
      const n = parseInt(localStorage.getItem(LIVES_KEY) || '0', 10);
      return LIVES_SEED + (Number.isFinite(n) && n > 0 ? n : 0);
    } catch (e) { return LIVES_SEED; }
  }

  function bumpLives() {
    try {
      const n = parseInt(localStorage.getItem(LIVES_KEY) || '0', 10);
      localStorage.setItem(LIVES_KEY, String((Number.isFinite(n) ? n : 0) + 1));
    } catch (e) { /* storage unavailable; the seed still shows */ }
    renderLives();
  }

  function renderLives() {
    if (el.livesCount) el.livesCount.textContent = readLives().toLocaleString() + '+';
  }

  // ── Persistence ──────────────────────────────────────────────────────────
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ch, feed: serializeFeed() }));
    } catch (e) { /* storage unavailable; play continues unsaved */ }
  }

  // Transient UI must not be persisted. An in-flight narration spinner saved
  // mid-request would be restored on reload as a spinner that never resolves,
  // and the decision card is rebuilt from ch.pendingStage rather than markup.
  function serializeFeed() {
    const clone = el.feed.cloneNode(true);
    clone.querySelectorAll('.ai-pending, .decision').forEach((n) => n.remove());
    return clone.innerHTML;
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed.ch) return false;
      ch = parsed.ch;
      rng = mulberry32(ch.seed ^ (ch.timeline.length * 104729));
      el.feed.innerHTML = parsed.feed || '';
      return true;
    } catch (e) { return false; }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function enterGame() {
    el.creation.classList.add('hidden');
    el.game.classList.remove('hidden');
    buildTabs();
    renderStats();
    renderConditions();
    // A decision saved mid-flight is re-rendered rather than lost
    if (ch && ch.pendingStage) renderStage(); else syncLock();
  }

  let booted = false;
  document.addEventListener('DOMContentLoaded', () => {
    if (booted) return;   // a second DOMContentLoaded must not re-init over live state
    booted = true;
    cacheDom();

    // Populate identity picker from data
    el.identitySelect.innerHTML = '';
    for (const [k, v] of Object.entries(D.identities)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = v.label;
      el.identitySelect.appendChild(o);
    }

    renderLives();

    el.startBtn.addEventListener('click', () => {
      const name = (el.nameInput.value || 'Frank').trim();
      createCharacter(name, el.identitySelect.value);
      bumpLives();
      el.feed.innerHTML = '';
      enterGame();
      runChildhood();
    });

    el.resetBtn.addEventListener('click', () => {
      if (confirm('Start over? This erases the current life.')) {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
      }
    });

    el.ageUpBtn.addEventListener('click', ageUp);

    el.moreBtn.addEventListener('click', () => {
      const open = el.tabBar.classList.toggle('collapsed') === false;
      el.moreBtn.setAttribute('aria-expanded', String(open));
    });
    el.closeSheet.addEventListener('click', closeSheet);
    el.actionSheet.addEventListener('click', (e) => { if (e.target === el.actionSheet) closeSheet(); });

    el.conditionsBtn.addEventListener('click', () => {
      renderConditions();
      el.conditionsPanel.classList.add('open');
    });
    el.closeConditions.addEventListener('click', () => el.conditionsPanel.classList.remove('open'));
    el.conditionsPanel.addEventListener('click', (e) => {
      if (e.target === el.conditionsPanel) el.conditionsPanel.classList.remove('open');
    });

    el.exportBtn.addEventListener('click', () => {
      if (!ch) return;
      const blob = new Blob([JSON.stringify(ch, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ch.name.replace(/\s+/g, '_')}_life.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSheet(); el.conditionsPanel.classList.remove('open'); }
    });

    if (load()) { enterGame(); } else { el.creation.classList.remove('hidden'); }
  });
})();
