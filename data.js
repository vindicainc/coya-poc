// data.js — content + model parameters for the life simulator.
// Loaded by index.html before script.js. No network calls; everything here is static.
//
// ─────────────────────────────────────────────────────────────────────────────
// A NOTE ON THE NUMBERS IN THIS FILE
//
// The coefficients below are TUNED FOR PLAY, not estimated from data. They are
// shaped by the direction and rough magnitude of published findings, but no
// number here should be quoted as a statistic. Where a parameter is anchored to
// a real study, the study is named in a comment so the choice is auditable.
//
// The model deliberately separates two different things:
//
//   identities[]     — who you are. Drives ONLY the things other people do to
//                      you: callback rates, stop rates, how a record is treated.
//   circumstance     — where you landed. Rolled from a distribution that is
//                      CONDITIONED on identity, never set by it. The game shows
//                      the player both the roll and the distribution it came
//                      from, so the correlation is visible as a correlation.
//
// The distinction matters: a table that reads `black: { schoolFunding: "mid" }`
// asserts that being Black *is* an underfunded school. A distribution asserts
// that segregation and school-finance policy put people in different places at
// different rates. The second claim is the one this sim is trying to make.
//
// KNOWN LIMITATIONS — read before drawing any conclusion from a playthrough:
//
//   1. Every identity here is an aggregate, and aggregates lie. "Asian" is the
//      worst offender: it pools groups whose poverty rates differ by a factor
//      of several, so its row describes almost nobody. Treat a single row as a
//      coarse average, never as a description of a person.
//   2. The categories themselves are a simplification. Multiracial identity,
//      immigration status, disability, gender and region all move these numbers
//      substantially and none of them are modelled.
//   3. The circumstance tracks are treated as independent draws. In reality
//      school funding, neighbourhood and household wealth are strongly
//      correlated, so this model understates how often disadvantages arrive
//      together — it is, if anything, too kind.
//   4. Nothing here is causal. The sim shows how a stacked set of rates
//      produces a spread in outcomes; it does not estimate any real effect.
// ─────────────────────────────────────────────────────────────────────────────

window.GAME_DATA = {

  // ===========================================================================
  // IDENTITY — chosen by the player. Bias coefficients only.
  // ===========================================================================
  // callbackMultiplier: applied to hiring/application success.
  //   Anchored to Bertrand & Mullainathan (2004), which found résumés with
  //   white-sounding names received about 50% more callbacks than identical
  //   résumés with Black-sounding names. 0.67 is the reciprocal of that gap.
  // stopMultiplier: relative rate of involuntary police contact.
  // recordPenalty: how much more a criminal record costs you afterward.
  //   Direction anchored to Pager (2003), which found a record depressed
  //   callbacks for all applicants and did so substantially more for Black men.
  // painDiscount: likelihood of being undertreated in a medical setting.

  identities: {
    white: {
      label: "White",
      callbackMultiplier: 1.00,
      stopMultiplier: 1.00,
      recordPenalty: 1.00,
      painDiscount: 1.00
    },
    black: {
      label: "Black",
      callbackMultiplier: 0.67,
      stopMultiplier: 1.75,
      recordPenalty: 1.60,
      painDiscount: 0.80
    },
    hispanic: {
      label: "Hispanic / Latino",
      callbackMultiplier: 0.78,
      stopMultiplier: 1.40,
      recordPenalty: 1.35,
      painDiscount: 0.85
    },
    asian: {
      label: "Asian",
      callbackMultiplier: 0.92,
      stopMultiplier: 0.85,
      recordPenalty: 1.10,
      painDiscount: 0.95
    },
    native: {
      label: "Native American",
      callbackMultiplier: 0.80,
      stopMultiplier: 1.55,
      recordPenalty: 1.40,
      painDiscount: 0.82
    }
  },

  // ===========================================================================
  // CIRCUMSTANCE — rolled by the world, conditioned on identity.
  // ===========================================================================
  // Each track lists its levels, the population-wide distribution, and the
  // distribution conditional on identity. Rows sum to 1. The UI shows the
  // player which cell they landed in AND both distributions, so an unlucky
  // roll reads as an unlucky roll rather than as a property of the player.

  circumstance: {

    schoolFunding: {
      label: "School district",
      levels: ["under", "moderate", "well"],
      levelLabels: {
        under: "Under-resourced",
        moderate: "Moderately resourced",
        well: "Well-resourced"
      },
      // Direction anchored to EdBuild (2019), which reported that predominantly
      // nonwhite districts received substantially less funding than white
      // districts serving comparable numbers of students.
      population: { under: 0.22, moderate: 0.45, well: 0.33 },
      byIdentity: {
        white:    { under: 0.12, moderate: 0.42, well: 0.46 },
        black:    { under: 0.43, moderate: 0.41, well: 0.16 },
        hispanic: { under: 0.40, moderate: 0.43, well: 0.17 },
        asian:    { under: 0.17, moderate: 0.43, well: 0.40 },
        native:   { under: 0.48, moderate: 0.38, well: 0.14 }
      }
    },

    household: {
      label: "Household income",
      levels: ["low", "lower_middle", "middle", "upper"],
      levelLabels: {
        low: "Low income",
        lower_middle: "Lower-middle income",
        middle: "Middle income",
        upper: "Upper income"
      },
      population: { low: 0.20, lower_middle: 0.28, middle: 0.34, upper: 0.18 },
      byIdentity: {
        white:    { low: 0.13, lower_middle: 0.24, middle: 0.39, upper: 0.24 },
        black:    { low: 0.33, lower_middle: 0.33, middle: 0.26, upper: 0.08 },
        hispanic: { low: 0.30, lower_middle: 0.34, middle: 0.28, upper: 0.08 },
        asian:    { low: 0.16, lower_middle: 0.22, middle: 0.35, upper: 0.27 },
        native:   { low: 0.36, lower_middle: 0.32, middle: 0.25, upper: 0.07 }
      }
    },

    neighborhood: {
      label: "Neighborhood",
      levels: ["high_stress", "mixed", "stable"],
      levelLabels: {
        high_stress: "High-stress, heavily policed",
        mixed: "Mixed",
        stable: "Stable, lightly policed"
      },
      population: { high_stress: 0.24, mixed: 0.44, stable: 0.32 },
      byIdentity: {
        white:    { high_stress: 0.13, mixed: 0.42, stable: 0.45 },
        black:    { high_stress: 0.45, mixed: 0.40, stable: 0.15 },
        hispanic: { high_stress: 0.39, mixed: 0.44, stable: 0.17 },
        asian:    { high_stress: 0.18, mixed: 0.45, stable: 0.37 },
        native:   { high_stress: 0.44, mixed: 0.40, stable: 0.16 }
      }
    },

    familySupport: {
      label: "Family financial cushion",
      levels: ["none", "thin", "solid"],
      levelLabels: {
        none: "No cushion",
        thin: "Thin cushion",
        solid: "Solid cushion"
      },
      // Direction anchored to the well-documented racial wealth gap: median
      // white household wealth is several times median Black household wealth,
      // which shows up as the ability to absorb one bad month without cascading.
      population: { none: 0.30, thin: 0.40, solid: 0.30 },
      byIdentity: {
        white:    { none: 0.20, thin: 0.38, solid: 0.42 },
        black:    { none: 0.52, thin: 0.36, solid: 0.12 },
        hispanic: { none: 0.48, thin: 0.38, solid: 0.14 },
        asian:    { none: 0.24, thin: 0.38, solid: 0.38 },
        native:   { none: 0.54, thin: 0.34, solid: 0.12 }
      }
    },

    healthCoverage: {
      label: "Health coverage",
      levels: ["uninsured", "medicaid", "employer"],
      levelLabels: {
        uninsured: "Uninsured",
        medicaid: "Medicaid / public",
        employer: "Employer or private"
      },
      population: { uninsured: 0.11, medicaid: 0.26, employer: 0.63 },
      byIdentity: {
        white:    { uninsured: 0.07, medicaid: 0.20, employer: 0.73 },
        black:    { uninsured: 0.13, medicaid: 0.37, employer: 0.50 },
        hispanic: { uninsured: 0.20, medicaid: 0.35, employer: 0.45 },
        asian:    { uninsured: 0.08, medicaid: 0.20, employer: 0.72 },
        native:   { uninsured: 0.22, medicaid: 0.40, employer: 0.38 }
      }
    }
  },

  // Numeric effects of each circumstance level on the simulation.
  // Kept separate from the distributions above so the rolled cell and its
  // consequence can be displayed independently.
  circumstanceEffects: {
    schoolFunding: {
      under:    { academicPerYear: -2, apAccess: false, classSize: "large (28+)",     counseling: "under-resourced" },
      moderate: { academicPerYear:  0, apAccess: true,  classSize: "medium (22-26)",  counseling: "stretched" },
      well:     { academicPerYear: +2, apAccess: true,  classSize: "small (about 18)", counseling: "well-staffed" }
    },
    household: {
      low:          { startWealth:   150, yearlyDrag: -600, enrichment: "few affordable options" },
      lower_middle: { startWealth:   600, yearlyDrag: -250, enrichment: "occasional programs" },
      middle:       { startWealth:  2000, yearlyDrag:    0, enrichment: "school clubs and some lessons" },
      upper:        { startWealth:  6000, yearlyDrag:  +400, enrichment: "private lessons and travel teams" }
    },
    neighborhood: {
      high_stress: { stopBase: 0.11, healthPerYear: -1.5 },
      mixed:       { stopBase: 0.05, healthPerYear: -0.5 },
      stable:      { stopBase: 0.02, healthPerYear:  0 }
    },
    familySupport: {
      none:  { shockAbsorb: 0.00, bailoutChance: 0.05 },
      thin:  { shockAbsorb: 0.35, bailoutChance: 0.30 },
      solid: { shockAbsorb: 0.80, bailoutChance: 0.75 }
    },
    healthCoverage: {
      uninsured: { medicalCostMultiplier: 2.4, treatmentQuality: -0.20 },
      medicaid:  { medicalCostMultiplier: 0.6, treatmentQuality: -0.08 },
      employer:  { medicalCostMultiplier: 1.0, treatmentQuality:  0.00 }
    }
  },

  // ===========================================================================
  // CHILDHOOD NARRATION
  // ===========================================================================
  // The original engine read GAME_DATA.templates.childhood but no such key was
  // ever defined, so every childhood phase rendered as an empty paragraph.
  // {{placeholders}} are filled by buildPhaseCtx() in script.js.

  templates: {
    childhood: {
      "PreK": "{{name}} is four. The household is {{household_desc}}. Care before kindergarten is {{early_care}}, which decides how many words and how much structure land before anyone is measuring. Health coverage is {{coverage_desc}}, so the first ear infection is either a Tuesday appointment or a decision about money.",

      "Elementary": "Elementary is {{school_quality}} building with {{class_size}} classrooms. {{teacher_line}} Outside of school there are {{enrichment}}. {{hardship_line}} None of this shows up on a report card as anything other than {{name}}'s own performance.",

      "Middle": "Middle school sorts. Tracking decisions get made here on the basis of test scores, teacher referrals, and which parents know to ask — and they are hard to undo later. Counseling is {{counseling}}. {{peer_line}} {{policing_line}}",

      "High": "High school is where the sorting becomes a transcript. {{ap_line}} Guidance is {{counseling}}, spread across a caseload that makes individual attention a matter of luck. {{work_line}} {{hardship_line}} At eighteen the transcript gets handed to the next institution as though it were a clean measurement of {{name}}."
    }
  },

  // ===========================================================================
  // EMPLOYMENT
  // ===========================================================================
  // Jobs persist and pay every year on age-up. This matters for the model:
  // a one-shot payout would make hiring bias a small tax, whereas a recurring
  // salary makes it compound over a career — which is where the real gap is.
  // Figures are annual, pre-tax, and rounded for legibility.

  jobs: {
    unemployed:  { title: "Unemployed",            salary: 0,     raise: 0.00, layoffRisk: 0.00 },
    entry:       { title: "Entry-level",           salary: 27000, raise: 0.015, layoffRisk: 0.12 },
    apprentice:  { title: "Union apprentice",      salary: 44000, raise: 0.045, layoffRisk: 0.05 },
    journeyman:  { title: "Journeyman tradesman",  salary: 68000, raise: 0.030, layoffRisk: 0.04 },
    service:     { title: "Service member",        salary: 35000, raise: 0.030, layoffRisk: 0.01 },
    salaried:    { title: "Salaried professional", salary: 64000, raise: 0.035, layoffRisk: 0.06 },
    senior:      { title: "Senior professional",   salary: 98000, raise: 0.030, layoffRisk: 0.05 },
    gig:         { title: "Gig / contract work",   salary: 21000, raise: 0.005, layoffRisk: 0.20 }
  },

  economy: {
    costOfLivingBase: 23000,     // annual, when housed independently
    costOfLivingAtHome: 7000,    // annual personal expenses as a dependent
    costOfLivingDependent: 3200, // annual, at home AND with no income
    debtInterest: 0.06,
    // Promotion ladder: current job -> next, with the annual chance of moving up.
    promotion: {
      entry:      { to: "salaried",   chance: 0.06, needs: ["education:state_university", "education:elite_university"] },
      apprentice: { to: "journeyman", chance: 0.22 },
      salaried:   { to: "senior",     chance: 0.10 },
      gig:        { to: "entry",      chance: 0.15 }
    }
  },

  // ===========================================================================
  // ACTIONS
  // ===========================================================================
  // Schema:
  //   label, tags[], category, baseChance, cost{}, requires{}, mods{}, outcomes[]
  // Outcome chances are relative weights within the action; systemic modifiers
  // shift the whole distribution toward or away from the good outcomes rather
  // than gating the action outright.

  actions: {

    // ─── SCHOOL ─────────────────────────────────────────────────────────────
    take_SAT_prep: {
      label: "Take low-cost SAT prep",
      category: "school",
      tags: ["school", "prep"],
      baseChance: 0.9,
      cost: { wealth: 150 },
      requires: { age_min: 15, age_max: 19 },
      mods: { schoolFunding: +0.05, familySupport: +0.05 },
      outcomes: [
        { id: "gain", chance: 0.7, text: "Focused study lifts your test readiness.", effects: { academicPerformance: 3 } },
        { id: "meh", chance: 0.2, text: "You pick up some tips but struggle to practice consistently.", effects: { academicPerformance: 1 } },
        { id: "fail", chance: 0.1, text: "Family obligations and work leave little time to prep.", effects: { academicPerformance: 0, health: -1 } }
      ]
    },

    join_AP_program: {
      label: "Join AP / Honors course",
      category: "school",
      tags: ["school"],
      baseChance: 0.7,
      requires: { age_min: 14, age_max: 18, apAccess: true },
      mods: { schoolFunding: +0.1 },
      outcomes: [
        { id: "succeed", chance: 0.65, text: "You handle the rigor and earn credit.", effects: { academicPerformance: 4 } },
        { id: "struggle", chance: 0.25, text: "The workload is heavy; you pass but with stress.", effects: { academicPerformance: 1, health: -2 } },
        { id: "denied", chance: 0.10, text: "Scheduling and prerequisites block placement.", effects: {} }
      ]
    },

    // ─── COLLEGE ────────────────────────────────────────────────────────────
    apply_community_college: {
      label: "Apply to community college",
      category: "school",
      tags: ["college"],
      baseChance: 0.9,
      cost: { wealth: 50 },
      requires: { age_min: 17, flags_not: ["education:cc_enrolled", "education:state_university", "education:elite_university"] },
      outcomes: [
        { id: "accepted", chance: 0.85, text: "Accepted, with placement testing required.", effects: { durationMonths: 12, academicPerformance: 2 }, flags_set: { education: "cc_enrolled" } },
        { id: "waitlist", chance: 0.10, text: "Program waitlisted; you attend part-time.", effects: { durationMonths: 6, academicPerformance: 1 }, flags_set: { education: "cc_part_time" } },
        { id: "rejected", chance: 0.05, text: "Administrative hurdles delay enrollment.", effects: {} }
      ]
    },

    transfer_to_state: {
      label: "Transfer from CC to state university",
      category: "school",
      tags: ["college"],
      baseChance: 0.6,
      cost: { wealth: 100 },
      requires: { age_min: 18, flags_all: ["education:cc_enrolled"] },
      mods: { academicPerformance: +0.05 },
      outcomes: [
        { id: "accepted_scholar", chance: 0.25, text: "Accepted with a modest scholarship.", effects: { wealth: -2000, academicPerformance: 3, durationMonths: 12 }, flags_set: { education: "state_university" } },
        { id: "accepted", chance: 0.45, text: "Accepted without aid; you piece together work-study.", effects: { wealth: -4000, durationMonths: 12 }, flags_set: { education: "state_university" } },
        { id: "denied", chance: 0.30, text: "Credits don't transfer cleanly; the application is denied.", effects: {} }
      ]
    },

    apply_state_university: {
      label: "Apply to state university",
      category: "school",
      tags: ["college"],
      baseChance: 0.65,
      cost: { wealth: 200 },
      requires: { age_min: 17, flags_not: ["education:state_university", "education:elite_university"] },
      mods: { schoolFunding: +0.05, academicPerformance: +0.05 },
      outcomes: [
        { id: "accept_scholar", chance: 0.25, text: "Accepted with a need-based grant.", effects: { durationMonths: 12, wealth: -1000, academicPerformance: 4 }, flags_set: { education: "state_university" } },
        { id: "accept", chance: 0.35, text: "Accepted; tuition will stretch your budget.", effects: { durationMonths: 12, wealth: -3000 }, flags_set: { education: "state_university" } },
        { id: "reject", chance: 0.40, text: "Rejected; you reassess your path.", effects: {} }
      ]
    },

    apply_private_elite: {
      label: "Apply to an elite private university",
      category: "school",
      tags: ["college"],
      baseChance: 0.28,
      cost: { wealth: 500 },
      requires: { age_min: 17, flags_not: ["education:elite_university"] },
      mods: { familySupport: +0.05, academicPerformance: +0.1 },
      outcomes: [
        { id: "accept_full_need", chance: 0.12, text: "Accepted with strong need-based aid.", effects: { durationMonths: 12, wealth: -1500, academicPerformance: 6 }, flags_set: { education: "elite_university" } },
        { id: "accept_no_aid", chance: 0.18, text: "Accepted, but aid is limited; finances will be tight.", effects: { durationMonths: 12, wealth: -12000, academicPerformance: 4 }, flags_set: { education: "elite_university" } },
        { id: "reject", chance: 0.70, text: "Rejected; you consider other options.", effects: {} }
      ]
    },

    // ─── WORK ───────────────────────────────────────────────────────────────
    take_entry_job: {
      label: "Take an entry-level job",
      category: "work",
      tags: ["job"],
      baseChance: 0.9,
      requires: { age_min: 16, job_not: ["entry", "apprentice", "journeyman", "salaried", "senior", "service"] },
      outcomes: [
        { id: "steady", chance: 0.70, text: "You're hired. It's steady, and it pays what it pays.", effects: { setJob: "entry" } },
        { id: "temp", chance: 0.30, text: "No steady hire — you piece together gig and contract shifts.", effects: { setJob: "gig", health: -1 } }
      ]
    },

    join_union_apprentice: {
      label: "Join a union apprenticeship",
      category: "work",
      tags: ["job", "trade"],
      baseChance: 0.55,
      requires: { age_min: 18, flags_not: ["trade:true"], job_not: ["apprentice", "journeyman", "salaried", "senior"] },
      outcomes: [
        { id: "placed", chance: 0.5, text: "You're placed with a crew. Wages and training ramp from day one.", effects: { setJob: "apprentice" }, flags_set: { trade: true } },
        { id: "waitlist", chance: 0.35, text: "A long waitlist delays placement.", effects: { durationMonths: 6 } },
        { id: "not_accepted", chance: 0.15, text: "You aren't selected this cycle.", effects: {} }
      ]
    },

    apply_salaried_role: {
      label: "Apply for a salaried role",
      category: "work",
      tags: ["job"],
      baseChance: 0.45,
      requires: { age_min: 20, flags_any: ["education:state_university", "education:elite_university", "trade:true", "veteran:true"], job_not: ["salaried", "senior"] },
      mods: { academicPerformance: +0.1 },
      outcomes: [
        { id: "hired", chance: 0.40, text: "An offer comes through, with benefits attached.", effects: { setJob: "salaried" } },
        { id: "final_round", chance: 0.30, text: "You reach the final round and don't get it. No reason is given.", effects: { health: -2 } },
        { id: "no_callback", chance: 0.30, text: "You submit the application and hear nothing back at all.", effects: { health: -1 } }
      ]
    },

    enlist_military: {
      label: "Enlist in the military",
      category: "work",
      tags: ["career"],
      baseChance: 0.85,
      requires: { age_min: 17, flags_not: ["veteran:true", "record:true"], job_not: ["service", "salaried", "senior"] },
      outcomes: [
        { id: "enlist", chance: 0.8, text: "You enlist. Training, a steady wage, and GI education benefits.", effects: { setJob: "service", health: -2 }, flags_set: { veteran: true } },
        { id: "medical_disq", chance: 0.2, text: "Medical screening leads to disqualification.", effects: {} }
      ]
    },

    // ─── MONEY ──────────────────────────────────────────────────────────────
    start_side_hustle: {
      label: "Start a side hustle",
      category: "money",
      tags: ["finance"],
      baseChance: 0.7,
      outcomes: [
        { id: "grow", chance: 0.4, text: "Word of mouth builds a steady client base.", effects: { wealth: 1200 } },
        { id: "break_even", chance: 0.4, text: "You cover costs, but growth is slow.", effects: { wealth: 0 } },
        { id: "loss", chance: 0.2, text: "Costs outpace demand this season.", effects: { wealth: -400 } }
      ]
    },

    save_and_invest: {
      label: "Save and invest a portion of income",
      category: "money",
      tags: ["finance"],
      baseChance: 0.8,
      requires: { wealth_min: 500 },
      outcomes: [
        { id: "up", chance: 0.7, text: "Savings grow slowly.", effects: { wealth: 1200 } },
        { id: "down", chance: 0.3, text: "A downturn dents your small holdings.", effects: { wealth: -300 } }
      ]
    },

    take_student_loan: {
      label: "Take a student loan",
      category: "money",
      tags: ["finance", "college"],
      baseChance: 0.95,
      requires: { flags_any: ["education:state_university", "education:elite_university", "education:cc_enrolled"] },
      outcomes: [
        { id: "approved", chance: 0.9, text: "Loan approved; tuition and living costs are covered this term.", effects: { wealth: 6000, debt: 6000 }, flags_set: { debt_holder: true } },
        { id: "small", chance: 0.1, text: "Partial approval covers only tuition.", effects: { wealth: 3000, debt: 3000 }, flags_set: { debt_holder: true } }
      ]
    },

    manage_debt: {
      label: "Restructure or pay down debt",
      category: "money",
      tags: ["finance"],
      baseChance: 0.7,
      requires: { flags_any: ["debt_holder:true", "eviction_flag:true"] },
      outcomes: [
        { id: "plan", chance: 0.6, text: "You set a realistic plan and cut your interest costs.", effects: { wealth: -400, debt: -1200 } },
        { id: "setback", chance: 0.4, text: "Bills pile up; progress is slow.", effects: { wealth: -200, debt: 300 } }
      ]
    },

    // ─── HEALTH ─────────────────────────────────────────────────────────────
    seek_medical_care: {
      label: "See a doctor about it",
      category: "health",
      tags: ["health"],
      baseChance: 0.6,
      mods: { coverage: +0.15 },
      outcomes: [
        { id: "treated", chance: 0.5, text: "You're examined, believed, and treated.", effects: { health: 8, wealth: -300 } },
        { id: "dismissed", chance: 0.3, text: "Your pain is logged as moderate and you're sent home with advice.", effects: { health: 1, wealth: -180 } },
        { id: "cost_deferred", chance: 0.2, text: "You look at the estimate and decide it can wait.", effects: { health: -3 } }
      ]
    },

    // ─── SUBSTANCE ──────────────────────────────────────────────────────────
    // These were advertised in the old script header and wired into the
    // shortcut box, but no such actions existed in the data file — so the
    // addiction stat could never leave zero. Implemented here.
    experiment_substance: {
      label: "Use to take the edge off",
      category: "substance",
      tags: ["substance"],
      baseChance: 0.5,
      outcomes: [
        { id: "once", chance: 0.55, text: "It helps, briefly. You tell yourself it was a one-time thing.", effects: { addiction: 8, health: -1 } },
        { id: "habit", chance: 0.30, text: "It becomes the thing you do after a bad shift.", effects: { addiction: 18, health: -3 } },
        { id: "bad_time", chance: 0.15, text: "It goes badly and costs you the next two days.", effects: { addiction: 10, health: -6, durationMonths: 1 } }
      ]
    },

    seek_rehab: {
      label: "Seek treatment",
      category: "substance",
      tags: ["substance", "health"],
      baseChance: 0.55,
      requires: { addiction_min: 15 },
      mods: { coverage: +0.2, familySupport: +0.1 },
      outcomes: [
        { id: "inpatient", chance: 0.30, text: "You get an inpatient bed. It works, and it costs.", effects: { addiction: -45, health: 10, wealth: -3000, durationMonths: 3 } },
        { id: "outpatient", chance: 0.40, text: "Outpatient counseling, once a week, around your shifts.", effects: { addiction: -20, health: 4, wealth: -700, durationMonths: 2 } },
        { id: "waitlist", chance: 0.30, text: "The waitlist is eleven weeks. You're told to call back.", effects: { addiction: 4, health: -2 } }
      ]
    },

    // ─── JUSTICE ────────────────────────────────────────────────────────────
    petty_offense: {
      label: "Take the money that's sitting there",
      category: "justice",
      tags: ["justice", "crime"],
      baseChance: 0.5,
      outcomes: [
        { id: "clean", chance: 0.55, text: "Nothing happens. You are not caught.", effects: { wealth: 600 } },
        { id: "caught_warning", chance: 0.25, text: "You're caught. It's handled informally.", effects: { health: -2 } },
        { id: "charged", chance: 0.20, text: "You're caught, and it's charged.", effects: { health: -4, wealth: -500 }, flags_set: { record: true, charged: true } }
      ]
    },

    diversion_program: {
      label: "Ask about a diversion program",
      category: "justice",
      tags: ["justice"],
      baseChance: 0.45,
      requires: { flags_all: ["charged:true"], flags_not: ["record_cleared:true"] },
      mods: { familySupport: +0.15, coverage: +0.05 },
      outcomes: [
        { id: "admitted", chance: 0.35, text: "You're admitted. Complete the terms and the charge does not become a conviction.", effects: { wealth: -600, durationMonths: 6 }, flags_set: { record: false, charged: false, record_cleared: true } },
        { id: "conditional", chance: 0.30, text: "Admitted, with fees you'll be paying for a while.", effects: { wealth: -1400, durationMonths: 6 }, flags_set: { record: false, charged: false, record_cleared: true } },
        { id: "denied", chance: 0.35, text: "You don't meet the criteria used in this county.", effects: { health: -2 } }
      ]
    },

    probation_checkin: {
      label: "Make the probation check-in",
      category: "justice",
      tags: ["justice"],
      baseChance: 0.8,
      requires: { flags_all: ["record:true"] },
      outcomes: [
        { id: "fine", chance: 0.6, text: "You make it. It cost you half a shift and the bus fare.", effects: { wealth: -80 } },
        { id: "conflict", chance: 0.25, text: "The appointment conflicts with work. You choose the appointment.", effects: { wealth: -300 } },
        { id: "violation", chance: 0.15, text: "You miss it. A technical violation is filed.", effects: { health: -4, wealth: -400 }, flags_set: { violation: true } }
      ]
    },

    record_expungement: {
      label: "Petition to expunge your record",
      category: "justice",
      tags: ["justice"],
      baseChance: 0.35,
      cost: { wealth: 900 },
      requires: { flags_all: ["record:true"], age_min: 21 },
      mods: { familySupport: +0.2 },
      outcomes: [
        { id: "granted", chance: 0.30, text: "Granted. It took two years, a lawyer, and $900 you needed.", effects: {}, flags_set: { record: false, record_cleared: true } },
        { id: "partial", chance: 0.25, text: "Partially sealed. Some background checks will still surface it.", effects: {}, flags_set: { record_partial: true } },
        { id: "denied", chance: 0.45, text: "Denied on eligibility grounds. The filing fee is not refunded.", effects: { health: -3 } }
      ]
    },

    // ─── HOUSING & NETWORK ──────────────────────────────────────────────────
    seek_mentor: {
      label: "Seek a mentor",
      category: "network",
      tags: ["network"],
      baseChance: 0.6,
      requires: { flags_not: ["mentor:true"] },
      mods: { familySupport: +0.1, schoolFunding: +0.05 },
      outcomes: [
        { id: "found", chance: 0.5, text: "A mentor offers guidance and, more usefully, introductions.", effects: { academicPerformance: 2 }, flags_set: { mentor: true } },
        { id: "try_again", chance: 0.35, text: "The conversations help, but no lasting fit yet.", effects: {} },
        { id: "none", chance: 0.15, text: "You struggle to find someone with time and alignment.", effects: {} }
      ]
    },

    find_housing: {
      label: "Look for your own place",
      category: "housing",
      tags: ["housing"],
      baseChance: 0.55,
      requires: { age_min: 18, wealth_min: 800 },
      mods: { hiring: +0.1 },
      outcomes: [
        { id: "leased", chance: 0.45, text: "Approved. First, last, and deposit clears out your savings.", effects: { wealth: -2400 }, flags_set: { housed: true } },
        { id: "cosigner", chance: 0.30, text: "Approved only with a cosigner.", effects: { wealth: -2400 }, flags_set: { housed: true } },
        { id: "screened_out", chance: 0.25, text: "The application is declined after the background check.", effects: { wealth: -60, health: -2 } }
      ]
    }
  },

  // ===========================================================================
  // RANDOM LIFE EVENTS — fired on age-up, not chosen.
  // ===========================================================================
  // Each has a weight and an optional `when` predicate evaluated in script.js.

  events: {
    housing_shock: {
      label: "Housing cost",
      weight: 1.0,
      absorbable: true,
      outcomes: [
        { id: "repair", chance: 0.5, text: "An urgent repair drains savings.", effects: { wealth: -800 } },
        { id: "eviction_scare", chance: 0.3, text: "A late-rent notice arrives.", effects: { wealth: -400 }, flags_set: { eviction_flag: true } },
        { id: "ok", chance: 0.2, text: "You avoid major costs this time.", effects: {} }
      ]
    },
    health_event: {
      label: "Health",
      weight: 0.8,
      absorbable: true,
      outcomes: [
        { id: "bill", chance: 0.5, text: "An emergency visit leads to bills and missed work.", effects: { wealth: -1200, health: -6, durationMonths: 1 } },
        { id: "recover", chance: 0.35, text: "You recover with minor costs.", effects: { health: -2, wealth: -150 } },
        { id: "minor", chance: 0.15, text: "A scare, but no lasting impact.", effects: {} }
      ]
    },
    car_trouble: {
      label: "Transportation",
      weight: 0.9,
      absorbable: true,
      outcomes: [
        { id: "breakdown", chance: 0.45, text: "The car dies. Without it, the job is a two-hour bus ride.", effects: { wealth: -900, health: -2 } },
        { id: "repair", chance: 0.35, text: "A repair you can just barely cover.", effects: { wealth: -350 } },
        { id: "fine", chance: 0.20, text: "It holds together another year.", effects: {} }
      ]
    },
    windfall: {
      label: "Windfall",
      weight: 0.35,
      outcomes: [
        { id: "tax_refund", chance: 0.6, text: "A tax refund lands.", effects: { wealth: 900 } },
        { id: "gift", chance: 0.4, text: "A relative helps out without being asked.", effects: { wealth: 1500 } }
      ]
    }
  }
};
