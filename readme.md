# Choose Your American Adventure

Built by **Patrick Kim** — Governor's Academy, Class of 2027.

A life simulator about which parts of an outcome were chosen and which were
assigned. You create a character, live through childhood, and then play out
adulthood a year at a time — school, work, money, housing, health, substances,
the justice system.

Static site. No build step, no backend, no network calls. Open `index.html`.

---

## The thing that makes it not just a game

Most sims of this kind hand you a "background" dropdown that quietly sets your
stats. That encodes a bad claim: that being a particular kind of person *is*
being poor, or *is* attending an underfunded school.

This one splits the two:

- **Identity is chosen.** It drives only what other people do to you — callback
  rates on applications, rate of involuntary police contact, how much a record
  costs you afterward, whether reported pain is treated.
- **Circumstance is rolled.** School district, household income, neighbourhood,
  family cushion and health coverage are sampled from distributions that are
  *conditioned* on identity, never set by it.

Then it shows you the roll. The conditions panel tells you which cell you landed
in, how often people with your identity land there, and how often everyone does.
An unlucky draw reads as an unlucky draw.

**Every biased roll reports its counterfactual.** When an application is screened
at 0.67×, the game prints both the odds you got and the odds you would have had
without it. Hiding the bias inside the math would defeat the entire exercise.

---

## What the numbers are

**Tuned for play, not estimated.** No figure in `data.js` should be quoted as a
statistic. Coefficients are shaped by the direction and rough magnitude of
published findings — Bertrand & Mullainathan (2004) on callback gaps, Pager
(2003) on the interaction of race and criminal records, EdBuild (2019) on
district funding — and each anchor is named in a comment next to the parameter
it informed.

The limitations are documented at the top of `data.js` and are worth reading
before drawing any conclusion from a playthrough. The short version: every
identity row is an aggregate, the circumstance tracks are modelled as
independent when in reality they arrive together, and nothing here is causal.

---

## Files

| File | What it holds |
|---|---|
| `index.html` | Shell — HUD, event feed, action dock, sheets |
| `style.css` | All styling; icon slots bound via `[data-icon]` |
| `data.js` | Model parameters, distributions, actions, events, prose templates |
| `script.js` | Engine — rolls, odds, ageing loop, rendering |
| `assets/icons/` | 48×48 pixel icons, displayed at 24px (exact 2:1) |
| `assets/icons/raw/` | Unmodified generator output, before contrast lifting |

Icons were generated with PixelLab and then post-processed: the generator was
asked for black outlines, which disappear on a dark panel, so outline pixels are
lifted to a slate tone and each icon is raised until it clears ~3.4:1 against
the panel background. Originals are kept in `raw/` so the step is reversible.

---

## Life stages

Play is not a free-form menu. At a stage age the game stops and asks one
question with a small number of answers, and ageing is blocked until it is
answered. At eighteen there are exactly four: college, a job, the military, or
nothing. Choosing college opens a second card listing the three tiers.

**Closed doors are content.** A tier or path you cannot take still appears, with
the reason stated in the player's own terms — "your school offered no AP or
honours courses, and the application reads that as you" — rather than being
silently absent. Which doors are open is the argument the sim is making, so
hiding the closed ones would throw it away.

Gates live in `STAGE_GATES` in `script.js`. They are deliberately tuned so that
disadvantage is a headwind rather than a wall: state universities are open to
nearly everyone, and elite admission is the gated one. An earlier tuning locked
under-resourced students out of state university entirely, which is both wrong
and worse drama.

## AI narration

The AI writes prose. It does not decide anything.

The engine rolls every outcome and applies every bias multiplier first; the
model is then handed the settled result and asked for two or three sentences
describing it. This keeps the odds display, the counterfactuals and the whole
measurement apparatus true — a probability shown to the player is a probability
that actually ran. If the call fails, times out, or is disabled, play continues
on the written templates and the player sees nothing missing. Three consecutive
failures switch it off for the session.

### The endpoint

`netlify/functions/narrate.js`, exposed at `/api/narrate`.

An earlier version of this project shipped a function that took `userInput` from
the request body and passed it straight to the model. That is a free,
unauthenticated LLM for anyone who finds the URL, billed to whatever key is
configured. It sat live for about eleven months before being removed.

The rule that prevents a repeat: **the caller never supplies prompt text.** The
body carries structured game state, every field is checked against a closed set
of allowed values, and the prompt is assembled inside the function. There is no
field for prose to land in, so a caller cannot steer the model. The player's
name is the one free-text value and is stripped to letters and length-capped.
Also enforced: a 2KB body cap, a per-IP rate limit, capped output tokens, and
provider errors that are logged but never echoed to the client.

If you extend this function, keep that property.

## The lives counter

The creation screen shows a "lives lived" count, seeded at 200 and incremented
each time a life is started.

**It is currently per-device, not universal.** It reads and writes
`localStorage`, so every visitor sees their own count stacked on the same seed —
two people who each start one life will both see 201, not 202. Making it a true
global counter means storing the number somewhere shared. `readLives()` and
`bumpLives()` in `script.js` are the only two functions that would need to
change; the natural fit here is a Netlify Function backed by Netlify Blobs,
since `netlify.toml` already declares a functions directory.

## Model notes

- **Employment persists.** Jobs pay every year and raise annually; promotion is
  a hiring decision, so identity bias applies there too. This matters — a
  one-shot payout would make hiring bias a rounding error, whereas a recurring
  salary lets it compound across a career, which is where the real gap lives.
- **Money cannot go negative.** A shortfall becomes debt, and debt accrues
  interest at 6%.
- **A dependent with no income isn't charged rent.** Cost of living only bites
  once you're living independently.

## Testing

There is no test runner in the repo. The engine was verified by driving the real
DOM under jsdom across several hundred lives per identity, checking for runtime
errors, and by static checks on the data (distributions summing to 1, outcome
weights summing to 1, every required flag reachable, every template placeholder
resolvable, every icon slot bound to a file that exists).

Running an identical strategy — always take the best college tier available —
across 250 lives per identity, ages 18 to 45:

| identity | median net worth | records | degrees |
|---|---|---|---|
| White | $264,711 | 18 | 233 |
| Asian | $202,580 | 19 | 242 |
| Native American | $169,849 | 46 | 220 |
| Hispanic / Latino | $141,620 | 46 | 228 |
| Black | $86,305 | 48 | 222 |

A 67% wealth gap and 2.7× the criminal records, from the same choices. Note
that degrees are nearly flat across identities (220–242) while wealth is not:
everyone got educated, and the gap opened anyway — through admission tier,
then callbacks, then promotions.

Two caveats. Net worth must be measured as cash *minus* debt: cash is floored
at zero and shortfalls become debt, so reading the money stat alone hides the
cost and makes the gap look far smaller than it is. And the ordering across the
middle identities is not perfectly monotonic with the bias parameters — Native
American lands above Hispanic despite slightly worse coefficients. Record
counts track their parameters closely; the wealth medians are noisier than one
run makes them look.
