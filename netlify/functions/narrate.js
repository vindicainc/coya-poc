// netlify/functions/narrate.js
//
// Writes one short scene describing an outcome the ENGINE has already decided.
//
// ─────────────────────────────────────────────────────────────────────────────
// SECURITY NOTE — read before changing the signature.
//
// This endpoint replaces an earlier one that took `userInput` from the request
// body and passed it straight to the model. That made it a free, unauthenticated
// LLM for anyone who found the URL, billed to a key shared with production
// systems. It sat live for about eleven months.
//
// The rule that prevents a repeat: THE CALLER NEVER SUPPLIES PROMPT TEXT.
// The body carries structured game state only, every field is validated against
// a closed set of allowed values, and the prompt is assembled here. A caller who
// posts prose gets a 400 — there is no field for it to land in. That property
// is what makes the endpoint safe to expose, so keep it if you extend this.
// ─────────────────────────────────────────────────────────────────────────────

const { GoogleGenAI } = require('@google/genai');

// ── Closed vocabularies. Anything outside these is rejected. ────────────────
const KINDS = new Set(['stage_choice', 'childhood', 'year_event']);
const IDENTITIES = new Set(['White', 'Black', 'Hispanic / Latino', 'Asian', 'Native American']);
const JOBS = new Set(['unemployed', 'entry', 'apprentice', 'journeyman', 'service', 'salaried', 'senior', 'gig']);
const EDU = new Set(['cc_enrolled', 'cc_part_time', 'state_university', 'elite_university']);
const CIRC = {
  schoolFunding: new Set(['under', 'moderate', 'well']),
  household: new Set(['low', 'lower_middle', 'middle', 'upper']),
  neighborhood: new Set(['high_stress', 'mixed', 'stable']),
  familySupport: new Set(['none', 'thin', 'solid']),
  healthCoverage: new Set(['uninsured', 'medicaid', 'employer'])
};

// Choice ids the engine can emit. Closed set — no free text reaches the model.
const CHOICES = new Set([
  'college', 'work', 'military', 'nothing',
  'college_elite', 'college_state', 'college_community'
]);

// Human phrasings for the structured values, so the prompt stays readable
// without ever interpolating caller text.
const SAY = {
  schoolFunding: { under: 'an under-resourced school district', moderate: 'a moderately resourced school district', well: 'a well-resourced school district' },
  household: { low: 'a low-income household', lower_middle: 'a lower-middle-income household', middle: 'a middle-income household', upper: 'an upper-income household' },
  neighborhood: { high_stress: 'a heavily policed neighbourhood', mixed: 'a mixed neighbourhood', stable: 'a stable, lightly policed neighbourhood' },
  familySupport: { none: 'no family financial cushion', thin: 'a thin family cushion', solid: 'a solid family cushion' },
  healthCoverage: { uninsured: 'no health coverage', medicaid: 'public health coverage', employer: 'employer health coverage' },
  job: { unemployed: 'no job', entry: 'an entry-level job', apprentice: 'a union apprenticeship', journeyman: 'work as a journeyman tradesman', service: 'military service', salaried: 'a salaried professional job', senior: 'a senior professional job', gig: 'gig and contract work' },
  education: { cc_enrolled: 'community college', cc_part_time: 'community college part-time', state_university: 'a state university', elite_university: 'an elite private university' }
};

// ── Rate limiting (per instance, best-effort) ───────────────────────────────
// Functions scale horizontally so this is not a hard global cap, but it stops
// a single caller hammering one instance. A real cap belongs in a shared store.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, reset: now + WINDOW_MS };
  if (now > rec.reset) { rec.n = 0; rec.reset = now + WINDOW_MS; }
  rec.n++;
  hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();        // crude unbounded-growth guard
  return rec.n > MAX_PER_WINDOW;
}

const bad = (msg) => ({
  statusCode: 400,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: msg })
});

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ip = event.headers['x-nf-client-connection-ip'] ||
             event.headers['client-ip'] || 'unknown';
  if (rateLimited(ip)) {
    return { statusCode: 429, headers: { 'Retry-After': '60' }, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  if (!process.env.GEMINI_API_KEY) {
    // Fail closed and quietly — the client falls back to written templates.
    return { statusCode: 503, body: JSON.stringify({ error: 'AI not configured' }) };
  }

  // ── Parse and validate. Reject anything unexpected. ───────────────────────
  let b;
  try {
    if (!event.body || event.body.length > 2000) return bad('Body missing or too large');
    b = JSON.parse(event.body);
  } catch (e) {
    return bad('Malformed JSON');
  }
  if (typeof b !== 'object' || b === null) return bad('Body must be an object');

  if (!KINDS.has(b.kind)) return bad('Unknown kind');
  if (b.choice !== null && b.choice !== undefined && !CHOICES.has(b.choice)) return bad('Unknown choice');
  if (!IDENTITIES.has(b.identity)) return bad('Unknown identity');
  if (!JOBS.has(b.job)) return bad('Unknown job');
  if (b.education && !EDU.has(b.education)) return bad('Unknown education');

  const age = Number(b.age);
  if (!Number.isInteger(age) || age < 0 || age > 120) return bad('Age out of range');

  const c = b.circumstance;
  if (typeof c !== 'object' || c === null) return bad('Missing circumstance');
  for (const k of Object.keys(CIRC)) {
    if (!CIRC[k].has(c[k])) return bad('Unknown circumstance: ' + k);
  }

  // The one free-text field is the player's own name. It is length-capped and
  // stripped to letters, spaces, apostrophes and hyphens, so it cannot carry
  // instructions into the prompt.
  const name = String(b.name || 'They').replace(/[^\p{L} '’-]/gu, '').slice(0, 24).trim() || 'They';

  // `resolved` is the engine's own outcome sentence. It is matched against the
  // engine's vocabulary rather than trusted: only characters that appear in
  // ordinary prose survive, and it is length-capped.
  const resolved = String(b.resolved || '').replace(/[^\p{L}\p{N} ,.'’—-]/gu, '').slice(0, 300);

  // ── Build the prompt server-side ──────────────────────────────────────────
  const facts = [
    `${name} is ${age}.`,
    `They grew up in ${SAY.household[c.household]} in ${SAY.neighborhood[c.neighborhood]}, attending ${SAY.schoolFunding[c.schoolFunding]}, with ${SAY.familySupport[c.familySupport]} and ${SAY.healthCoverage[c.healthCoverage]}.`,
    `They currently have ${SAY.job[b.job]}.`,
    b.education ? `They have attended ${SAY.education[b.education]}.` : null,
    b.hasRecord === true ? 'They have a criminal record.' : null,
    resolved ? `What just happened: ${resolved}` : null
  ].filter(Boolean).join(' ');

  const system =
    'You write two or three sentences of grounded, specific prose for a life ' +
    'simulation about structural inequality in the United States. ' +
    'RULES: Write about the outcome you are given as something that has already ' +
    'happened — never change it, never introduce a different result, never offer ' +
    'the character a choice. Stay concrete and physical: a room, a bus, a form, a ' +
    'wait. No moralising, no summarising the lesson, no addressing the reader. ' +
    'Do not state statistics or probabilities. Do not mention race explicitly; ' +
    'let the circumstances carry it. Past tense, third person. ' +
    'Never exceed three sentences. Output prose only, no preamble.';

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${system}\n\n---\n${facts}`,
      config: {
        maxOutputTokens: 220,
        temperature: 0.9,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = (response.text || '').trim();
    if (!text) return { statusCode: 502, body: JSON.stringify({ error: 'Empty generation' }) };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ text: text.slice(0, 900) })
    };
  } catch (err) {
    // Never echo the provider error to the client — it can carry key or quota
    // detail. Log it for the function log only.
    console.error('narrate: generation failed:', err && err.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Generation failed' }) };
  }
};
