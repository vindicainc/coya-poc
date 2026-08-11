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

Running an identical strategy across 250 lives per identity produced a median
net worth of about $212k for the White baseline against about $132k for the
Black one — a 38% gap — and 40 criminal records against 15, from the same
choices.

Two caveats on those figures. Net worth must be measured as cash *minus* debt:
cash is floored at zero and shortfalls are converted to debt, so reading the
money stat alone hides the cost and makes the gap look far smaller than it is.
And the ordering across the middle identities is not cleanly monotonic with the
bias parameters — `native` in particular lands higher than its coefficients
suggest it should. The record counts track their parameters well; the wealth
medians are noisier than a single run makes them look.
