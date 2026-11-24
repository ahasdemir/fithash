---
title: "Exercise Science Evidence Base: What the Literature Does and Does Not Support in FitHash"
doc_id: ES-RESEARCH-001
version: 1.0.0
status: research / decision-support
date: 2026-11-24
audience: product owner, engineering, coaching-content authors
scope: hypertrophy and strength exercise science as implemented in FitHash
related:
  - docs/HYPERTROPHY_BIOMECHANICS_AUTOREGULATION_SPEC.md
  - docs/MUSCLE_TAXONOMY_AND_SPLIT_ARCHITECTURE_SPEC.md
  - docs/COMPETITIVE_FEATURE_AUDIT_HEVY_RP_NIPPARD.md
grading: "A | B | C | D (see §0.2)"
language: en-GB prose, Turkish UI strings preserved verbatim
---

# Exercise Science Evidence Base: What the Literature Does and Does Not Support in FitHash

## 0. Purpose, scope and how to use this document

FitHash already contains three implementation-oriented specifications:

| Document | What it specifies | Relationship to this document |
|---|---|---|
| `docs/HYPERTROPHY_BIOMECHANICS_AUTOREGULATION_SPEC.md` | Biomechanical profiles, axial-load indexing, DDP, mesocycle state machine, dynamic rest | Consumes the grades here; this document does **not** restate its algorithms |
| `docs/MUSCLE_TAXONOMY_AND_SPLIT_ARCHITECTURE_SPEC.md` | Muscle taxonomy, fractional volume attribution, volume landmarks, split engine | Consumes the volume grades here; §2.3 and §3.1 explain why landmark *values* are unvalidated |
| `docs/COMPETITIVE_FEATURE_AUDIT_HEVY_RP_NIPPARD.md` | Competitor capability gaps | Orthogonal; this document is about evidentiary warrant, not competitor parity |

This document answers a narrower and more uncomfortable question than any of the three: **for each training variable FitHash already encodes as a rule, what is the actual strength of the supporting evidence, and where does the product assert more certainty than the literature provides?**

It is deliberately an *audit*, not a marketing asset. Several findings conclude that a shipped feature is defensible as a heuristic but not defensible as "science," and the recommended remediation is usually a change of framing, a widened default, or an explicit uncertainty surface — not deletion.

### 0.1 What this document is not

- It is **not** a training programme. It contains no prescription for an individual user.
- It is **not** a replacement for the three specifications above. Where a mechanism is already specified there, this document cites it rather than re-deriving it.
- It is **not** a systematic review. It is a structured appraisal of a selected evidence base, written to support engineering and product decisions. A genuine systematic review would require protocol registration, dual screening, risk-of-bias assessment and GRADE. Where this document grades a body of evidence, the grade is an author judgement informed by the cited reviews, not a formal GRADE output.
- It does **not** adjudicate individual studies on methodological merit beyond what published reviews already report.

### 0.2 Evidence grading rubric

Every substantive claim in §2 and §3 carries one of four grades.

| Grade | Definition | Typical source base | Permitted product language |
|---|---|---|---|
| **A** | Consistent across multiple independent meta-analyses or systematic reviews, with low-to-moderate heterogeneity and convergence between meta-analytic and randomised trial evidence. | ≥2 independent meta-analyses, or 1 meta-analysis plus confirmatory RCTs | May say "evidence supports", "consistently shown" |
| **B** | Supported by a single meta-analysis, or by multiple consistent RCTs without a second independent meta-analysis, or by a meta-analysis whose conclusions are qualified by high heterogeneity or small study counts. | 1 meta-analysis, or ≥2 RCTs | May say "evidence suggests", "generally favours" |
| **C** | Limited, emerging, mechanistic, or indirect. Includes acute-mechanism studies extrapolated to chronic adaptation, small-N trials, and meta-analyses whose pooled estimates are unstable. | Acute studies, small RCTs, mechanistic work | Must say "preliminary", "mechanistically plausible", "limited evidence" |
| **D** | Practitioner consensus, coaching heuristic, or internal model with no direct empirical validation. May still be useful. | Position stands, practitioner texts, first principles | Must say "heuristic", "coaching convention", "not empirically validated" |

Two rules govern the whole document:

1. **A grade attaches to a claim, not to a paper.** A single paper may support an A-grade claim in one paragraph and a D-grade claim in the next. Grades are therefore re-stated per claim rather than inherited from a source.
2. **Grade inflation is the default failure mode.** When a review reports a pooled estimate whose confidence interval crosses zero, or whose authors explicitly label the analysis exploratory, the claim is downgraded even if the paper is a meta-analysis.

### 0.3 Reading the implications

Each §3 subsection ends with a line beginning **→ FitHash implication**. These are the operative outputs. §4 converts them into an implementation audit with file-and-line anchors, and §5 into a prioritised backlog.

The Turkish UI strings quoted throughout (`'Göğüs'`, `'Bacak'`, `'Hacim Yetersiz (<6 Set)'`, etc.) are reproduced exactly as they appear in source; they are product surface, not evidence claims.

---

## 1. Executive summary

Twelve findings, ordered by their consequence for the product rather than by their prominence in the literature.

**F1. Weekly volume is the best-evidenced hypertrophy lever, and it has diminishing returns (Grade A for "more volume → more hypertrophy up to a point"; Grade B for the shape of the curve).** Schoenfeld et al. (2017) meta-regressed 34 treatment groups from 15 studies and found a graded relationship: each additional weekly set was associated with an effect-size increase of 0.023, corresponding to roughly 0.37% additional percentage gain, with higher- versus lower-volume groups differing by about 3.9% [ref: Schoenfeld 2017a]. A controlled trial in 34 resistance-trained men found hypertrophy favoured 5 sets over 3 over 1 per exercise at the elbow flexors, mid-thigh and lateral thigh, while strength did not differ between groups [ref: Schoenfeld 2019b]. The 2026 meta-regression of 67 studies and 2,058 participants found a posterior probability of 100% that the volume–hypertrophy slope exceeds zero, but with clearly diminishing returns, and even more pronounced diminishing returns for strength [ref: Pelland 2026]. The practical consequence is that "more is better" is true on average and false at the margin, and no study identifies a universal ceiling.

**F2. Load per se does not determine hypertrophy when sets are taken near failure (Grade A).** Schoenfeld et al. (2017b) found low-load and high-load training produce similar hypertrophy when volume is equated [ref: Schoenfeld 2017b]; Morton et al. (2016) found load did not determine hypertrophy or strength once training was to failure [ref: Morton 2016]; Lasevicius et al. (2018) found 20–80% 1RM produced similar growth when volume-load was equated, with 20% 1RM inferior [ref: Lasevicius 2018]. This is the strongest argument against hard-coded "hypertrophy rep brackets" that imply a narrow optimal rep window.

**F3. Proximity to failure matters more for hypertrophy than for strength, and the hypertrophy relationship is probably non-linear (Grade B, contested).** Refalo et al. (2023) pooled 15 studies and found a trivial advantage for set failure versus non-failure (ES 0.19, 95% CI 0.00–0.37) and no advantage for momentary muscular failure versus non-failure (ES 0.12, 95% CI −0.13–0.37) [ref: Refalo 2023]. Robinson et al. (2024) meta-regressed 1-RIR proxies continuously and found strength slopes compatible with the null across a wide RIR range, while hypertrophy slopes were negative and excluded the null — i.e. closer to failure was better for size [ref: Robinson 2024]. The authors labelled the analysis exploratory and warned that RIR was estimated post hoc from study descriptions.

**F4. Training to failure is not required, and on average buys little (Grade A for "not required"; Grade B for "little average benefit").** Davies et al. (2016) found failure training did not confer a meaningful strength advantage over non-failure training [ref: Davies 2016]. Refalo et al. (2023) reach the same conclusion for hypertrophy [ref: Refalo 2023]. The cost side — fatigue, session length, recovery — is real but poorly quantified in the same literature.

**F5. Frequency is a volume-distribution variable, not an independent driver of hypertrophy (Grade A/B).** Grgic et al. (2018b) found frequency effects on strength were explained by volume, with no effect when volume was equated [ref: Grgic 2018b]. Schoenfeld et al. (2016b) found 2×/week superior to 1×/week for hypertrophy but could not separate 3×/week from 2×/week [ref: Schoenfeld 2016b]. Pelland et al. (2026) found frequency's effect on hypertrophy was compatible with negligible, while frequency's effect on strength was reliably positive with diminishing returns [ref: Pelland 2026]. Colquhoun et al. (2018) similarly concluded volume, not frequency, explained strength adaptations [ref: Colquhoun 2018].

**F6. Rest intervals of at least ~2 minutes for compound work are supported; beyond ~90 seconds the hypertrophy difference is not detectable (Grade B).** Schoenfeld et al. (2016a) found 3-minute rest superior to 1-minute for both strength and hypertrophy in resistance-trained men [ref: Schoenfeld 2016a]. Grgic et al. (2018a) reviewed 23 studies and concluded longer rest favours strength [ref: Grgic 2018a]. Singer et al. (2024) Bayesian meta-analysis found a small hypertrophic benefit to >60 s rest, but no appreciable difference beyond 90 s, with substantial heterogeneity [ref: Singer 2024]. The literature does not support a single "correct" rest value; it supports a floor.

**F7. Full range of motion is at least as good as partial for strength and lower-limb hypertrophy; lengthened partials are promising but contested (Grade B for full-ROM parity/superiority; Grade C for lengthened-partial superiority).** Pallarés et al. (2021) found full ROM superior for strength (ES 0.56) and lower-limb hypertrophy (ES 0.88) [ref: Pallarés 2021]. Wolf et al. (2023) found a trivial overall SMD of 0.12 favouring full ROM, with a possible benefit for long-length partials that did not exclude no effect (SMD −0.28, 95% CI −0.81–0.16) [ref: Wolf 2023]. Pedrosa et al. (2022) and Kassiano et al. (2023) report favourable results for partial ROM performed at long muscle lengths in specific exercises [ref: Pedrosa 2022; ref: Kassiano 2023]. The area is genuinely unresolved.

**F8. Very slow eccentric tempos are not superior for strength or hypertrophy, and extreme slow tempos may reduce the load achievable (Grade B/C).** Roig et al. (2009) found eccentric training's advantage was largely intensity- and specificity-dependent rather than a property of tempo itself [ref: Roig 2009]. A 2025 meta-analysis of eccentric phase duration found uncertain estimates for maximal strength and hypertrophy, with the only practically worthwhile effect favouring shorter eccentrics for countermovement jump [ref: Amdi 2025]. Tempo is a weak lever compared with volume and effort.

**F9. General warm-up has modest, heterogeneous performance benefits; specific ramp percentages are a coaching convention (Grade C for general warm-up; Grade D for 50/70/85% ramps).** Fradkin et al. (2010) found small-to-moderate performance improvements but noted few well-conducted RCTs [ref: Fradkin 2010]. McGowan et al. (2015) describe temperature, metabolic and neural mechanisms without establishing an optimal ramp [ref: McGowan 2015]. No trial establishes that 50%, 70% and 85% of working weight is superior to any other ramp.

**F10. Deloads are widely practised and weakly evidenced; recent trials find no clear harm and no clear benefit in the short term (Grade C).** Surveys document heterogeneous practice [ref: De Marco 2024; ref: Rogerson 2024]. A 2024 supervised trial found a one-week mid-programme deload did not affect hypertrophy, power or endurance but reduced lower-body strength relative to a traditional progression [ref: Coleman 2024]. A 2026 trial found reduced volume/frequency at midpoint or end did not hinder hypertrophy or strength-endurance in untrained men [ref: Pancar 2026]. "Deload because e1RM stagnated for three sessions" is a plausible heuristic, not an evidence-based trigger.

**F11. RIR and RPE are usable at the group level and noisy at the individual level (Grade B for group-level utility; Grade C for individual precision).** Zourdos et al. (2016) established the RIR-based RPE scale and its correspondence with velocity [ref: Zourdos 2016]. Helms et al. (2017, 2018) demonstrated RPE-based autoregulation in powerlifters [ref: Helms 2017; ref: Helms 2018]. Holmes et al. (2026) found no significant accuracy difference between RIR and RPE for predicting proximity to failure, with both carrying meaningful individual error [ref: Holmes 2026]. Treating a self-reported RIR as a precise numeric input into a formula overstates its resolution.

**F12. The largest real-world effect modifiers sit outside the training-variable literature: adherence, self-monitoring, sleep, and measurement error (Grade A/B).** Self-monitoring is consistently associated with better weight and activity outcomes [ref: Burke 2011; ref: Brickwood 2019]. Acute sleep loss degrades performance by roughly 7.6% in pooled estimates [ref: Craven 2022], and inadequate sleep is associated with poorer strength outcomes [ref: Knowles 2018]. Consumer wearables estimate energy expenditure poorly [ref: O'Driscoll 2020; ref: Shcherbina 2017]. Attrition in digital behaviour-change interventions is severe and front-loaded [ref: Eysenbach 2005]. A product that gets the volume curve slightly wrong but keeps users logging will outperform one that gets the curve right and loses them.

### 1.1 What the executive summary implies collectively

Three structural conclusions follow from F1–F12 and drive the backlog in §5.

1. **The app's scientific surface is over-specified relative to its evidence.** Nine places in the codebase convert a heuristic into a numeric assertion with no uncertainty: e1RM to the nearest kilogram, recovery to the nearest percentage point, volume landmarks to a five-band status, a deload triggered by a 0.05 kg e1RM delta. Each is defensible as a *display convention*; none is defensible as a *measurement*.
2. **The strongest evidence supports the simplest rules.** Volume up to a point, effort near but not at failure, rest of at least two minutes for compounds, full range of motion, progressive overload by load or reps, and consistency. FitHash already encodes all of these. The marginal scientific value is therefore not in adding more rules but in making existing rules honest about their precision.
3. **The most under-served evidence area in the product is behaviour, not physiology.** There is no adherence instrumentation, no self-monitoring feedback loop, and no sleep or readiness input beyond a manual soreness rating. On the evidence, these are larger levers than any refinement of the hypertrophy rep bracket.

### 1.2 Decision rules distilled

If the twelve findings and the eighteen evidence-review sections were compressed into rules an engineer could apply without reading the rest, they would be these. Each rule carries the grade of the evidence behind it, so that it can be defended in review.

| # | Rule | Grade | Where it binds |
|---|---|---|---|
| 1 | Prescribe ranges, not points. Any derived number shown to a user should carry a band or an "estimate" qualifier. | B | e1RM, recovery %, volume bands, rest seconds |
| 2 | Default to 1–2 reps in reserve. Do not make failure the first or easiest option. | B | RIR input, overload targets, mesocycle RIR ramp |
| 3 | Count hard sets per muscle per week as the primary volume metric. Do not use tonnage as the headline. | B | Volume engine, analytics |
| 4 | Distribute weekly volume across at least two sessions per muscle. Do not sell frequency as independent stimulation. | B | Split engine, mesocycle copy |
| 5 | Floor compound rest at 90 seconds and default to 120–180 seconds. | B | Rest timer |
| 6 | Default to full range of motion. Treat long-length partials as an advanced, exercise-specific option. | B/C | ROM tagging, coaching copy |
| 7 | Progress by load or by reps; both work. Do not present one as superior. | B | DDP engine, copy |
| 8 | Suggest deloads; never apply them automatically. State the observation that triggered the suggestion. | C | Plateau detection, plan mutation |
| 9 | Treat every model parameter that was not fitted to data as a tuning constant, and say so in the code. | D | e1RM exponent, Hill beta, half-lives, leverage ratios |
| 10 | Optimise adherence before optimising training variables. A slightly suboptimal plan that is followed beats an optimal plan that is abandoned. | A | Onboarding, notifications, plan sizing |

The ordering is deliberate. Rules 1–2 fix the highest-severity audit findings; rules 3–7 are already largely implemented and need framing rather than engineering; rules 8–9 are documentation and disclosure; rule 10 is the strategic claim the evidence supports most strongly and the product currently under-exploits.

---

## 2. Map of contested territory

The literature is not uniformly settled, and several of the most product-relevant questions are precisely the ones where reviews disagree. This section states, for each contested area, what is agreed, what is disputed, and what FitHash should therefore avoid asserting.

### 2.1 Effective-repetition thresholds

**The claim.** Repetitions performed in the last ~5 before failure carry most of the hypertrophic stimulus, so sets can be truncated once "effective reps" are accumulated.

**Status.** No peer-reviewed validation of a specific numeric threshold was located. The concept is a mechanistic inference from motor-unit recruitment and fatigue, popularised in practitioner literature. What the literature *does* support is weaker and directional: hypertrophy increases as sets approach failure (Grade B) [ref: Robinson 2024], while momentary failure itself confers no reliable additional benefit over stopping 1–2 reps short (Grade B) [ref: Refalo 2023]. The step from that directional finding to "reps + RIR, with a hard threshold at 5" is not in the literature.

**Verdict.** The mechanism is plausible; the number is invented. Grade **C** for "proximity matters"; grade **D** for "effective reps = reps + clamp(RIR, 0, 5) with a piecewise correction at 10".

**Product consequence.** `src/utils/e1rm.ts` uses exactly this construction. It is a reasonable *smoothing device* for e1RM estimation but must not be surfaced to users as a validated stimulus model.

### 2.2 Lengthened partials

**The claim.** Partial repetitions performed in the stretched portion of the range produce equal or greater hypertrophy than full-ROM repetitions, because of elevated mechanical tension at long sarcomere lengths.

**Status.** Genuinely contested. Pallarés et al. (2021) favour full ROM for strength and lower-limb hypertrophy [ref: Pallarés 2021]. Wolf et al. (2023) find a trivial overall advantage for full ROM but cannot exclude a long-length-partial benefit [ref: Wolf 2023]. Pedrosa et al. (2022) and Kassiano et al. (2023) report favourable long-length partial results in specific exercises [ref: Pedrosa 2022; ref: Kassiano 2023]. Maeo et al. (2021) found a *position* effect (seated versus prone leg curl) that is at least as consistent with hip-angle-dependent length than with partials per se [ref: Maeo 2021].

**Verdict.** Grade **B** that full ROM is not inferior overall; grade **C** that lengthened partials are superior, and then only exercise-specifically.

**Product consequence.** `getBiomechanicalProfile` assigns `'LENGTHENED'` and a `stimulusMultiplier` of up to 1.40 from string matching. That multiplier is a scheduling heuristic for fatigue and rest, not a hypertrophy coefficient, and should be described that way.

### 2.3 High-volume dose–response

**The claim.** Hypertrophy continues to increase with weekly volume, and there is a definable maximum adaptive and maximum recoverable volume.

**Status.** The direction is well supported (Grade A). The shape is contested (Grade B): linear-with-diminishing-returns models fit best, but the location of the inflection is not identified, and the confidence bands are wide at high volumes [ref: Schoenfeld 2017a; ref: Pelland 2026]. The specific constructs MEV, MAV and MRV originate in practitioner modelling, not in controlled trials. No study randomises participants to a purported MRV boundary and demonstrates that crossing it impairs adaptation.

**Verdict.** Grade **A** for "more volume, more hypertrophy, with diminishing returns"; grade **D** for any specific numeric landmark set (6/10/19/22 sets).

**Product consequence.** `evaluateWeeklyMuscleVolumeLandmarks` returns five named bands from hard-coded cut-offs. The bands are a UI affordance; the labels `'Minimum Etkili Hacim (MEV: 6-9 Set)'` and `'Tavan Hacim (MRV: 19-22 Set)'` read as established fact.

### 2.4 Failure proximity for hypertrophy versus strength

**The claim.** Hypertrophy requires sets close to failure; strength does not.

**Status.** This is the best-supported version of the failure debate (Grade **B**, moving toward A for strength). Strength gains are similar across a wide RIR range [ref: Robinson 2024; ref: Grgic 2018b]; hypertrophy is mildly sensitive to proximity [ref: Refalo 2023; ref: Robinson 2024]. But the pooled hypertrophy effect is trivial in magnitude, the RIR inputs are estimated rather than measured, and at least one 2025 trial found 0–3 RIR slightly *inferior* to 4–6 RIR for strength with hypertrophy unclear [ref: Robinson 2025].

**Verdict.** Grade **B**. "Train near failure for size, anywhere reasonable for strength" is defensible. "RIR 0 is optimal" is not.

**Product consequence.** The RIR pill cycles 0→1→2→3→unset, which makes RIR 0 the first and most visually prominent option. The ordering encodes a normative claim the evidence does not support.

### 2.5 Rest intervals

**The claim.** Longer rest is better for hypertrophy and strength; short rest is acceptable for isolation work.

**Status.** Partly settled. The strength direction is consistent (Grade **B**) [ref: Grgic 2018a; ref: Schoenfeld 2016a]. The hypertrophy direction is small and flattens beyond ~90 s (Grade **B**) [ref: Singer 2024]. "Short rest is fine for isolation" is a plausible extrapolation from lower absolute loads, not a tested claim (Grade **D**).

**Verdict.** Grade **B** for a floor of roughly 90–120 s on compound work; grade **D** for any precise per-exercise rest prescription.

**Product consequence.** `calculateDynamicRestSeconds` multiplies a base rest by an RIR factor and an axial factor, producing exact second counts. The formula is reasonable; the exactness is not.

### 2.6 Summary table of contested claims

| Area | Agreed | Disputed | Not established | FitHash exposure |
|---|---|---|---|---|
| Effective reps | Proximity to failure matters directionally | Whether a numeric threshold exists | Any specific cutoff (e.g. 5) | `e1rm.ts` piecewise model |
| Lengthened partials | Full ROM is not inferior | Whether long-length partials are superior | A per-exercise stimulus multiplier | `getBiomechanicalProfile` |
| Volume dose–response | More volume → more hypertrophy | Shape and inflection of the curve | MEV/MAV/MRV numeric values | `evaluateWeeklyMuscleVolumeLandmarks` |
| Failure proximity | Strength is insensitive; hypertrophy mildly sensitive | Whether RIR 0 is optimal | Exact optimal RIR per exercise | RIR pill ordering |
| Rest intervals | ≥2 min helps compounds | Hypertrophy benefit beyond 90 s | Per-exercise optimal rest | `calculateDynamicRestSeconds` |
| Deloads | Widely practised | Whether they improve outcomes | Any trigger criterion | `detectPlateauAndDeload` |
| Recovery timelines | Fatigue resolves over days | Whether 48–72 h is correct | Any per-muscle half-life | `muscleRecoveryService` |
| Warm-up ramps | General warm-up helps slightly | Optimal ramp structure | 50/70/85% as a validated sequence | `WARMUP_RAMP` |

---

## 3. Evidence review by training variable

Each subsection follows the same shape: what the variable is, what the strongest available evidence says, what remains unknown, a grade, and the consequence for FitHash. Numbers quoted are those reported by the cited source, not re-derived.

### 3.1 Weekly volume and the dose–response curve

**What is being measured.** Volume is quantified in the literature in at least four incommensurable ways: total sets, sets per muscle per week, volume load (sets × reps × load), and "hard sets" (sets taken within a stated proximity to failure). Baz-Valle et al. (2021) reviewed the quantification problem and concluded that counting total sets taken to or near failure is a valid practical method for exercises performed in roughly the 6–20+ repetition range [ref: Baz-Valle 2021]. This matters because FitHash counts sets, not tonnage, and the choice is defensible.

**Direction of effect.** The association between weekly volume and hypertrophy is one of the most replicated findings in the field. Schoenfeld et al. (2017a) meta-regressed 34 treatment groups from 15 studies and found a significant continuous effect of weekly sets on muscle size (P = 0.002). Each additional weekly set was associated with an effect-size increase of 0.023, corresponding to an increase in percentage gain of 0.37%. Comparing higher- versus lower-volume conditions within studies, the effect-size difference was 0.241, equivalent to a 3.9% difference in percentage gain [ref: Schoenfeld 2017a]. The three-level categorical analysis (<5, 5–9, 10+ sets per muscle per week) showed only a trend (P = 0.074), which is itself informative: the relationship is better modelled as continuous than as bands.

**Experimental confirmation.** Schoenfeld et al. (2019b) randomised 34 resistance-trained men to 1, 3 or 5 sets per exercise per session, three sessions per week for 8 weeks. Strength and endurance increased in all groups with no between-group differences. Hypertrophy significantly favoured the higher-volume conditions at the elbow flexors, mid-thigh and lateral thigh [ref: Schoenfeld 2019b]. The dissociation is important and recurs throughout this document: volume moves size more reliably than it moves maximal strength in trained populations.

**Strength specifically.** Ralston et al. (2017) meta-analysed weekly set volume against strength gain and reported a graded dose–response favouring higher volumes, while noting that the strength literature is smaller and less consistent than the hypertrophy literature [ref: Ralston 2017]. The 2026 meta-regression reaches the same conclusion with a stronger caveat: the volume–strength relationship has more pronounced diminishing returns than the volume–hypertrophy relationship [ref: Pelland 2026].

**Shape of the curve.** The most comprehensive current synthesis is the 2026 meta-regression by Pelland et al., covering 67 studies and 2,058 participants. Its methodological contribution is the classification of each set as direct or indirect relative to the outcome being measured, and the comparison of three quantification schemes (total, fractional, direct). The fractional scheme — indirect sets counted as 0.5 — had the strongest relative evidence and was used for the primary models. Under that model, the posterior probability that the volume–hypertrophy slope exceeds zero was 100%, and the posterior probability for the volume–strength slope was also 100%. Both best-fit models showed diminishing returns, with diminishing returns for strength considerably more pronounced than for hypertrophy [ref: Pelland 2026].

Two consequences follow. First, "more volume is better" is empirically supported on average. Second, the *rate* of additional benefit falls, and falls faster for strength than for size. Neither model identifies a point at which additional volume becomes harmful.

**What is not established.**

- **Any specific ceiling.** No included study randomises participants to a putative maximum recoverable volume and demonstrates that exceeding it attenuates adaptation. The upper bounds observed in trials (often 20–25+ sets per muscle per week) are the upper bounds of what has been *tested*, not of what is *tolerable*.
- **The numeric landmarks.** MEV, MAV and MRV are practitioner constructs. They are useful organising metaphors and poor measurement units. Grade D applies to the specific values 6/10/19/22.
- **Junk volume.** The proposition that sets beyond some threshold contribute nothing is a strong claim that the dose–response literature does not support; the models show diminishing, not zero, returns.

**Grade.** **A** for "weekly volume increases hypertrophy, with diminishing returns". **B** for the specific functional form. **D** for any named landmark value.

**→ FitHash implication.** `evaluateWeeklyMuscleVolumeLandmarks` implements a five-band classifier at 6/10/19/22 hard sets. The *direction* of the bands is consistent with the evidence; the *cut-points* are not derived from it. The recommendation is not to remove the bands — they are a usable affordance — but to (a) rename them away from MEV/MAV/MRV toward descriptive language, (b) present the count with an explicit "estimate" qualifier, and (c) stop describing 19–22 as a "ceiling". Separately, the fractional-attribution approach specified in `docs/MUSCLE_TAXONOMY_AND_SPLIT_ARCHITECTURE_SPEC.md` now has direct meta-analytic support from Pelland et al. (2026): counting indirect sets at a fraction is empirically preferable to counting them fully or not at all [ref: Pelland 2026]. The *specific* fractional weights in that spec remain unvalidated (Grade D), but the architecture is sound.

---

### 3.2 Load, intensity and the repetition continuum

**The classical position.** Textbooks historically assigned hypertrophy to 6–12 RM, strength to 1–5 RM, and endurance to 15+ RM. Kraemer and Ratamess (2004) codified these zones in a widely taught framework [ref: Kraemer 2004]. The framework is a useful communication device and a poor description of the evidence.

**What the meta-analyses show.** Schoenfeld et al. (2017b) compared low-load and high-load resistance training and found similar hypertrophy when training was carried to or near failure, with high-load training superior for maximal strength [ref: Schoenfeld 2017b]. Morton et al. (2016) found that neither load nor systemic hormonal responses determined hypertrophy or strength gains once training was performed to failure [ref: Morton 2016]. Csapo and Alegre (2016) reached a compatible conclusion for moderate versus heavy loads in older adults [ref: Csapo 2016]. Lasevicius et al. (2018) equated volume load across 20%, 40%, 60% and 80% 1RM and found similar hypertrophy at 40–80%, with 20% 1RM inferior [ref: Lasevicius 2018]. Schoenfeld et al. (2021) re-examined loading recommendations and concluded that hypertrophy can be achieved across a broad loading spectrum provided sets are taken sufficiently close to failure [ref: Schoenfeld 2021].

**Why the rep bracket is nonetheless not meaningless.** Three reasons.

1. **Strength is load-specific.** Maximal strength gains favour heavier loads [ref: Schoenfeld 2017b]. A user whose goal is a 1RM should train heavy, and rep brackets encode that.
2. **Practicality and fatigue.** Very high-rep sets at low load produce substantial local fatigue and cardiovascular demand, and very low-rep sets at high load produce axial and connective-tissue stress. The bracket is a fatigue-management heuristic, which is a legitimate function.
3. **Technique.** Some exercises become unstable or injurious outside a rep range for reasons unrelated to hypertrophy (e.g. high-rep barbell back squats with loss of bracing).

**The measurement problem.** Nuzzo et al. (2024) meta-regressed 952 repetitions-to-failure tests from 7,289 individuals across 269 studies to characterise the repetitions–%1RM relationship. They report mean repetitions and, critically, the between-individual standard deviation at each percentage, with separate tables for bench press and leg press because the relationship differs by exercise. Sex, age and training status had little moderating influence [ref: Nuzzo 2024]. The practical reading: at any given %1RM there is a wide, exercise-dependent distribution of achievable repetitions. Any engine that converts reps to %1RM, or %1RM to reps, is operating inside that distribution and cannot be precise for an individual.

**Grade.** **A** for "load is not the primary determinant of hypertrophy when effort is matched". **A** for "heavier loads are superior for maximal strength". **B** for a broad 5–30 rep hypertrophy window. **D** for a narrow exercise-specific bracket asserted as optimal.

**→ FitHash implication.** `getHypertrophyRepBracket` returns brackets of 12–20, 10–15, 8–12 and 5–8 with archetype labels such as `'Makine & Kablo Bileşik (8-12 Reps)'`. The brackets are within the evidence-supported range and are reasonable defaults. The issue is the mechanism claim in the docstring — "scientifically validated hypertrophy rep bracket" — and the use of the bracket as if it were an outcome-optimising window rather than a fatigue-and-technique convention. Recommended: keep the values, change the framing to "default working range", and make the bracket a user-adjustable setting rather than a derived truth. Also avoid any UI that converts a completed set into a precise %1RM; if a percentage is shown, show a range.

---

### 3.3 Proximity to failure and the meaning of RIR

**Terminology first.** Steele et al. (2017) documented that "failure" and set endpoints are defined inconsistently across the resistance-training literature, which makes pooling difficult and comparisons hazardous [ref: Steele 2017]. "Momentary muscular failure", "set failure", "technical failure" and "velocity-loss threshold" are not interchangeable. Any claim about failure must specify which construct it means.

**Strength.** Davies et al. (2016) systematically reviewed failure versus non-failure training and found no meaningful strength advantage for training to failure [ref: Davies 2016]. Grgic et al. (2018b) found frequency effects were volume-mediated; the same volume logic applies here — the relevant variable is total effective work, not the endpoint per se [ref: Grgic 2018b]. Robinson et al. (2024) found that in all best-fit models for strength, the confidence intervals of the marginal slopes for estimated RIR contained the null [ref: Robinson 2024]. A 2025 randomised trial in trained men compared conditions differing in proximity to failure and found strength outcomes broadly similar across moderate-RIR conditions, with the closest-to-failure condition not superior and possibly slightly inferior; hypertrophy differences were unclear [ref: Robinson 2025].

**Hypertrophy.** Refalo et al. (2023) pooled 15 studies. Training to any definition of set failure conferred a trivial advantage over non-failure (ES 0.19, 95% CI 0.00–0.37, p = 0.045), with no moderating effect of volume load or relative load. Momentary muscular failure versus non-failure showed no advantage (ES 0.12, 95% CI −0.13–0.37). High (>25%) versus moderate (20–25%) velocity-loss thresholds also showed no advantage (ES 0.08, 95% CI −0.16–0.32). The authors concluded there is a likely non-linear relationship between proximity to failure and hypertrophy [ref: Refalo 2023]. Robinson et al. (2024) found hypertrophy slopes were negative and excluded the null — closer to failure was better — while cautioning that the analysis was exploratory and that RIR had to be estimated from study descriptions rather than measured [ref: Robinson 2024].

**Reconciling the two.** These are not contradictory. Refalo's categorical contrast asks whether *going to failure* beats *stopping short*, and finds little difference. Robinson's continuous model asks whether the *gradient* of proximity predicts size, and finds a small positive gradient. Both can be true if the curve is shallow and flattens near failure: moving from 5 RIR to 2 RIR helps a little; moving from 2 RIR to 0 RIR helps little and costs fatigue.

**How reliable is a self-reported RIR?** Zourdos et al. (2016) developed and validated the RIR-based RPE scale and showed it tracks velocity loss reasonably at the group level [ref: Zourdos 2016]. Helms et al. (2017) characterised RPE–velocity relationships in powerlifters across squat, bench and deadlift [ref: Helms 2017]. Helms et al. (2018) demonstrated that RPE-based autoregulation could regulate volume within a periodised programme [ref: Helms 2018]. Holmes et al. (2026) directly compared RIR and Borg RPE for predicting proximity to failure in 32 participants at 75% 1RM and found no significant difference in accuracy between methods — with both carrying error [ref: Holmes 2026]. A separate 2026 study concluded that velocity-based monitoring lacked both accuracy and applicability for estimating RIR in the hexagonal bar deadlift [ref: Chen 2026].

The consistent picture: RIR is a usable ordinal signal, with individual error typically of the order of one to two repetitions and systematic bias toward overestimating reserve in some populations and underestimating in others. It is not an interval-scale measurement.

**Grade.** **A** that failure training is not required for strength. **B** that failure training confers little average hypertrophy benefit and that hypertrophy is mildly proximity-sensitive. **C** for the precise shape of the RIR–hypertrophy curve. **C** for individual RIR accuracy.

**→ FitHash implication.** Two changes are warranted. First, RIR should be treated as an ordinal input in every calculation that consumes it. `calculateAutoregulatedE1RM` adds `clamp(rir, 0, 5)` to reps, which treats one unit of RIR as exactly one repetition of e1RM-equivalent work. That is a modelling assumption, not a measurement; it is acceptable for smoothing but should not be documented as physiologically grounded. Second, the RIR pill's cycle order (0 → 1 → 2 → 3 → unset) places failure first. Reordering to 3 → 2 → 1 → 0 would better reflect both the evidence (1–3 RIR captures most of the stimulus) and the app's own default (`defaultRir: 1`).

---

### 3.4 Frequency

**The claim under test.** Training a muscle more often per week produces more hypertrophy and strength at equal volume.

**Hypertrophy.** Schoenfeld et al. (2016b) meta-analysed frequency and found 2×/week superior to 1×/week for hypertrophy, while 3×/week could not be distinguished from 2×/week [ref: Schoenfeld 2016b]. Schoenfeld et al. (2019a) revisited the question and reached a similar conclusion with an explicit caveat that higher frequencies are most useful as a means of distributing higher volumes [ref: Schoenfeld 2019a].

**Strength.** Grgic et al. (2018b) reviewed frequency and strength and concluded that the apparent benefit of higher frequency was attributable to higher total volume; when volume was equated, frequency had no independent effect [ref: Grgic 2018b]. Colquhoun et al. (2018) compared training volume and frequency directly and concluded volume, not frequency, indicated maximal strength adaptations [ref: Colquhoun 2018].

**The current synthesis.** Pelland et al. (2026) modelled frequency explicitly. For hypertrophy, the posterior probability that the frequency slope exceeded zero was below 100%, indicating compatibility with a negligible effect. For strength, the posterior probability was 100%, indicating a positive but diminishing-returns relationship [ref: Pelland 2026]. This is the cleanest available statement: frequency is approximately irrelevant to size once volume is counted, and mildly positive for strength.

**Why practitioners still periodise frequency.** Practical ceilings on per-session volume, session duration, local fatigue and technique degradation mean that a given weekly volume is easier to accumulate across more sessions. That is a scheduling argument, not a physiological one, and it is the correct way to present it.

**Grade.** **A** that frequency is not an independent hypertrophy driver at equal volume. **B** that 2×/week is a reasonable floor for most muscles. **C** for any specific optimal frequency per muscle.

**→ FitHash implication.** The split architecture in `docs/MUSCLE_TAXONOMY_AND_SPLIT_ARCHITECTURE_SPEC.md` should be described as a volume-distribution mechanism. Any user-facing copy implying that a 6-day PPL "stimulates growth more" than a 4-day upper/lower at equal weekly sets is unsupported. The mesocycle volume ramp (`getMesocyclePhaseTarget`) is the right place to express frequency changes, because it changes volume and distribution together rather than asserting an independent frequency effect.

---

### 3.5 Rest intervals

**Strength.** Grgic et al. (2018a) systematically reviewed 23 studies with 491 participants and concluded that longer rest intervals favour strength gains, while noting that recommendations had largely been inferred from acute studies [ref: Grgic 2018a]. Schoenfeld et al. (2016a) randomised resistance-trained men to 1-minute versus 3-minute rest and found 3 minutes superior for both strength and hypertrophy [ref: Schoenfeld 2016a].

**Hypertrophy.** Singer et al. (2024) conducted a Bayesian meta-analysis of 9 studies and 19 measurements. Pooled standardised mean differences overlapped substantially across rest categories (short 0.48, longer 0.56). Controlled pairwise comparisons tended to favour longer rest for arm (0.13, 95% CrI −0.27 to 0.51) and thigh (0.17, 95% CrI −0.13 to 0.43), with whole-body estimates marginally favouring shorter rest (−0.08). The authors concluded there is a small benefit to resting more than 60 seconds, probably mediated by preserved volume load, but no appreciable difference beyond 90 seconds, with substantial heterogeneity [ref: Singer 2024].

**What this means practically.** The evidence supports a *floor*, not an optimum. Roughly 2 minutes for compound work and at least 60–90 seconds for isolation is defensible. Prescriptions of exactly 180 seconds for a specific exercise on a specific day are conventions.

**Grade.** **B** for "longer rest favours strength". **B** for "rest beyond ~90 s yields no detectable additional hypertrophy". **D** for per-exercise exact rest values.

**→ FitHash implication.** `calculateDynamicRestSeconds` computes `base × (1 + 0.15 × (3 − RIR)) × (1 + 0.10 × axialIndex)`, bounded to 45–360 seconds. The structure is sensible: it increases rest as sets get harder and as axial load rises. The coefficients are invented. Recommended: retain the formula as a default generator, present the output as a suggested starting timer rather than a prescription, expose a one-tap "more/less" adjustment, and never let the timer imply that the exact second count is physiologically required. The current `standardRestSeconds` values in `getBiomechanicalProfile` (75–180) are within the evidence-supported band.

---

### 3.6 Range of motion and muscle length

**Full versus partial.** Pallarés et al. (2021) meta-analysed ROM and found full ROM superior for strength (ES 0.56) and for lower-limb hypertrophy (ES 0.88), with less clear effects for upper-limb hypertrophy [ref: Pallarés 2021]. Wolf et al. (2023) found a trivial overall standardised mean difference of 0.12 favouring full ROM, and a non-significant point estimate of −0.28 (95% CI −0.81 to 0.16) for long-length partials versus full ROM — i.e. the data are compatible with a meaningful benefit for long-length partials and with no effect [ref: Wolf 2023].

**Lengthened partials specifically.** Pedrosa et al. (2022) found that partial ROM training performed at long muscle lengths produced favourable adaptations compared with shorter-length partials [ref: Pedrosa 2022]. Kassiano et al. (2023) found greater gastrocnemius hypertrophy after partial ROM at long lengths in calf training [ref: Kassiano 2023]. Maeo et al. (2021) found greater hamstring hypertrophy with seated versus prone leg curls, a comparison that confounds hip angle, muscle length and exercise choice [ref: Maeo 2021].

**Interpretation.** The strongest defensible statement is that full ROM should be the default because it is not inferior and is superior in several comparisons. The claim that long-length partials are *better* is plausible, exercise-specific, and supported by a small number of trials with heterogeneous designs. It is not yet a general rule.

**Grade.** **B** that full ROM is at least as good as partial ROM overall. **C** that long-length partials are superior, and only for specific exercises.

**→ FitHash implication.** The biomechanical profile assigns `resistanceProfile: 'LENGTHENED'` and a `stimulusMultiplier` between 1.05 and 1.40 based on exercise-name string matching. Two problems: the classification is a name heuristic rather than an observation, and the multiplier is applied as if it were a hypertrophy coefficient. Recommended: introduce an explicit, user-visible ROM tag per set (full / long-length partial / short-length partial) and use it for volume attribution and coaching copy. Do not infer ROM from the exercise name. Keep the multiplier for scheduling (rest, fatigue decay) where a rough ordinal is adequate.

---

### 3.7 Tempo and contraction duration

**Eccentric emphasis.** Roig et al. (2009) meta-analysed 20 RCTs comparing eccentric with concentric training. Eccentric training at higher intensities increased total and eccentric strength more, but the gains were specific to velocity and contraction mode, and the comparison confounded intensity with mode [ref: Roig 2009]. The often-repeated claim that a 4-second eccentric is superior for hypertrophy is not established by this literature.

**Eccentric duration.** Amdi and King (2025) meta-analysed 9 studies and 166 participants comparing shorter and longer eccentric phase durations. They found uncertain estimates for maximal strength and hypertrophy, and a practically worthwhile effect favouring shorter eccentrics for countermovement jump [ref: Amdi 2025]. In other words, tempo manipulation does not reliably change hypertrophy or strength within the ranges studied, and very slow tempos may compromise other qualities.

**What tempo is good for.** Tempo prescription is a useful *coaching* device: it standardises execution, prevents bouncing, and makes sets comparable across sessions. That is a measurement function, not a hypertrophy-optimisation function.

**Grade.** **B** that eccentric duration within ordinary ranges does not meaningfully change hypertrophy. **C** that very slow eccentrics are counterproductive. **D** for any specific tempo prescription asserted as optimal.

**→ FitHash implication.** FitHash does not currently implement a tempo engine, and on this evidence it should not. If tempo is added, it should be a per-exercise execution note and a set-comparability tag, not a stimulus multiplier.

---

### 3.8 Exercise selection, variation and specificity

**Variation.** Kassiano et al. (2022) systematically reviewed whether varying resistance exercises promotes superior hypertrophy and strength and found no clear evidence that variation per se is superior [ref: Kassiano 2022]. This is a useful corrective to the common coaching claim that exercises must rotate every few weeks.

**Selection matters, though.** Maeo et al. (2021) shows that two exercises for the same muscle can differ materially in hypertrophic effect depending on joint angle and muscle length [ref: Maeo 2021]. Pallarés et al. (2021) shows ROM within an exercise matters [ref: Pallarés 2021]. So *which* exercise and *how* it is performed matter more than *how often it is changed*.

**Specificity.** Strength adaptations are specific to the joint angle, velocity and contraction mode trained [ref: Roig 2009]. A user training a hack squat should not expect the carry-over to a barbell back squat that a naive e1RM comparison implies.

**Supervision and execution quality.** Coleman et al. (2023) found that supervision during resistance training positively influenced muscular adaptations in resistance-trained individuals [ref: Coleman 2023]. This is a proxy for execution quality — the variable no app can directly control but every app implicitly assumes.

**Grade.** **B** that exercise variation is not required for continued adaptation. **C** that specific exercise selection can materially change regional hypertrophy. **B** that supervised/standardised execution improves outcomes.

**→ FitHash implication.** `exerciseSubstitutionService` computes leverage ratios (barbell→dumbbell 0.42, dumbbell→barbell 2.2, machine→dumbbell 0.45) to suggest a starting weight when swapping exercises. These ratios are plausible engineering estimates with no published validation. They should be labelled as "starting estimate" in the UI, rounded coarsely (to the nearest 2.5 kg, as the code already does), and accompanied by a prompt to adjust after the first set. The substitution engine's real value is pattern matching and equipment availability, which is sound; the numeric transfer is the weak link.

---

### 3.9 Warm-up

**General warm-up.** Fradkin et al. (2010) meta-analysed the effects of warming up on physical performance and found small-to-moderate improvements, while explicitly noting that few well-conducted randomised trials existed [ref: Fradkin 2010]. McGowan et al. (2015) reviewed mechanisms — temperature, metabolism, neural readiness, post-activation potentiation — and concluded that active warm-up induces greater metabolic change than passive, without identifying an optimal structure [ref: McGowan 2015].

**Specific ramp sets.** No located trial compares a 50/70/85% ramp against alternative ramps (e.g. 40/60/80%, or fixed increments) for chronic strength or hypertrophy outcomes. The ramp is a convention derived from acute performance and safety reasoning. Its most defensible justification is injury-risk management and first-working-set quality, neither of which is well quantified.

**Grade.** **C** for general warm-up improving performance. **D** for any specific ramp percentage sequence.

**→ FitHash implication.** `WARMUP_RAMP = [0.5, 0.7, 0.85]` is a sensible default and should remain. It should be described in code comments and UI as a convention, not as an evidence-based protocol, and users should be able to edit or disable it. The more valuable warm-up feature is automatic ramp generation keyed to the working weight, which the code already does via `buildSetTargetPlan`; that is a usability win independent of the evidence grade.

---

### 3.10 Deloading and periodisation

**Definition.** A deload is a planned reduction in training stress — typically volume, intensity, or both — intended to permit recovery and dissipate fatigue. It is distinct from tapering before competition and from unplanned rest.

**Evidence for the practice.** Surveys show near-universal use and wide variation in implementation. De Marco et al. (2024) surveyed strength and conditioning coaches across sporting codes and found heterogeneity in duration, volume reduction and intensity reduction during planned deloads [ref: De Marco 2024]. Rogerson et al. (2024) surveyed strength and physique athletes and reported similar variability [ref: Rogerson 2024]. The existence of a practice is not evidence of its efficacy.

**Evidence for the effect.** Two recent trials are directly relevant.

- Coleman et al. (2024) examined a one-week deload during supervised resistance training. The deload did not impair hypertrophy, power or endurance, but reduced lower-body strength relative to a traditional progression [ref: Coleman 2024]. Read carefully: the deload was *not harmful* for size, and *possibly slightly harmful* for strength in that context.
- Pancar et al. (2026) examined deload periods placed at the midpoint or end of a programme in untrained men and found that reduced volume and frequency did not hinder hypertrophy or strength-endurance [ref: Pancar 2026].

Neither trial demonstrates that deloads *improve* outcomes relative to a well-programmed non-deload progression. The plausible reading is that a deload is a low-risk way to manage accumulated fatigue and schedule disruption, not a stimulus-enhancing intervention.

**The triggering problem.** There is no validated operational definition of a training plateau. A plateau is ordinarily inferred from stagnation in a performance metric over some number of sessions. The number of sessions, the metric, and the tolerance for noise are all arbitrary. Because e1RM estimates derived from rep-max equations carry individual error of several percent [ref: LeSuer 1997; ref: Nuzzo 2024; ref: Reynolds 2006], a "stagnation" defined as an e1RM delta of ≤0.05 kg is well inside measurement noise.

**Grade.** **C** that deloads are a low-risk fatigue-management tool. **D** for any specific trigger, duration, or magnitude. **D** for the claim that deloads enhance long-term hypertrophy.

**→ FitHash implication.** `detectPlateauAndDeload` compares session-best e1RM across up to four sessions, requires ≥3 consecutive stagnant intervals with a delta ≤0.05, and requires minimum RIR ≤1. When triggered, it prescribes −10% load, 50% sets and RIR 3. Every one of those numbers is a convention. The structural idea — detect stagnation, reduce stress — is sound. Recommended: (a) require a longer window or a larger threshold before declaring stagnation, because 0.05 kg is far below e1RM noise; (b) present the recommendation as a *suggestion* with the reasoning shown, never as an automatic programme change; (c) describe the deload as "a week of reduced stress" rather than "CNS and connective tissue recovery", which asserts a mechanism that has not been measured.

---

### 3.11 Progression models: load versus repetitions, and double progression

**The principle.** Progressive overload is the foundational training principle [ref: Kraemer 2004]. The open question is whether the *mode* of progression matters — adding load at constant reps versus adding reps at constant load.

**Direct trial.** Plotkin et al. (2022) randomised 43 resistance-trained participants to 8 weeks of load progression or repetition progression across four lower-body exercises. Rectus femoris growth modestly favoured repetition progression (adjusted estimate 2.8 mm, 90% CI −0.5 to 5.8); dynamic strength slightly favoured load progression (2.0 kg, 90% CI −2.4 to 7.8); no other notable between-group differences emerged. The authors concluded both are viable strategies [ref: Plotkin 2022]. The confidence intervals are wide and the trial was short, so this is Grade B evidence for equivalence, not proof of it.

**Double progression.** Double progression — hold a rep range, add reps to the top of the range, then add load and reset to the bottom — is a practitioner construct that operationalises both modes. No trial compares double progression against single-mode progression over a long horizon. It is Grade D as a named method, but it is a rational implementation of a Grade B finding (both modes work).

**Autoregulation.** Helms et al. (2018) showed that RPE-based autoregulation can regulate volume within a periodised programme in powerlifters [ref: Helms 2018]. Helms et al. (2020) reviewed methods for regulating and monitoring resistance training, including RIR, RPE and velocity [ref: Helms 2020]. The evidence supports autoregulation as a *within-session adjustment mechanism*; it does not support any particular autoregulation formula.

**Time efficiency.** Iversen et al. (2021) reviewed time-efficient programming and concluded that reduced-volume programmes can produce comparable hypertrophy when effort is high, which is consistent with the proximity-to-failure literature [ref: Iversen 2021]. This is important for a mobile product: a 30-minute session is not inherently inferior.

**Grade.** **B** that load progression and rep progression produce comparable outcomes over weeks. **D** for double progression as a specifically superior method. **B** that autoregulation is a legitimate volume-regulation strategy. **C** for specific autoregulation formulae.

**→ FitHash implication.** The DDP engine in `progressionEngine.ts` implements double progression with autoregulated adjustments. It is a sound implementation of a defensible practice, but the documentation should not claim it is "the gold-standard evidence-based" method. The strongest defensible claim is: "double progression operationalises two progression modes that trials find broadly equivalent, with autoregulation to keep effort in a productive range."

---

### 3.12 Estimating 1RM, and what a "PR" means

**Direct measurement.** Grgic et al. (2020) systematically reviewed the test–retest reliability of 1RM assessment and found generally high reliability in trained populations [ref: Grgic 2020]. A directly tested 1RM is a reasonably stable measurement, at the cost of substantial fatigue, skill demand and injury risk.

**Prediction from rep-max sets.** LeSuer et al. (1997) compared prediction equations for bench press, squat and deadlift and found meaningful error, with accuracy varying by equation and lift [ref: LeSuer 1997]. Reynolds et al. (2006) found the load–repetition relationship is non-linear and that 5RM data produced the best prediction accuracy, with separate equations needed for bench press and leg press; R² values for 10RM and 20RM predictions were lower than for 5RM [ref: Reynolds 2006]. Nuzzo et al. (2024) quantified between-individual variation in repetitions at a given %1RM and found it substantial and exercise-dependent [ref: Nuzzo 2024].

**Consequence.** An e1RM derived from a set of 12 at 2 RIR has wider error than an e1RM derived from a set of 3 at 1 RIR, and both have wider error than a tested 1RM. Treating all three as the same quantity — and comparing them as a time series — introduces noise that can easily exceed the effect being tracked.

**PR semantics.** A "personal record" is not one thing. At least four distinct records are commonly conflated:

1. **Load PR** — heaviest weight lifted for any reps.
2. **Rep PR** — most reps at a given weight.
3. **e1RM PR** — highest estimated 1RM from any set.
4. **Volume PR** — highest volume load in a session or exercise.

These can move in opposite directions. A user who adds reps at a lighter weight sets a rep PR and a volume PR while their e1RM PR falls. An app that surfaces a single "PR" badge without saying which record was set will, over time, tell users things that are not true.

**Grade.** **B** that direct 1RM is reliable in trained lifters. **B** that rep-max equations carry material individual error. **D** for any single "PR" construct without a stated type.

**→ FitHash implication.** `storage.ts` computes PRs using `calculateAutoregulatedE1RM(set.weight, reps, set.rir ?? 1)`. Two issues. First, the default `rir ?? 1` silently imputes 1 RIR for sets where the user did not record RIR, which biases e1RM upward for easy sets and downward for hard ones — and the bias is systematic across users who log RIR and users who do not. Second, the PR object stores `maxEstimatedOneRepMax` alongside `maxWeight`, `maxVolume` and speed records, but the UI presents PRs as a single concept. Recommended: (a) do not compute an e1RM PR from a set with unknown RIR — either skip it or widen the confidence interval; (b) label each PR by type wherever it is displayed; (c) store the source set (weight, reps, RIR) alongside the record so the claim is auditable.

---

### 3.13 Recovery and readiness monitoring

**What "recovery" is.** In the literature, recovery is inferred from performance restoration, subjective readiness, or biomarkers. It is not a single scalar, and there is no per-muscle "percentage recovered" measurement.

**Muscle damage and soreness.** Cheung et al. (2003) reviewed delayed-onset muscle soreness and reported that soreness typically peaks between 24 and 72 hours and resolves over several days, with large inter-individual variation [ref: Cheung 2003]. Damas et al. (2016) showed that resistance-training-induced muscle damage is high after early sessions but attenuates with repeated bouts, and that hypertrophy is related to myofibrillar protein synthesis after damage has attenuated [ref: Damas 2016]. Crucially, soreness is a poor proxy for either damage or readiness: it correlates weakly with performance decrement and is influenced by expectations and prior experience.

**Monitoring.** Saw et al. (2016) reviewed athlete monitoring and found subjective self-reported measures outperformed commonly used objective measures in detecting meaningful changes [ref: Saw 2016]. Halson (2014) reviewed training-load monitoring and emphasised the value of session-RPE and simple load metrics over complex indices [ref: Halson 2014]. Scott et al. (2016) reviewed monitoring specifically for resistance exercise and highlighted the practical difficulty of separating local from systemic fatigue [ref: Scott 2016].

**Sleep.** Craven et al. (2022) meta-analysed acute sleep loss and found an overall performance decrement of about 7.6%, with effects varying by task and time of day [ref: Craven 2022]. Knowles et al. (2018) reviewed inadequate sleep and muscle strength and found associations with poorer strength outcomes [ref: Knowles 2018]. Mah et al. (2011) found that sleep extension in collegiate basketball players improved sprint times and shooting accuracy [ref: Mah 2011]. The direction is consistent: sleep is a real moderator. The magnitude for resistance-training-specific outcomes is less certain than for aerobic and skill performance.

**Grade.** **D** for any per-muscle recovery percentage or half-life. **B** that subjective measures are useful monitoring inputs. **B** that sleep loss degrades performance. **C** for the specific effect of sleep on hypertrophy.

**→ FitHash implication.** `muscleRecoveryService` implements a Hill function with per-muscle half-lives of 24–54 hours, a lengthened-bias multiplier of 1.30, axial-load additions of 6–12 hours, soreness adjustments of −6 to +16 hours, and a volume penalty of 4% per hard set above five. The composite produces a number labelled `recoveryPercentage` that is displayed as a physiological state. It is not. Recommended: keep the visualisation — it is genuinely useful as a "recent load" display — but rename the concept in UI from recovery to something like "recent training stress" or "readiness estimate", and stop presenting a percentage as if it were measured. The Hill exponent of 2.4 and the half-lives should be documented as tuning parameters, not constants.

---

### 3.14 Concurrent training

**Interference.** Wilson et al. (2012) meta-analysed concurrent aerobic and resistance training and found that running, but not cycling, interfered with strength and hypertrophy, and that higher aerobic frequency and duration increased interference [ref: Wilson 2012]. Schumann et al. (2022) reviewed concurrent training for muscle size and function and found no compromise of hypertrophy or maximal strength, but attenuated explosive strength, particularly when both were performed in the same session [ref: Schumann 2022]. The two reviews are reconcilable: modality and volume determine whether interference occurs, and the effect is largest for explosive and high-velocity qualities.

**Sequencing.** Murlasits et al. (2018) meta-analysed concurrent training sequence and found strength-before-endurance ordering was better for lower-body 1RM strength [ref: Murlasits 2018]. Eddens et al. (2018) reviewed intra-session sequence and interference and reached compatible conclusions, with the effect concentrated in modalities and volumes that produce high peripheral fatigue [ref: Eddens 2018].

**Grade.** **B** that concurrent training does not inherently compromise hypertrophy. **B** that running interferes more than cycling. **B** that strength-before-endurance is preferable when both are performed. **C** for precise volume thresholds at which interference appears.

**→ FitHash implication.** FitHash logs cardio (`'Kardiyo'`) alongside resistance work but does not model interference. It should not attempt to. If cardio is scheduled on the same day as lower-body strength, a soft ordering hint ("önce ağırlık, sonra kardiyo") is supported by Grade B evidence and is cheap to implement. Anything more granular — modality-specific interference coefficients — would be fabrication.

---

### 3.15 Nutrition context and body composition

**Why this is in an exercise-science document.** Because the app's users are not training in a vacuum, and the expected rate of hypertrophy is bounded by energy availability and protein intake. A product that sets strength and size expectations without acknowledging this will systematically disappoint users in a deficit.

**Energy restriction and lean mass.** Weinheimer et al. (2010) reviewed energy restriction combined with exercise and found that exercise, particularly resistance training, attenuates lean-mass loss during restriction [ref: Weinheimer 2010]. Cava et al. (2017) reviewed muscle preservation during weight loss and concluded that diet-induced weight loss reduces muscle mass without necessarily reducing strength, that high protein intake helps preserve lean mass, and that resistance training is protective [ref: Cava 2017]. Helms et al. (2014) provided evidence-based recommendations for natural bodybuilding contest preparation, including moderate deficits, high protein, and resistance training retention [ref: Helms 2014]. These are reviews and position-style documents; the general direction is Grade B, the specific numbers Grade C/D.

**Body recomposition.** Barakat et al. (2020) reviewed whether trained individuals can gain muscle and lose fat simultaneously and concluded it is possible under specific conditions — sufficient protein, resistance training, adequate sleep, and either a small deficit or a surplus in untrained or higher-body-fat individuals [ref: Barakat 2020]. This is a narrative review; treat the conditions as plausible rather than established.

**Off-season nutrition.** Iraki et al. (2019) reviewed nutrition recommendations for bodybuilders in the off-season, emphasising adequate energy, protein distribution and carbohydrate availability [ref: Iraki 2019]. Again, narrative synthesis rather than trial evidence.

**Scale noise.** Bhutani et al. (2017) analysed two-week weight change under free-living conditions and found that short-term weight change includes substantial water and glycogen components, so scale movement over days is a poor index of tissue change [ref: Bhutani 2017]. This is directly relevant to any feature that trends body weight against training performance.

**Grade.** **B** that resistance training plus adequate protein preserves lean mass in a deficit. **C** for specific protein or deficit targets. **C** that body recomposition is achievable in trained lifters under favourable conditions. **B** that short-term scale weight is noisy.

**→ FitHash implication.** FitHash does not currently ingest nutrition data, and this document does not recommend building a nutrition tracker. The relevant implications are narrower: (a) any "expected progress" copy should be conditional on energy availability; (b) body-weight trend displays, if added, must smooth over at least seven days and should not react to daily values; (c) the app should not promise recomposition.

---

### 3.16 Behaviour change, adherence and self-monitoring

**The uncomfortable finding.** The effect sizes in §3.1–§3.9 are small to moderate. The effect sizes associated with adherence and self-monitoring are frequently larger, and they compound over time.

**Attrition.** Eysenbach (2005) described the "law of attrition" in eHealth trials: dropout is large, front-loaded, and systematically related to the intensity of the intervention [ref: Eysenbach 2005]. A feature that increases logging burden without increasing perceived value can reduce total benefit even if it improves the "correctness" of the programme.

**Self-monitoring.** Burke et al. (2011) systematically reviewed self-monitoring in weight loss and found consistent associations between self-monitoring frequency and better outcomes [ref: Burke 2011]. Brickwood et al. (2019) meta-analysed consumer wearable activity trackers and found modest but reliable increases in physical activity relative to non-tracker interventions [ref: Brickwood 2019]. Michie et al. (2009) meta-regressed behaviour-change technique effectiveness and identified self-monitoring combined with feedback as among the more effective techniques [ref: Michie 2009].

**Engagement design.** Klasnja and Pratt (2012) reviewed strategies for health behaviour-change interventions and emphasised actionable, timely, tailored information over dashboards [ref: Klasnja 2012]. This is design guidance rather than effect-size evidence, but it is consistent with the self-monitoring literature.

**Grade.** **A** that self-monitoring is associated with better behavioural outcomes. **B** that wearable feedback modestly increases activity. **B** that feedback plus self-monitoring outperforms either alone. **D** for any specific gamification mechanic.

**→ FitHash implication.** This is the largest gap between the product's scientific self-image and its actual leverage. FitHash invests heavily in physiological modelling and lightly in adherence instrumentation. Concretely: there is no streak or consistency metric tied to the evidence, no self-monitoring summary that closes the loop ("you logged 18 of 20 planned sets"), and no feedback loop that adjusts the plan based on adherence rather than performance. The recommendation in §5 (ES-09) is to instrument adherence and make it a first-class signal, because on this evidence it dominates.

---

### 3.17 Wearable and Health Connect data quality

**Heart rate.** Shcherbina et al. (2017) evaluated wrist-worn devices against ECG and indirect calorimetry and found heart-rate error varied substantially by device and activity intensity, with larger errors during higher-intensity and non-steady-state activity [ref: Shcherbina 2017]. Dooley et al. (2017) compared self-monitoring heart-rate devices at exercise intensities and found acceptable accuracy for some devices and poor accuracy for others [ref: Dooley 2017].

**Energy expenditure.** O'Driscoll et al. (2020) systematically reviewed activity monitors' energy-expenditure estimates and found wide error bounds, with no device reliably accurate across individuals and activities [ref: O'Driscoll 2020]. Energy-expenditure estimates from wearables should be treated as ordinal at best.

**Steps.** Case et al. (2015) compared smartphone applications and wearable devices for step counting and found substantial between-device variation, with some devices missing large fractions of steps [ref: Case 2015].

**Implication for FitHash.** The Health Connect integration reads steps, active calories, total calories and distance. Steps are the most reliable of these; calories are the least. Wear OS sync carries workout state and rest timers, not physiological measurement.

**Grade.** **B** that step counts are reasonably accurate but device-dependent. **B** that heart rate is usable at rest and unreliable at intensity extremes. **B** that energy expenditure estimates are inaccurate. **D** for any inference of training readiness from wearable heart rate alone.

**→ FitHash implication.** Do not display wearable-derived calorie numbers as precise values, and do not use them to adjust training recommendations. If calories are shown, present them as a range or with a "~" and a one-line explanation. Do not infer RIR, readiness or recovery from heart rate; the evidence does not support it, and the app already asks the user directly.

---

### 3.18 Synthesis: what the evidence licenses FitHash to claim

The table below is the bridge between the review and the audit. For each user-facing claim, it states the strongest defensible version and the grade.

| FitHash claim or feature | Strongest defensible statement | Grade |
|---|---|---|
| "Train each muscle 10–20 sets per week" | More weekly sets produce more hypertrophy with diminishing returns; 10–20 is a reasonable default band for intermediates | A (direction), B (band) |
| "MEV / MAV / MRV" | Useful organising metaphors for low, productive and high volume | D |
| "8–12 reps for hypertrophy" | Hypertrophy occurs across a wide load range when effort is high; 8–12 is a practical default | B |
| "Leave 1–2 reps in reserve" | Most of the stimulus is captured without going to failure; failure adds fatigue with little average benefit | B |
| "RIR 0 for maximum stimulus" | Not supported; 0 RIR may be slightly inferior for strength | B (against) |
| "Train each muscle 2×/week" | 2×/week is a reasonable floor and helps distribute volume | B |
| "Rest 2–3 minutes between compound sets" | Longer rest favours strength; hypertrophy benefit plateaus beyond ~90 s | B |
| "Full range of motion" | Full ROM is at least as good as partial, and superior in several comparisons | B |
| "Lengthened partials are superior" | Plausible and exercise-specific; not established as a general rule | C |
| "Slow eccentrics build more muscle" | Not supported within ordinary tempo ranges | B (against) |
| "Deload every 4–6 weeks" | Low-risk fatigue management; no demonstrated enhancement of hypertrophy | C |
| "Your e1RM is 102.4 kg" | An estimate with several percent individual error | B (that it is an estimate) |
| "This muscle is 63% recovered" | Not a measurable physiological quantity | D |
| "Your readiness score is 71" | Only defensible if built from self-report and framed as a prompt, not a measurement | D |
| "Wearable says you burned 480 kcal" | Ordinal at best; wide individual error | B (against precision) |

The pattern is consistent. The evidence licenses *directional* and *range* claims, and FitHash's UI frequently renders them as *point* claims. The remediation is therefore mostly a matter of precision language, defaults, and disclosure rather than algorithmic change — with a small number of substantive changes (RIR default, PR semantics, volume attribution) where the current behaviour is actively misleading.

---

## 4. Implementation audit

This section maps the evidence findings onto the current codebase. Line references are to the repository state at the time of writing (2026-11-24) and will drift; each finding therefore names the function as well as the line.

### 4.1 Audit table

Severity is product risk, not code risk: **High** means the product currently makes a claim the evidence contradicts or cannot support in a way a user could reasonably rely on; **Medium** means the framing overstates precision; **Low** means the issue is documentation or copy only.

| ID | Surface | Anchor | What the code asserts | Evidence verdict | Grade | Severity | Backlog |
|---|---|---|---|---|---|---|---|
| AUD-01 | e1RM model | `src/utils/e1rm.ts:1`, `:11`, `:23` | Effective reps = reps + clamp(RIR, 0, 5); Epley to 10 effective reps, then a damped Lombardi tail | The piecewise model is a reasonable smoother; "effective reps" threshold and the 0.10 exponent are not empirically derived | D | Medium | ES-01 |
| AUD-02 | PR detection | `src/services/storage.ts:364`, `:463` | `calculateAutoregulatedE1RM(weight, reps, rir ?? 1)` decides e1RM PRs | Imputing 1 RIR for unrecorded sets biases e1RM; a single "PR" conflates four record types | B (estimation error), D (PR semantics) | High | ES-02 |
| AUD-03 | Deload trigger | `src/services/progressionEngine.ts:221`, `:258–275` | Stagnation when e1RM delta ≤0.05 over ≥3 sessions with min RIR ≤1; deload = −10% load, 50% sets, RIR 3 | No validated plateau definition; 0.05 kg is far inside e1RM noise; magnitude is convention | D | High | ES-04 |
| AUD-04 | Volume landmarks | `src/services/progressionEngine.ts:667`, `:698–716` | Five bands at 6/10/19/22 hard sets, labelled MEV/MAV/MRV | Direction supported; cut-points are practitioner constructs | A (direction), D (values) | High | ES-03 |
| AUD-05 | Volume attribution | `src/services/progressionEngine.ts:686–694` | Counts a set only under the exercise's primary `category` | Pelland et al. (2026) found fractional attribution of indirect sets outperforms total or direct-only counting | B | Medium | ES-16 |
| AUD-06 | Recovery model | `src/services/muscleRecoveryService.ts:17`, `:49`, `:92` | Hill curve, β = 2.4, per-muscle half-lives 24–54 h, 168 h cap | No validated per-muscle recovery half-life or Hill exponent; a percentage is not a measurement | D | High | ES-05 |
| AUD-07 | Recovery volume penalty | `src/services/muscleRecoveryService.ts:194–197` | Each hard set above 5 in the 7-day window adds 4% to effective half-life; comment says 5% | No empirical basis for the coefficient; comment and code disagree; the 7-day window mixes sessions | D | Medium | ES-05 |
| AUD-08 | Warm-up ramp | `src/services/progressionEngine.ts:319`, `:332–368` | `WARMUP_RAMP = [0.5, 0.7, 0.85]`, applied to warm-up rows in order | No trial compares ramps; general warm-up has weak positive support | C (warm-up), D (ramp) | Low | ES-06 |
| AUD-09 | Hypertrophy rep brackets | `src/services/progressionEngine.ts:48–165` | Name/equipment string matching returns 12–20, 10–15, 6–10, 5–8, 8–12 with archetype labels | Brackets sit inside the evidence-supported range; the docstring calls them "scientifically validated" | B (range), D (specificity) | Medium | ES-07 |
| AUD-10 | Biomechanical profiles | `src/services/progressionEngine.ts:832–993` | String-matched `axialLoadingIndex`, `resistanceProfile`, `stimulusMultiplier` 1.05–1.40, rest 60–180 s | Axial load and rest values are plausible; the stimulus multiplier is not a hypertrophy coefficient | C/D | Medium | ES-08 |
| AUD-11 | RIR input | `src/screens/ActiveWorkoutModal.tsx:526–554`; `src/services/settings.ts:19`, `:31` | RIR pill cycles 0→1→2→3→unset; default RIR 1 | 1–3 RIR captures most of the stimulus; 0 RIR is not a sensible first option; RIR is ordinal | B | Medium | ES-01 |
| AUD-12 | Rest timer | `src/screens/ActiveWorkoutModal.tsx:662`; `src/services/progressionEngine.ts:1006` | `base × (1 + 0.15×(3−RIR)) × (1 + 0.10×axial)`, clamped 45–360 s | Structure is sound; coefficients are invented; evidence supports a floor near 90–120 s | B (floor), D (coefficients) | Low | ES-11 |
| AUD-13 | Exercise substitution load | `src/services/exerciseSubstitutionService.ts:134–150` | Leverage ratios (barbell→dumbbell 0.42, dumbbell→barbell 2.2, machine→dumbbell 0.45) to seed a starting weight | No published validation; useful as a coarse starting estimate only | D | Medium | ES-08 |
| AUD-14 | Heatmap weekly target | `src/components/MuscleRecoveryHeatmap.tsx:31–41`; `src/screens/AnalyticsTab.tsx:207`, `:246–247` | `RP_WEEKLY_SET_TARGET` of 10–14 per muscle drives a progress ring | Reasonable defaults; presented as targets with no uncertainty | B (band), D (exact) | Low | ES-03 |
| AUD-15 | Strength overview scoring | `src/utils/strengthMetrics.ts:204–210`, `:382–390` | Equipment-weight multipliers (barbell 1.12, dumbbell 1.06, bodyweight 1.04) feed a composite strength score | Unvalidated weighting; the score has no external referent | D | Medium | ES-08 |
| AUD-16 | Wearable calories | `src/services/healthConnectService.ts:388–470` | Reads steps, active calories, total calories, distance | Steps reasonably accurate; energy expenditure inaccurate | B (against precision) | Medium | ES-13 |

### 4.2 Detailed findings

**AUD-01 — e1RM piecewise model.** The model is internally consistent and avoids the discontinuity that a pure Epley formula produces at the 10-rep boundary, which is a genuine engineering improvement. The problem is epistemic, not mathematical: the comment block presents "effective reps = reps + RIR" and the 0.10 exponent as if both were derived. Neither is. The model should stay, be documented as a smoothing heuristic with a stated error band, and stop being described as an effective-reps implementation. See ES-01.

**AUD-02 — PR detection.** This is the highest-severity item in the audit, for a specific reason: `set.rir ?? 1` means a set with no RIR is treated as if it were taken to 1 RIR. A user who never logs RIR will have every set inflated by one effective rep. A user who logs RIR honestly will not. The two users therefore have systematically different e1RM scales, and their PRs are not comparable — including with their own history if they change logging habits. Combined with the single-PR presentation, this produces false "new PR" events. See ES-02.

**AUD-03 — Deload trigger.** `detectPlateauAndDeload` requires `(current.maxE1rm - prev.maxE1rm) <= 0.05` across three consecutive intervals. Given that a single e1RM estimate from a 10-rep set carries error plausibly in the 3–8% range [ref: LeSuer 1997; ref: Nuzzo 2024], a 0.05 kg threshold on an e1RM near 100 kg is roughly 0.05% — two orders of magnitude below the noise floor. In practice the trigger fires not on stagnation but on the absence of a rounded-up session best. The deload prescription itself (−10% load, 50% sets, RIR 3) is conventional and harmless; the *claim* that the app has detected stagnation is the problem. See ES-04.

**AUD-04 — Volume landmarks.** The five-band classifier is the most visible place where a heuristic is rendered as a measurement. Two specific issues beyond the cut-points. First, the bands are asymmetric: `>= 22` is `'Aşırı Yükleme (>22 Set / Overtraining Riski)'`, which asserts an overtraining risk that the volume literature does not establish at 22 sets. Second, `(s.rir === undefined || s.rir <= 3)` counts sets with no recorded RIR as hard sets, which inflates volume for users who do not log RIR — the opposite of the conservative choice. See ES-03.

**AUD-05 — Volume attribution.** The current implementation credits a set only to the exercise's `category`. A bench press credits chest but not triceps or front delts. Pelland et al. (2026) specifically tested attribution schemes and found the fractional scheme fitted best, which validates the architecture proposed in `docs/MUSCLE_TAXONOMY_AND_SPLIT_ARCHITECTURE_SPEC.md` §3 [ref: Pelland 2026]. The specific weights in that spec are still Grade D, but the direction is now Grade B. This is a case where the existing spec is ahead of the shipped code. See ES-16.

**AUD-06 / AUD-07 — Recovery model.** The Hill function is a smooth, monotonic decay with an adjustable shape parameter, which is a reasonable way to draw a decaying curve. It is not a model of recovery. Three specific overstatements: the per-muscle half-lives are not measured; the β = 2.4 "sigmoidal biological repair curve" description implies a fitted parameter; and the 4% volume penalty is a tuning constant with a comment that states 5%. If the visualisation is retained, the percentage should be relabelled and the parameters exposed as configuration with a comment stating they are tuning values, not estimates. See ES-05.

**AUD-08 — Warm-up ramp.** Low severity and easy to fix. The ramp is a useful default. The change is documentary: remove any implication of validation, allow editing, and note that the first warm-up set at 50% may be unnecessary for low-load isolation exercises.

**AUD-09 — Rep brackets.** The brackets themselves are defensible. The docstring's claim of scientific validation is not, and the brackets are applied as a derived truth rather than a default. The deeper issue is that a name-matching classifier will misclassify exercises the library does not anticipate, and there is no user override. See ES-07.

**AUD-10 — Biomechanical profiles.** The axial loading index is a sensible ordinal (0–3) and the rest values are within the evidence-supported band. The `stimulusMultiplier` is the weak element: it is used both as a fatigue/scheduling hint and, implicitly, as a statement about hypertrophic stimulus. Those should be separated. String matching also produces known misclassifications (any exercise containing "press" matches the low-axial compound branch). See ES-08.

**AUD-11 — RIR input.** The cycle order is the issue. Because 0 is the first option after warm-up, the interaction design nudges users toward failure, which the evidence treats as at best neutral and possibly slightly inferior for strength [ref: Robinson 2024; ref: Robinson 2025]. Reordering to start at 3 and end at 0, with 1–2 as the visual midpoint, would align the UI with the evidence at zero engineering cost. See ES-01.

**AUD-12 — Rest timer.** The formula produces plausible values and the clamp prevents absurdity. The recommendation is presentational: a suggested timer that the user can extend, not a prescription. Enforcing a floor of 90 seconds for compound movements would be consistent with Singer et al. (2024) [ref: Singer 2024].

**AUD-13 — Substitution load.** The leverage ratios are guesses with plausible magnitudes. The risk is that users treat the seeded weight as authoritative, perform a set far from failure, and conclude the exercise is ineffective. The fix is presentational and behavioural: show the estimate as a range, require a first-set adjustment, and record whether the user accepted or overrode it.

**AUD-14 — Heatmap targets.** `RP_WEEKLY_SET_TARGET` names its provenance (RP) in the identifier, which is honest internally but not surfaced to users. The values (10–14) sit in the middle of the evidence-supported band, so they are reasonable. The issue is that a progress ring implies a target has been met or missed, when the underlying relationship is continuous and individual. See ES-03.

**AUD-15 — Strength overview score.** `getEquipmentStrengthWeight` multiplies e1RM by 1.12 for barbell, 1.06 for dumbbell and 1.04 for bodyweight before combining with recency and frequency into a composite score. No external validation exists for this weighting, and the resulting number is not comparable across users in any meaningful way. If the score is used only for internal ranking of recent lifts, that is fine; if it is displayed as a strength metric, it overstates. See ES-08.

**AUD-16 — Wearable calories.** Reading Health Connect data is reasonable; displaying active-calorie estimates as exact numbers is not. O'Driscoll et al. (2020) found wide error bounds across devices [ref: O'Driscoll 2020], and Shcherbina et al. (2017) found device-dependent error that grows with intensity [ref: Shcherbina 2017]. See ES-13.

### 4.3 Cross-cutting observations

1. **Precision language is the dominant defect class.** Ten of sixteen findings are about rendering an estimate as a measurement, not about a wrong algorithm.
2. **The RIR default is load-bearing and undocumented.** `rir ?? 1` appears in e1RM, PR, plateau, recovery and strength-score paths. Changing it is a product decision with wide blast radius and should be handled as one change, not five.
3. **Two specs are ahead of the code.** Fractional volume attribution and ROM tagging are specified but not shipped. Both have better evidence than several shipped features.
4. **Nothing in the audit concerns the core loop.** Logging sets, computing volume, showing history — all sound. The defects concentrate in the interpretive layer that converts logs into claims.

---

## 5. Backlog

Items are ordered by expected user-facing value per unit of risk. Each item states the problem, the evidence basis, the change, acceptance criteria, and the grade the product can claim after the change. Effort is a rough t-shirt size for a single engineer familiar with the codebase.

### 5.1 Sequencing and dependency map

The sixteen items are not independent. Four waves keep risk low and avoid rework.

| Wave | Items | Rationale | Exit criterion |
|---|---|---|---|
| **Wave 1 — Honesty** | ES-01, ES-02, ES-03, ES-04, ES-05 | These fix the four High-severity audit findings and the RIR default that all of them depend on. They are mostly language and default changes with one shared data-model change (RIR provenance). | No High-severity audit item remains open; no user-facing string asserts a validated landmark or a measured recovery percentage. |
| **Wave 2 — Framing** | ES-06, ES-07, ES-08, ES-11, ES-13 | These convert remaining point-claims into conventions and suggestions. Low engineering risk, high perceived-honesty return. | Every computed metric has either a range or an info entry point. |
| **Wave 3 — Accuracy** | ES-10, ES-16, ES-12 | These add data the model currently lacks (ROM, fractional attribution, smoothed body weight). They depend on Wave 1 relabelling so that better numbers are not presented with the old false precision. | Fractional and direct volume both available; ROM tag shipped; body-weight trend smoothed. |
| **Wave 4 — Leverage** | ES-09, ES-14, ES-15 | Adherence instrumentation, ordering hints and the disclosure surface. ES-09 is the largest item and the one with the strongest evidence base; it should not be blocked behind cosmetic work. | Adherence is computed, surfaced and fed back into plan sizing. |

Two sequencing notes.

- **ES-01 is the keystone.** PR detection, plateau detection, recovery and strength scoring all consume RIR. Changing its semantics once is cheaper than changing it four times, and the acceptance criteria for ES-02 and ES-04 depend on it.
- **ES-15 should be built incrementally, not at the end.** Each wave should ship its own info sheet entry. Deferring all disclosure to a final wave guarantees that the copy will be written in a hurry against a moving UI.

### ES-01 — Make RIR an ordinal input everywhere

**Priority:** P0. **Effort:** M. **Depends on:** none. **Audit:** AUD-01, AUD-11.

**Problem.** RIR is treated as interval-scaled in `calculateAutoregulatedE1RM` (one RIR = one effective rep), imputed as 1 when missing in PR and plateau paths, and presented with failure as the first option in the set-row cycle.

**Evidence.** RIR is usable at the group level and noisy at the individual level; 1–3 RIR captures most of the hypertrophic stimulus, and 0 RIR may be slightly inferior for strength [ref: Refalo 2023; ref: Robinson 2024; ref: Robinson 2025; ref: Holmes 2026; ref: Zourdos 2016].

**Change.**
1. Reorder the RIR cycle in `ActiveWorkoutModal.tsx` to `3 → 2 → 1 → 0 → unset`.
2. Replace `set.rir ?? 1` with an explicit branch: if RIR is undefined, compute e1RM but mark the record `estimatedWithoutRir: true` and exclude it from PR comparison.
3. Document the e1RM function as a smoothing heuristic with a stated error band in the docstring.

**Acceptance criteria.**
- A set logged without RIR cannot produce a "new PR" badge.
- The set-row cycle reaches 1 RIR in one tap from unset.
- e1RM values for identical weight/reps differ by type of RIR input in a way that is documented and unit-tested.
- No user-facing copy describes RIR as a precise measurement.

**Claim after change.** "Log how hard each set felt; we use it to keep your effort in a productive range." Grade B.

---

### ES-02 — Separate and label PR types

**Priority:** P0. **Effort:** M. **Depends on:** ES-01. **Audit:** AUD-02.

**Problem.** `maxWeight`, `maxEstimatedOneRepMax`, `maxVolume` and speed/distance records are stored together and surfaced as a single "PR". High-rep e1RM PRs can be inflated by the RIR imputation and by estimation error.

**Evidence.** Rep-max equations carry material individual error, larger at higher reps [ref: LeSuer 1997; ref: Reynolds 2006; ref: Nuzzo 2024]. Direct 1RM is reliable [ref: Grgic 2020]. Different record types can move in opposite directions.

**Change.**
1. Add a `prType` discriminator (`load | reps | e1rm | volume | speed | distance`) to the record and to the event emitted on completion.
2. Store the source set (`weight`, `reps`, `rir`, `date`) on every record.
3. Where a PR is displayed, render the type explicitly ("En ağır set", "Tahmini 1RM", "Hacim rekoru").
4. Suppress e1RM PRs derived from sets with `reps > 12` or missing RIR from prominent celebration surfaces; keep them in history.

**Acceptance criteria.**
- Every PR badge names its type.
- A PR record can be traced to the exact set that produced it.
- Recalculating all PRs after a code change produces identical results (golden-file test).

**Claim after change.** "Rekorların türüne göre ayrı takip edilir." Grade B.

---

### ES-03 — Relabel and widen volume landmarks

**Priority:** P0. **Effort:** S. **Depends on:** none. **Audit:** AUD-04, AUD-14.

**Problem.** Five hard-coded bands at 6/10/19/22 sets are labelled MEV/MAV/MRV and one band asserts "Overtraining Riski". Sets with no RIR count as hard sets. Exact per-muscle targets drive a progress ring.

**Evidence.** Volume increases hypertrophy with diminishing returns [ref: Schoenfeld 2017a; ref: Schoenfeld 2019b; ref: Pelland 2026]. No validated landmark values exist. No trial establishes harm at 22 sets.

**Change.**
1. Replace the band labels with descriptive Turkish copy: `'Düşük hacim'`, `'Orta hacim'`, `'Yüksek hacim'`, `'Çok yüksek hacim'`, and remove the overtraining assertion.
2. Treat unrecorded RIR conservatively: do not count as a hard set, but show "RIR girilmemiş N set" alongside.
3. Widen the displayed band to an interval and add a one-line note that the ranges are population defaults, not personal thresholds.
4. Change `RP_WEEKLY_SET_TARGET` progress rings from "target met" to a neutral range indicator.

**Acceptance criteria.**
- No user-facing string contains "MEV", "MAV", "MRV" or "Overtraining".
- A user with 25 sets sees "Çok yüksek hacim", not a risk warning.
- Sets without RIR are counted separately and visibly.

**Claim after change.** "Haftalık set sayını takip et; aralıklar genel bir başlangıç noktasıdır." Grade A/B.

---

### ES-04 — Harden the plateau and deload trigger

**Priority:** P0. **Effort:** M. **Depends on:** ES-01. **Audit:** AUD-03.

**Problem.** Stagnation is declared on a 0.05 kg e1RM delta across three sessions, well inside estimation noise. The deload is then presented as a detected physiological state.

**Evidence.** No validated plateau definition. Deloads are low-risk fatigue management without demonstrated enhancement [ref: Coleman 2024; ref: Pancar 2026; ref: De Marco 2024; ref: Rogerson 2024].

**Change.**
1. Require either four consecutive stagnant sessions, or a stagnation effect larger than a stated noise band (e.g. best e1RM below the rolling median by more than the inter-session SD).
2. Require that the sessions contain at least one top set within the bracket (so that stagnation is not an artefact of easy sets).
3. Present as `'Toparlanma haftası önerisi'` with the reasoning shown ("4 seanstır aynı e1RM bandındasın"), never as an automatic change.
4. Keep −10% / 50% / RIR 3 as the default suggestion but make all three editable.

**Acceptance criteria.**
- Synthetic data with normal session-to-session noise does not trigger a deload.
- Synthetic data with a genuine 8-week plateau does trigger one.
- The suggestion card states the observed evidence and offers accept/dismiss.
- No copy claims CNS or connective-tissue recovery as a measured outcome.

**Claim after change.** "Uzun süre ilerleme durduğunda hafif bir hafta öneririz." Grade C.

---

### ES-05 — Reframe the recovery surface

**Priority:** P1. **Effort:** M. **Depends on:** none. **Audit:** AUD-06, AUD-07.

**Problem.** `recoveryPercentage` is presented as a physiological measurement. The half-lives, the Hill exponent and the volume-penalty coefficient are tuning constants, one of which contradicts its own comment (4% in code, 5% in comment).

**Evidence.** No validated per-muscle recovery half-life. Soreness is a poor proxy for readiness [ref: Cheung 2003; ref: Damas 2016]. Subjective monitoring outperforms objective indices [ref: Saw 2016; ref: Halson 2014; ref: Scott 2016].

**Change.**
1. Rename the user-facing concept from "recovery" to "son yüklenme" or "toparlanma tahmini", and the percentage to a three-state band (`'Dinlenmiş'`, `'Orta'`, `'Yüklenmiş'`).
2. Fix the comment/code mismatch and move all coefficients into a single documented config object with a header stating they are tuning values.
3. Add an optional one-tap readiness check (energy, soreness, sleep) that overrides the model when the user provides it.

**Acceptance criteria.**
- No user-facing percentage is labelled "recovery".
- All coefficients live in one exported config with a docstring.
- A user-provided readiness input visibly changes the displayed state.
- Unit tests assert the band boundaries.

**Claim after change.** "Son antrenmanlarının yükünü gösterir; kesin bir toparlanma ölçümü değildir." Grade B for the display, no physiological claim.

---

### ES-06 — Make the warm-up ramp an editable convention

**Priority:** P2. **Effort:** S. **Depends on:** none. **Audit:** AUD-08.

**Problem.** The 50/70/85% ramp is fixed, unlabelled as a convention, and applied uniformly including to low-load isolation exercises.

**Evidence.** General warm-up has weak positive support; no ramp comparison exists [ref: Fradkin 2010; ref: McGowan 2015].

**Change.**
1. Keep the default values; add a settings toggle and per-exercise override.
2. Skip ramp generation for exercises whose working weight is below a threshold (e.g. under 20 kg), where a 50% set is meaningless.
3. Update the docstring to "convention, not validated protocol".

**Acceptance criteria.**
- A user can disable automatic warm-up rows.
- Exercises below the threshold receive one warm-up row or none, not three.
- No copy claims the ramp is evidence-based.

**Claim after change.** "Isınma setlerini otomatik öneririz; istediğin gibi düzenleyebilirsin." Grade C/D, honestly stated.

---

### ES-07 — Treat rep brackets as adjustable defaults

**Priority:** P1. **Effort:** S. **Depends on:** none. **Audit:** AUD-09.

**Problem.** `getHypertrophyRepBracket` is documented as "scientifically validated" and applied as a derived truth with no override.

**Evidence.** Hypertrophy occurs across a wide load range at high effort; brackets are fatigue and technique conventions [ref: Schoenfeld 2017b; ref: Morton 2016; ref: Lasevicius 2018; ref: Schoenfeld 2021; ref: Nuzzo 2024].

**Change.**
1. Reword the docstring and any UI copy: "default working range", not "validated bracket".
2. Allow a per-exercise rep-range override stored on the exercise.
3. When the user's logged reps consistently fall outside the bracket but e1RM is rising, do not flag it as an error.

**Acceptance criteria.**
- Overrides persist and are respected by the overload engine.
- No user-facing string contains "scientifically validated".
- An out-of-bracket but progressing user receives no warning.

**Claim after change.** "Varsayılan çalışma aralığı; hedefine göre değiştirebilirsin." Grade B.

---

### ES-08 — Scope the biomechanical multipliers to scheduling

**Priority:** P1. **Effort:** M. **Depends on:** none. **Audit:** AUD-10, AUD-13, AUD-15.

**Problem.** `stimulusMultiplier`, leverage ratios and equipment-strength weights are undocumented heuristics used in contexts that imply measurement.

**Evidence.** Axial load and rest are plausible ordinals; no validation exists for load-transfer ratios or composite strength weights [ref: Roig 2009; ref: Pallarés 2021; ref: Coleman 2023].

**Change.**
1. Rename `stimulusMultiplier` to `fatigueScheduleMultiplier` and restrict its use to rest and decay, not to any displayed stimulus claim.
2. Present substitution weights as a range ("başlangıç: 20–25 kg") and require a post-set adjustment prompt.
3. Either remove the composite strength score from user-facing surfaces or label it "göreceli sıralama" and document that it is not comparable across users.

**Acceptance criteria.**
- No UI element derives a hypertrophy claim from `stimulusMultiplier`.
- Substitution shows a range, not a point.
- The strength score, if shown, carries a one-line caveat.

**Claim after change.** Internal heuristics used for scheduling, with no external scientific claim. Grade D, disclosed.

---

### ES-09 — Instrument adherence as a first-class signal

**Priority:** P1. **Effort:** L. **Depends on:** none. **Audit:** none (gap).

**Problem.** The product has no adherence metric, no self-monitoring feedback loop, and no plan adjustment based on adherence rather than performance.

**Evidence.** Self-monitoring is among the most consistently effective behaviour-change techniques [ref: Burke 2011; ref: Michie 2009]. Attrition is large and front-loaded [ref: Eysenbach 2005]. Wearable feedback modestly increases activity [ref: Brickwood 2019].

**Change.**
1. Define adherence as completed working sets ÷ planned working sets over a rolling 28 days, plus session frequency.
2. Surface it weekly with a single actionable sentence, not a dashboard.
3. Feed adherence into plan generation: if adherence is below a threshold, reduce planned volume before adding intensity.

**Acceptance criteria.**
- Adherence is computed and stored without additional user input.
- A user below threshold receives a smaller plan, not a scolding.
- The weekly summary is one sentence plus one action.

**Claim after change.** "Planın, gerçekte ne kadarını yapabildiğine göre uyarlanır." Grade A/B.

---

### ES-10 — Add explicit ROM tagging

**Priority:** P2. **Effort:** M. **Depends on:** none. **Audit:** AUD-10 (related).

**Problem.** ROM is inferred from exercise name and never recorded, so volume and stimulus cannot distinguish full from partial work.

**Evidence.** Full ROM is at least as good as partial and superior in several comparisons [ref: Pallarés 2021; ref: Wolf 2023]; long-length partials are promising and exercise-specific [ref: Pedrosa 2022; ref: Kassiano 2023].

**Change.**
1. Add an optional per-set ROM tag: `full | long_partial | short_partial`.
2. Default to `full` and require no interaction.
3. Use the tag in coaching copy and in volume attribution, not in e1RM.

**Acceptance criteria.**
- Tagging is optional and does not slow set entry.
- Tagged sets are distinguishable in history and export.
- Unspecified sets are treated as full ROM for display.

**Claim after change.** "Tam hareket açıklığı varsayılan; uzatılmış kısmi tekrarları işaretleyebilirsin." Grade B/C.

---

### ES-11 — Turn the rest timer into a suggestion with a floor

**Priority:** P2. **Effort:** S. **Depends on:** none. **Audit:** AUD-12.

**Problem.** The timer presents an exact computed value as a prescription, with a 45-second lower bound that is below the evidence-supported floor for compound work.

**Evidence.** Longer rest favours strength; hypertrophy benefit flattens beyond ~90 s [ref: Grgic 2018a; ref: Schoenfeld 2016a; ref: Singer 2024].

**Change.**
1. Enforce a 90-second minimum for exercises with `axialLoadingIndex >= 1`.
2. Present the timer as "önerilen dinlenme" with +30 s / −30 s controls.
3. Record actual rest taken so the app can learn the user's real pattern.

**Acceptance criteria.**
- Compound exercises cannot auto-start a timer below 90 s.
- Adjustments are one tap and persist for the session.
- Actual rest duration is logged.

**Claim after change.** "Bileşik hareketlerde en az 90 saniye öneririz." Grade B.

---

### ES-12 — Smooth body-weight and trend displays

**Priority:** P2. **Effort:** S. **Depends on:** none. **Audit:** none (gap).

**Problem.** If body weight is displayed or trended, daily values are dominated by water and glycogen.

**Evidence.** Short-term weight change includes substantial non-tissue components [ref: Bhutani 2017]. Lean-mass retention depends on resistance training and protein [ref: Weinheimer 2010; ref: Cava 2017; ref: Helms 2014].

**Change.**
1. Never display a single-day delta as progress.
2. Use a 7-day rolling mean with a 14-day comparison window.
3. Add a one-line note when the user is in a deficit that strength maintenance is a realistic goal.

**Acceptance criteria.**
- Trend lines use a rolling mean.
- No "−0.4 kg today" surface exists.
- Copy in a deficit does not promise muscle gain.

**Claim after change.** "Kilo trendi 7 günlük ortalamayla gösterilir." Grade B.

---

### ES-13 — Show wearable calories as ranges

**Priority:** P2. **Effort:** S. **Depends on:** none. **Audit:** AUD-16.

**Problem.** Active and total calories from Health Connect are displayed as exact values.

**Evidence.** Energy-expenditure estimates from consumer devices have wide error bounds [ref: O'Driscoll 2020; ref: Shcherbina 2017; ref: Dooley 2017].

**Change.**
1. Round to the nearest 50 kcal and prefix with "~".
2. Add an info affordance explaining that device estimates vary.
3. Never use calorie data to adjust training recommendations.

**Acceptance criteria.**
- No exact calorie value appears in the UI.
- The info copy is reachable in one tap.
- No training recommendation reads calorie data.

**Claim after change.** "Tahmini aktif kalori." Grade B for the caveat.

---

### ES-14 — Add a cardio/strength ordering hint

**Priority:** P3. **Effort:** S. **Depends on:** none. **Audit:** none (gap).

**Problem.** Same-day cardio and lower-body strength are scheduled without ordering guidance.

**Evidence.** Strength-before-endurance ordering is better for lower-body 1RM [ref: Murlasits 2018; ref: Eddens 2018]; running interferes more than cycling [ref: Wilson 2012]; hypertrophy and max strength are largely preserved [ref: Schumann 2022].

**Change.** When a session contains both, show a non-blocking hint: "Ağırlığı kardiyodan önce yap."

**Acceptance criteria.**
- Hint appears only when both modalities are present on the same day.
- Hint is dismissible and never blocks completion.

**Claim after change.** "Aynı gün kardiyo varsa önce ağırlığı öneririz." Grade B.

---

### ES-15 — Add a "how this is calculated" surface

**Priority:** P2. **Effort:** M. **Depends on:** ES-01, ES-03, ES-05. **Audit:** all.

**Problem.** Users cannot see which numbers are measured, which are estimated, and which are conventions.

**Evidence.** This document. Also, transparent uncertainty is a precondition for trust in any estimate.

**Change.**
1. Add a per-metric info sheet: what it is, how it is computed, what its error is, and what it is not.
2. Link from e1RM, volume band, recovery state and PR badges.
3. Write the copy in Turkish, consistent with the app's language.

**Acceptance criteria.**
- Every computed metric has an entry point to its explanation.
- Explanations name the error source in plain language.
- No explanation claims validation that does not exist.

**Claim after change.** "Hangi sayının ölçüm, hangisinin tahmin olduğunu gösteririz." Grade not applicable; this is honesty infrastructure.

---

### ES-16 — Ship fractional volume attribution

**Priority:** P2. **Effort:** L. **Depends on:** ES-03. **Audit:** AUD-05.

**Problem.** Volume is credited only to the primary category, so compound work under-counts secondary muscles and per-muscle volume is systematically wrong.

**Evidence.** Pelland et al. (2026) found fractional attribution of indirect sets outperformed total and direct-only schemes [ref: Pelland 2026]. The specific weights remain unvalidated.

**Change.**
1. Implement the fractional matrix from `docs/MUSCLE_TAXONOMY_AND_SPLIT_ARCHITECTURE_SPEC.md` §3.2.
2. Store both direct and fractional volume so the two can be compared.
3. Label fractional volume as an estimate in the UI.

**Acceptance criteria.**
- A bench press contributes to chest, triceps and front delts with documented weights.
- Direct and fractional totals are both available in the data model.
- Changing the matrix does not require a migration.

**Claim after change.** "Bileşik hareketler ikincil kaslara kısmi hacim yazar." Grade B for the approach, D for the weights.

---

## 6. Non-goals and rejected ideas

This section records what the evidence *does not* license, so that future contributors do not re-litigate settled questions or rebuild rejected features from scratch. Each entry states the proposal, the reason for rejection, and what would change the decision.

### 6.1 Non-goals

**NG-01 — Nutrition tracking or calorie coaching.** FitHash does not ingest food logs, and this document does not recommend building that capability. The nutrition evidence relevant to training is about adequacy and protein, not about macro accounting [ref: Weinheimer 2010; ref: Cava 2017; ref: Helms 2014]. A food database is a large product with its own evidence base, and adding it would double the surface area for unfounded precision claims. The narrow exception is copy that conditions expectations on energy availability (§5, ES-12).

**NG-02 — Velocity-based training.** No sensor is available on the target devices, and the strongest current evidence finds velocity-based RIR estimation fails practical accuracy criteria in at least one common lift [ref: Chen 2026]. Adding VBT would require hardware assumptions the product cannot meet.

**NG-03 — Heart-rate-variability readiness scores.** The app reads heart rate from Health Connect and Wear OS. Neither is validated for readiness inference, and the monitoring literature favours subjective measures [ref: Saw 2016; ref: Halson 2014]. A readiness score must be built from self-report, not inferred from wearable heart rate.

**NG-04 — Injury prediction and rehabilitation advice.** Nothing in this evidence base supports individual injury-risk prediction. The product should not estimate injury risk, diagnose pain, or prescribe rehabilitation.

**NG-05 — Automatic, unconfirmed programme rewrites.** Every recommendation in the audit is framed as a suggestion with visible reasoning. The evidence for any specific prescription is too weak to justify silently changing a user's plan.

**NG-06 — Maximal 1RM testing protocols.** Direct 1RM is reliable [ref: Grgic 2020] but costly and risky. The product should estimate and let users enter tested values, not guide them through maximal singles.

**NG-07 — Cross-user strength leaderboards.** e1RM is an estimate with individual error, and bodyweight, equipment and exercise selection are not normalised. A leaderboard would rank estimation artefacts. The existing composite strength score (§4, AUD-15) is only defensible as an internal, non-comparable ordering.

**NG-08 — Camera-based form analysis.** No validated inference is available, and the failure modes (false correction, injury implication) are severe.

### 6.2 Rejected ideas

| ID | Rejected proposal | Reason | What would change the decision |
|---|---|---|---|
| RJ-01 | Gate progression on an "effective reps" count | The threshold is a practitioner construct with no validation; it would block legitimate high-rep and low-rep progress | A trial demonstrating that a specific rep-in-reserve cutoff predicts hypertrophy better than total hard sets |
| RJ-02 | Force the final set of each exercise to failure | Failure confers little average benefit and adds fatigue; 0 RIR may be slightly inferior for strength [ref: Davies 2016; ref: Refalo 2023; ref: Robinson 2024] | Consistent evidence that a final failure set improves hypertrophy at equal volume |
| RJ-03 | Hard "junk volume" ceiling | The dose–response models show diminishing, not zero, returns; no trial establishes harm at any specific volume [ref: Pelland 2026] | A trial randomising above a putative ceiling and showing attenuated adaptation |
| RJ-04 | Infer readiness from wearable heart rate | Device HR error grows with intensity, and readiness is not a heart-rate construct [ref: Shcherbina 2017; ref: Saw 2016] | Validation of a specific HR-derived readiness index against performance |
| RJ-05 | Personalise MEV/MAV/MRV with machine learning | There are no labelled individual landmarks to learn from; the targets are constructs, not observations | A dataset with individualised, externally validated volume thresholds |
| RJ-06 | Convert logged reps into a precise %1RM | Between-individual variation in reps at a given %1RM is large and exercise-dependent [ref: Nuzzo 2024; ref: Reynolds 2006] | A model with calibrated per-user error that is validated prospectively |
| RJ-07 | Prescribe 4-second eccentrics as optimal | Eccentric duration does not reliably change hypertrophy or strength within ordinary ranges [ref: Amdi 2025; ref: Roig 2009] | A trial showing a hypertrophy advantage for a specific tempo at equal load and volume |
| RJ-08 | Remove the warm-up ramp entirely as an over-correction | General warm-up has weak positive support and the ramp is a usability feature [ref: Fradkin 2010; ref: McGowan 2015] | Evidence that ramp sets impair performance or adaptation |
| RJ-09 | Replace double progression with a single-mode model | Load and rep progression appear broadly equivalent; double progression operationalises both [ref: Plotkin 2022] | A trial showing superiority of one mode over a longer horizon |
| RJ-10 | Show per-muscle recovery as a measured percentage | No per-muscle recovery measurement exists; the model is a tuning artefact | A validated, individualised recovery biomarker or performance test |

### 6.3 Deliberate omissions

Three areas were considered and left out because the evidence is too thin to support any product decision, and including them would create pressure to ship something.

- **Menstrual-cycle-based training periodisation.** The literature is heterogeneous and the effect sizes are small and inconsistent; a feature here would be premature.
- **Advanced set structures (drop sets, myo-reps, rest-pause).** Evidence exists but is less mature than the main variables, and the product does not currently support them. Revisit if the set model expands.
- **Genetic or biomarker-personalised programming.** No validated consumer-grade basis.

---

## 7. Questions for the product owner

These are genuine decision points that the evidence cannot resolve, because they trade scientific precision against product qualities the research cannot value. Each is phrased so that a decision can be recorded and revisited.

**Q1. Is FitHash's promise tracking fidelity or coaching authority?**
If the promise is fidelity — "we record what you did, accurately" — then the recommendations in §5 are straightforward and low-risk. If the promise is authority — "we tell you what to do" — then every hedge ("estimate", "suggestion", "range") weakens the promise, and the product owner must decide how much uncertainty the brand can carry. The evidence supports the first promise and cannot support the second at the precision currently implied.

**Q2. How much precision language is acceptable in the UI?**
Ten of sixteen audit findings are fixed by relabelling rather than re-engineering. But relabelling reduces the apparent sophistication of the product. Is the owner willing to accept "tahmini" (estimated), "aralık" (range) and "öneri" (suggestion) on headline surfaces, or should uncertainty be relegated to an info sheet reached from a tap?

**Q3. Which metric is the headline?**
The app currently foregrounds e1RM and volume. Adherence is the better predictor of outcomes (§3.16) and the metric the app can measure most reliably. Should consistency become the primary surfaced metric, with e1RM and volume as secondary? This is a product-positioning decision with retention implications.

**Q4. Can the RIR default change for existing users?**
Reordering the RIR cycle (ES-01) changes the number of taps to reach a given value and may alter what existing users log. Is a migration acceptable, or should the change be gated to new users with a one-time explainer for existing ones?

**Q5. What is the acceptable behaviour when adherence is low?**
ES-09 proposes shrinking the plan when adherence falls. Some users will read this as the app giving up on them. Is the desired behaviour to reduce volume, to reduce frequency, or to hold the plan and prompt for a reason?

**Q6. Ship fractional volume before or after the relabel?**
ES-16 improves accuracy; ES-03 improves honesty. Doing ES-03 first reduces the chance that a more accurate number is presented with the same false precision. The recommendation is ES-03 first, but it depends on release sequencing.

**Q7. Is wearable calorie display a retention feature?**
If users value seeing calorie numbers, replacing exact values with ranges (ES-13) may cost engagement. The evidence says the numbers are unreliable; the product owner must decide whether honesty or perceived utility wins on that surface.

**Q8. Who owns evidence copy, and on what cadence is it reviewed?**
Every claim in the app is a scientific claim with a shelf life. This document should be reviewed at least annually and whenever a training-logic feature ships. Who is accountable, and what is the trigger for review?

---

## 8. Validation plan (optional)

The recommendations in §5 are, with few exceptions, low-risk changes that do not require a trial. Three of them are worth measuring, and one is worth external validation.

### 8.1 Instrumentation first

Before changing behaviour, instrument the existing surfaces. Without baseline data, any subsequent comparison is uninterpretable.

- Log views of e1RM, volume band, recovery state and PR badges.
- Log whether the user accepts, dismisses or overrides each suggestion.
- Log RIR entry patterns (which values, how often unset, time to entry).
- Log actual rest duration versus suggested.

**Success criterion for the instrumentation phase:** every audit item in §4 has at least one measurable behaviour attached.

### 8.2 A/B tests

| Test | Hypothesis | Primary metric | Guardrail |
|---|---|---|---|
| RIR cycle order (3→0 vs 0→3) | Starting at 3 increases RIR logging completion and reduces failure logging | RIR completion rate; proportion of sets at 0 RIR | Session completion, session duration |
| PR type labelling | Typed PRs reduce perceived false positives and increase trust | PR badge tap-through; self-reported trust | PR event frequency |
| Suggestion framing (reasoning shown) | Showing reasoning increases acceptance of deload and substitution suggestions | Acceptance rate | Dismissal-to-acceptance ratio |

These are product experiments, not science. They test whether honest framing is tolerated, not whether the underlying physiology is correct.

### 8.3 External calibration of e1RM

The single most valuable scientific measurement the product could make is a calibration study: for a volunteer subsample, compare `calculateAutoregulatedE1RM` against a directly tested 1RM at a small number of time points.

- **Design:** convenience sample of consenting users, tested 1RM on one compound lift per participant, compared against the app's estimate from the same week.
- **Outcome:** mean bias and limits of agreement (Bland–Altman), stratified by rep count and RIR recorded.
- **What it would settle:** whether the 0.10 exponent and the effective-reps construction produce acceptable error, and whether the RIR imputation in PR detection is defensible.
- **What it would not settle:** whether e1RM is a good progress metric (it may still be noisy even if unbiased).

This is the only item in this document that requires data the app does not already have. It is optional, but it is the highest-value optional item.

### 8.4 What would falsify these recommendations

Intellectual honesty requires stating the conditions under which this document is wrong.

1. **A validated effective-reps threshold.** If a trial demonstrates that a specific cutoff predicts hypertrophy better than total hard sets, RJ-01 and parts of ES-01 should be revisited.
2. **A validated volume ceiling.** If randomisation above a putative MRV shows attenuated adaptation, RJ-03 and the ES-03 relabel become too conservative.
3. **Evidence that long-length partials are generally superior.** This would raise §3.6 from C to B and make ES-10 a higher priority.
4. **Evidence that failure is required for hypertrophy in trained lifters at moderate volume.** This would reverse F4 and ES-01's reordering.
5. **Evidence that per-muscle recovery can be measured.** This would legitimise the recovery surface rather than relabel it.

Absent these, the current grades stand.

---

## 9. How this document was produced

### 9.1 Method

1. **Repository inspection.** Every audit anchor was read in the working tree, not inferred from filenames. Line numbers were taken from the files at the time of writing and the function names recorded so that the reference survives refactoring.
2. **Targeted literature retrieval.** Sources were identified through PubMed E-utilities (`esearch`, `esummary`, `efetch`), Europe PMC REST, Crossref, and Semantic Scholar, with DOI resolution for each reference. Preference was given to systematic reviews and meta-analyses, then randomised trials, then mechanistic work. Narrative reviews were used only where they were the best available synthesis, and are graded accordingly.
3. **Verification of bibliographic detail.** Every reference's authors, year, journal, volume, issue, pages and DOI were checked against at least one index record. Where a DOI was not indexed in PubMed (several strength-and-conditioning journals), Crossref was used.
4. **Claim-level grading.** Each substantive claim was graded against the rubric in §0.2, independently of the grade of the paper it came from. Where a meta-analysis's authors described their analysis as exploratory, the claim was capped at B.
5. **Cross-referencing rather than duplication.** Biomechanics, fractional volume and competitor analysis were left to the three existing specifications, with pointers where this document's conclusions bear on them.

### 9.2 Inclusion and exclusion

**Included:** systematic reviews and meta-analyses of chronic resistance-training adaptations in healthy adults; randomised trials of training variables; methodological papers on measurement and terminology; reviews of monitoring, sleep, adherence and wearable accuracy where they bear on product claims.

**Excluded:** animal and in-vitro work (except where cited by a review as mechanism), single-subject case reports, non-peer-reviewed practitioner content, and studies in clinical populations unless the finding generalises to healthy trainees.

**Language:** English-language publications only. This is a limitation; a substantial body of Brazilian and European work is published in English, but some is not.

### 9.3 Limitations

- This is **not** a systematic review. There is no registered protocol, no dual independent screening, no formal risk-of-bias assessment, and no GRADE certainty rating. "Systematic" language is avoided deliberately.
- **Single-analyst grading.** Grades are one author-agent's judgement. They are reasoned and traceable, but they are not inter-rater validated.
- **Selection bias toward accessible sources.** Paywalled trials without accessible abstracts were less likely to be included.
- **Recency.** The literature moves; a 2026 document will be partly stale by 2028. The grades are the durable part; the specific citations are not.
- **No primary data.** Nothing here tests FitHash users. Every claim about FitHash behaviour is inferred from code reading.

### 9.4 Maintenance

Review this document when any of the following occurs:

- a training-logic feature ships or changes materially;
- a new meta-analysis appears on volume, proximity to failure, ROM or frequency;
- a user-facing claim is challenged;
- twelve months elapse, whichever is sooner.

The revision should update §4 anchors, re-grade any claim whose evidence base changed, and record the change in §10.

---

## 10. Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-11-24 | Initial document: evidence review, implementation audit, 16-item backlog, non-goals, validation plan |

---

## References

References are numbered and ordered alphabetically by first author. Citation keys in the text (for example `Schoenfeld 2017a`) resolve to the bracketed key at the start of each entry.

1. **[Amdi 2025]** Amdi CH, King A. The effect of eccentric phase duration on maximal strength, muscle hypertrophy and countermovement jump height: A systematic review and meta-analysis. *J Sports Sci.* 2025;43(20):2447–2464. doi:10.1080/02640414.2025.2535198
2. **[Barakat 2020]** Barakat C, Pearson J, Escalante G, Campbell B, De Souza EO. Body Recomposition: Can Trained Individuals Build Muscle and Lose Fat at the Same Time? *Strength Cond J.* 2020;42(5):7–21. doi:10.1519/SSC.0000000000000584
3. **[Baz-Valle 2021]** Baz-Valle E, Fontes-Villalba M, Santos-Concejero J. Total Number of Sets as a Training Volume Quantification Method for Muscle Hypertrophy: A Systematic Review. *J Strength Cond Res.* 2021;35(3):870–878. doi:10.1519/JSC.0000000000002776
4. **[Bhutani 2017]** Bhutani S, Kahn E, Tasali E, Schoeller DA. Composition of two-week change in body weight under unrestricted free-living conditions. *Physiol Rep.* 2017;5(13):e13336. doi:10.14814/phy2.13336
5. **[Brickwood 2019]** Brickwood KJ, Watson G, O'Brien J, Williams AD. Consumer-Based Wearable Activity Trackers Increase Physical Activity Participation: Systematic Review and Meta-Analysis. *JMIR Mhealth Uhealth.* 2019;7(4):e11819. doi:10.2196/11819
6. **[Burke 2011]** Burke LE, Wang J, Sevick MA. Self-monitoring in weight loss: a systematic review of the literature. *J Am Diet Assoc.* 2011;111(1):92–102. doi:10.1016/j.jada.2010.10.008
7. **[Case 2015]** Case MA, Burwick HA, Volpp KG, Patel MS. Accuracy of smartphone applications and wearable devices for tracking physical activity data. *JAMA.* 2015;313(6):625–626. doi:10.1001/jama.2014.17841
8. **[Cava 2017]** Cava E, Yeat NC, Mittendorfer B. Preserving Healthy Muscle during Weight Loss. *Adv Nutr.* 2017;8(3):511–519. doi:10.3945/an.116.014506
9. **[Chen 2026]** Chen W, Zhang H, Li R, Chen Z, Zheng J, Zhang X, Li Z. Velocity-Based Monitoring Lacks Both Accuracy and Applicability for Estimating Repetitions in Reserve During the Hexagonal Bar Deadlift. *J Strength Cond Res.* 2026;40(11):1335–1341. doi:10.1519/JSC.0000000000005549
10. **[Cheung 2003]** Cheung K, Hume P, Maxwell L. Delayed onset muscle soreness: treatment strategies and performance factors. *Sports Med.* 2003;33(2):145–164. doi:10.2165/00007256-200333020-00005
11. **[Coleman 2023]** Coleman M, Burke R, Benavente C, Piñero A, et al. Supervision during resistance training positively influences muscular adaptations in resistance-trained individuals. *J Sports Sci.* 2023;41(12):1207–1217. doi:10.1080/02640414.2023.2261090
12. **[Coleman 2024]** Coleman M, Burke R, Augustin F, et al. Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. *PeerJ.* 2024;12:e16777. doi:10.7717/peerj.16777
13. **[Colquhoun 2018]** Colquhoun RJ, Gai CM, Aguilar D, et al. Training Volume, Not Frequency, Indicative of Maximal Strength Adaptations to Resistance Training. *J Strength Cond Res.* 2018;32(5):1207–1213. doi:10.1519/JSC.0000000000002414
14. **[Craven 2022]** Craven J, McCartney D, Desbrow B, et al. Effects of Acute Sleep Loss on Physical Performance: A Systematic and Meta-Analytical Review. *Sports Med.* 2022;52(11):2669–2690. doi:10.1007/s40279-022-01706-y
15. **[Csapo 2016]** Csapo R, Alegre LM. Effects of resistance training with moderate vs heavy loads on muscle mass and strength in the elderly: A meta-analysis. *Scand J Med Sci Sports.* 2016;26(9):995–1006. doi:10.1111/sms.12536
16. **[Damas 2016]** Damas F, Phillips SM, Libardi CA, et al. Resistance training-induced changes in integrated myofibrillar protein synthesis are related to hypertrophy only after attenuation of muscle damage. *J Physiol.* 2016;594(18):5209–5222. doi:10.1113/JP272472
17. **[Davies 2016]** Davies T, Orr R, Halaki M, Hackett D. Effect of Training Leading to Repetition Failure on Muscular Strength: A Systematic Review and Meta-Analysis. *Sports Med.* 2016;46(4):487–502. doi:10.1007/s40279-015-0451-3
18. **[De Marco 2024]** De Marco K, Goods PSR, Baldwin KM, Hiscock DJ. Resistance Training Prescription During Planned Deloading Periods: A Survey of Strength and Conditioning Coaches Across Varying Sporting Codes. *J Strength Cond Res.* 2024;38(12):2099–2106. doi:10.1519/JSC.0000000000004932
19. **[Dooley 2017]** Dooley EE, Golaszewski NM, Bartholomew JB. Estimating Accuracy at Exercise Intensities: A Comparative Study of Self-Monitoring Heart Rate and Physical Activity Wearable Devices. *JMIR Mhealth Uhealth.* 2017;5(3):e34. doi:10.2196/mhealth.7043
20. **[Eddens 2018]** Eddens L, van Someren K, Howatson G. The Role of Intra-Session Exercise Sequence in the Interference Effect: A Systematic Review with Meta-Analysis. *Sports Med.* 2018;48(1):177–188. doi:10.1007/s40279-017-0784-1
21. **[Eysenbach 2005]** Eysenbach G. The law of attrition. *J Med Internet Res.* 2005;7(1):e11. doi:10.2196/jmir.7.1.e11
22. **[Fradkin 2010]** Fradkin AJ, Zazryn TR, Smoliga JM. Effects of warming-up on physical performance: a systematic review with meta-analysis. *J Strength Cond Res.* 2010;24(1):140–148. doi:10.1519/JSC.0b013e3181c643a0
23. **[Grgic 2018a]** Grgic J, Schoenfeld BJ, Skrepnik M, Davies TB, Mikulic P. Effects of Rest Interval Duration in Resistance Training on Measures of Muscular Strength: A Systematic Review. *Sports Med.* 2018;48(1):137–151. doi:10.1007/s40279-017-0788-x
24. **[Grgic 2018b]** Grgic J, Schoenfeld BJ, Davies TB, Lazinica B, Krieger JW, Pedisic Z. Effect of Resistance Training Frequency on Gains in Muscular Strength: A Systematic Review and Meta-Analysis. *Sports Med.* 2018;48(5):1207–1220. doi:10.1007/s40279-018-0872-x
25. **[Grgic 2020]** Grgic J, Lazinica B, Schoenfeld BJ, Pedisic Z. Test-Retest Reliability of the One-Repetition Maximum (1RM) Strength Assessment: a Systematic Review. *Sports Med Open.* 2020;6(1):31. doi:10.1186/s40798-020-00260-z
26. **[Halson 2014]** Halson SL. Monitoring training load to understand fatigue in athletes. *Sports Med.* 2014;44(Suppl 2):S139–S147. doi:10.1007/s40279-014-0253-z
27. **[Helms 2014]** Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. *J Int Soc Sports Nutr.* 2014;11:20. doi:10.1186/1550-2783-11-20
28. **[Helms 2017]** Helms ER, Storey A, Cross MR, Brown SR, Lenetsky S, Ramsay H, Dillen C, Zourdos MC. RPE and Velocity Relationships for the Back Squat, Bench Press, and Deadlift in Powerlifters. *J Strength Cond Res.* 2017;31(2):292–297. doi:10.1519/JSC.0000000000001517
29. **[Helms 2018]** Helms ER, Cross MR, Brown SR, Storey A, Cronin J, Zourdos MC. Rating of Perceived Exertion as a Method of Volume Autoregulation Within a Periodized Program. *J Strength Cond Res.* 2018;32(6):1627–1636. doi:10.1519/JSC.0000000000002032
30. **[Helms 2020]** Helms ER, Kwan K, Sousa CA, et al. Methods for Regulating and Monitoring Resistance Training. *J Hum Kinet.* 2020;74:23–42. doi:10.2478/hukin-2020-0011
31. **[Holmes 2026]** Holmes G, Jones MD, Cross R, Engel A, Walker ED, Hagstrom AD, Helms ER, Gibbs MT. Accuracy of different methods for predicting proximity to failure during resistance training. *J Sports Sci.* 2026;44(24):3483–3493. doi:10.1080/02640414.2026.2763157
32. **[Iraki 2019]** Iraki J, Fitschen P, Espinar S, Helms E. Nutrition Recommendations for Bodybuilders in the Off-Season: A Narrative Review. *Sports (Basel).* 2019;7(7):154. doi:10.3390/sports7070154
33. **[Iversen 2021]** Iversen VM, Norum M, Schoenfeld BJ, Fimland MS. No Time to Lift? Designing Time-Efficient Training Programs for Strength and Hypertrophy: A Narrative Review. *Sports Med.* 2021;51(10):2079–2095. doi:10.1007/s40279-021-01490-1
34. **[Kassiano 2022]** Kassiano W, Nunes JP, Costa B, et al. Does Varying Resistance Exercises Promote Superior Muscle Hypertrophy and Strength Gains? A Systematic Review. *J Strength Cond Res.* 2022;36(6):1753–1762. doi:10.1519/JSC.0000000000004258
35. **[Kassiano 2023]** Kassiano W, Costa B, Kunevaliki G, et al. Greater Gastrocnemius Muscle Hypertrophy After Partial Range of Motion Training Performed at Long Muscle Lengths. *J Strength Cond Res.* 2023;37(9):1746–1753. doi:10.1519/JSC.0000000000004460
36. **[Klasnja 2012]** Klasnja P, Pratt W. Healthcare in the pocket: mapping the space of mobile-phone health interventions. *J Biomed Inform.* 2012;45(1):184–198. doi:10.1016/j.jbi.2011.08.017
37. **[Knowles 2018]** Knowles OE, Drinkwater EJ, Urwin CS, Lamon S, Aisbett B. Inadequate sleep and muscle strength: Implications for resistance training. *J Sci Med Sport.* 2018;21(9):959–968. doi:10.1016/j.jsams.2018.01.012
38. **[Kraemer 2004]** Kraemer WJ, Ratamess NA. Fundamentals of resistance training: progression and exercise prescription. *Med Sci Sports Exerc.* 2004;36(4):674–688. doi:10.1249/01.MSS.0000121945.36635.61
39. **[Lasevicius 2018]** Lasevicius T, Ugrinowitsch C, Schoenfeld BJ, et al. Effects of different intensities of resistance training with equated volume load on muscle strength and hypertrophy. *Eur J Sport Sci.* 2018;18(6):772–780. doi:10.1080/17461391.2018.1450898
40. **[LeSuer 1997]** LeSuer DA, McCormick JH, Mayhew JL, Wasserstein RL, Arnold MD. The Accuracy of Prediction Equations for Estimating 1-RM Performance in the Bench Press, Squat, and Deadlift. *J Strength Cond Res.* 1997;11(4):211–213. doi:10.1519/00124278-199711000-00001
41. **[Maeo 2021]** Maeo S, Huang M, Wu Y, et al. Greater Hamstrings Muscle Hypertrophy but Similar Damage Protection after Training at Long versus Short Muscle Lengths. *Med Sci Sports Exerc.* 2021;53(4):825–837. doi:10.1249/MSS.0000000000002523
42. **[Mah 2011]** Mah CD, Mah KE, Kezirian EJ, Dement WC. The effects of sleep extension on the athletic performance of collegiate basketball players. *Sleep.* 2011;34(7):943–950. doi:10.5665/SLEEP.1132
43. **[McGowan 2015]** McGowan CJ, Pyne DB, Thompson KG, Rattray B. Warm-Up Strategies for Sport and Exercise: Mechanisms and Applications. *Sports Med.* 2015;45(11):1523–1546. doi:10.1007/s40279-015-0376-x
44. **[Michie 2009]** Michie S, Abraham C, Whittington C, McAteer J, Gupta S. Effective techniques in healthy eating and physical activity interventions: a meta-regression. *Health Psychol.* 2009;28(6):690–701. doi:10.1037/a0016136
45. **[Morton 2016]** Morton RW, Oikawa SY, Wavell CG, et al. Neither load nor systemic hormones determine resistance training-mediated hypertrophy or strength gains in resistance-trained young men. *J Appl Physiol.* 2016;121(1):129–138. doi:10.1152/japplphysiol.00154.2016
46. **[Murlasits 2018]** Murlasits Z, Kneffel Z, Thalib L. The physiological effects of concurrent strength and endurance training sequence: A systematic review and meta-analysis. *J Sports Sci.* 2018;36(11):1212–1219. doi:10.1080/02640414.2017.1364405
47. **[Nuzzo 2024]** Nuzzo JL, Pinto MD, Nosaka K, Steele J. Maximal Number of Repetitions at Percentages of the One Repetition Maximum: A Meta-Regression and Moderator Analysis of Sex, Age, Training Status, and Exercise. *Sports Med.* 2024;54(2):303–321. doi:10.1007/s40279-023-01937-7
48. **[O'Driscoll 2020]** O'Driscoll R, Turicchi J, Beaulieu K, et al. How well do activity monitors estimate energy expenditure? A systematic review and meta-analysis of the validity of current technologies. *Br J Sports Med.* 2020;54(6):332–340. doi:10.1136/bjsports-2018-099643
49. **[Pallarés 2021]** Pallarés JG, Hernández-Belmonte A, Martínez-Cava A, et al. Effects of range of motion on resistance training adaptations: A systematic review and meta-analysis. *Scand J Med Sci Sports.* 2021;31(10):1866–1881. doi:10.1111/sms.14006
50. **[Pancar 2026]** Pancar Z, Ilhan MT, Darendeli MK, et al. Effects of deload periods in resistance training on muscle hypertrophy and strength endurance in untrained men. *Sci Rep.* 2026;16(1). doi:10.1038/s41598-026-40612-5
51. **[Pedrosa 2022]** Pedrosa GF, Lima FV, Schoenfeld BJ, et al. Partial range of motion training elicits favorable improvements in muscular adaptations when carried out at long muscle lengths. *Eur J Sport Sci.* 2022;22(8):1250–1260. doi:10.1080/17461391.2021.1927199
52. **[Pelland 2026]** Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. *Sports Med.* 2026;56(2):481–505. doi:10.1007/s40279-025-02344-w
53. **[Plotkin 2022]** Plotkin D, Coleman M, Van Every D, et al. Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations. *PeerJ.* 2022;10:e14142. doi:10.7717/peerj.14142
54. **[Ralston 2017]** Ralston GW, Kilgore L, Wyatt FB, Baker JS. The Effect of Weekly Set Volume on Strength Gain: A Meta-Analysis. *Sports Med.* 2017;47(12):2585–2601. doi:10.1007/s40279-017-0762-7
55. **[Refalo 2023]** Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis. *Sports Med.* 2023;53(3):649–665. doi:10.1007/s40279-022-01784-y
56. **[Reynolds 2006]** Reynolds JM, Gordon TJ, Robergs RA. Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry. *J Strength Cond Res.* 2006;20(3):584–592. doi:10.1519/R-15304.1
57. **[Robinson 2024]** Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC. Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions. *Sports Med.* 2024;54(9):2209–2231. doi:10.1007/s40279-024-02069-2
58. **[Robinson 2025]** Robinson ZP, Macarilla C, Juber M, Cerminaro R, Benitez B, Pelland J, Remmert J, et al. The Effect of Resistance Training Proximity to Failure on Muscular Adaptations and Longitudinal Fatigue in Trained Men. *Int J Strength Cond.* 2025;5(1). doi:10.47206/ijsc.v5i1.393
59. **[Rogerson 2024]** Rogerson D, Nolan D, Androulakis Korakakis P, Immonen V, et al. Deloading Practices in Strength and Physique Sports: A Cross-sectional Survey. *Sports Med Open.* 2024;10(1):26. doi:10.1186/s40798-024-00691-y
60. **[Roig 2009]** Roig M, O'Brien K, Kirk G, Murray R, McKinnon P, Shadgan B, Reid WD. The effects of eccentric versus concentric resistance training on muscle strength and mass in healthy adults: a systematic review with meta-analysis. *Br J Sports Med.* 2009;43(8):556–568. doi:10.1136/bjsm.2008.051417
61. **[Saw 2016]** Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. *Br J Sports Med.* 2016;50(5):281–291. doi:10.1136/bjsports-2015-094758
62. **[Schoenfeld 2016a]** Schoenfeld BJ, Pope ZK, Benik FM, et al. Longer Interset Rest Periods Enhance Muscle Strength and Hypertrophy in Resistance-Trained Men. *J Strength Cond Res.* 2016;30(7):1805–1812. doi:10.1519/JSC.0000000000001272
63. **[Schoenfeld 2016b]** Schoenfeld BJ, Ogborn D, Krieger JW. Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis. *Sports Med.* 2016;46(11):1689–1697. doi:10.1007/s40279-016-0543-8
64. **[Schoenfeld 2017a]** Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis. *J Sports Sci.* 2017;35(11):1073–1082. doi:10.1080/02640414.2016.1210197
65. **[Schoenfeld 2017b]** Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis. *J Strength Cond Res.* 2017;31(12):3508–3523. doi:10.1519/JSC.0000000000002200
66. **[Schoenfeld 2019a]** Schoenfeld BJ, Grgic J, Krieger J, et al. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis of studies examining the effects of resistance training frequency. *J Sports Sci.* 2019;37(11):1286–1295. doi:10.1080/02640414.2018.1555906
67. **[Schoenfeld 2019b]** Schoenfeld BJ, Contreras B, Krieger J, Grgic J, Delcastillo K, Belliard R, Alto A. Resistance Training Volume Enhances Muscle Hypertrophy but Not Strength in Trained Men. *Med Sci Sports Exerc.* 2019;51(1):94–103. doi:10.1249/MSS.0000000000001764
68. **[Schoenfeld 2021]** Schoenfeld BJ, Grgic J, Van Every DW, Plotkin DL. Loading Recommendations for Muscle Strength, Hypertrophy, and Local Endurance: A Re-Examination of the Repetition Continuum. *Sports (Basel).* 2021;9(2):32. doi:10.3390/sports9020032
69. **[Schumann 2022]** Schumann M, Feuerbacher JF, Sünkeler M, et al. Compatibility of Concurrent Aerobic and Strength Training for Skeletal Muscle Size and Function: An Updated Systematic Review and Meta-Analysis. *Sports Med.* 2022;52(3):601–612. doi:10.1007/s40279-021-01587-7
70. **[Scott 2016]** Scott BR, Duthie GM, Thornton HR, Dascombe BJ. Training Monitoring for Resistance Exercise: Theory and Applications. *Sports Med.* 2016;46(5):687–698. doi:10.1007/s40279-015-0454-0
71. **[Shcherbina 2017]** Shcherbina A, Mattsson CM, Waggott D, et al. Accuracy in Wrist-Worn, Sensor-Based Measurements of Heart Rate and Energy Expenditure in a Diverse Cohort. *J Pers Med.* 2017;7(2):3. doi:10.3390/jpm7020003
72. **[Singer 2024]** Singer A, Wolf M, Generoso L, et al. Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. *Front Sports Act Living.* 2024;6:1429789. doi:10.3389/fspor.2024.1429789
73. **[Steele 2017]** Steele J, Fisher J, Giessing J, Gentil P. Clarity in reporting terminology and definitions of set endpoints in resistance training. *Muscle Nerve.* 2017;56(3):368–374. doi:10.1002/mus.25557
74. **[Weinheimer 2010]** Weinheimer EM, Sands LP, Campbell WW. A systematic review of the separate and combined effects of energy restriction and exercise on fat-free mass in middle-aged and older adults: implications for sarcopenic obesity. *Nutr Rev.* 2010;68(7):375–388. doi:10.1111/j.1753-4887.2010.00298.x
75. **[Wilson 2012]** Wilson JM, Marin PJ, Rhea MR, et al. Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. *J Strength Cond Res.* 2012;26(8):2293–2307. doi:10.1519/JSC.0b013e31823a3e2d
76. **[Wolf 2023]** Wolf M, Androulakis-Korakakis P, Fisher J, Schoenfeld BJ, Steele J. Partial vs Full Range of Motion Resistance Training: A Systematic Review and Meta-Analysis. *Int J Strength Cond.* 2023;3(1). doi:10.47206/ijsc.v3i1.182
77. **[Zourdos 2016]** Zourdos MC, Klemp A, Dolan C, et al. Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve. *J Strength Cond Res.* 2016;30(1):267–275. doi:10.1519/JSC.0000000000001049

---

## Appendix A. Grade summary by finding

| Finding | Claim | Grade | Confidence in the grade |
|---|---|---|---|
| F1 | Volume increases hypertrophy with diminishing returns | A (direction), B (shape) | High |
| F2 | Load does not determine hypertrophy when effort is matched | A | High |
| F3 | Proximity to failure matters more for hypertrophy than strength | B | Moderate |
| F4 | Failure training is not required and buys little | A / B | High |
| F5 | Frequency is a volume-distribution variable | A / B | High |
| F6 | Rest ≥2 min supports compound performance; hypertrophy plateaus beyond ~90 s | B | Moderate |
| F7 | Full ROM ≥ partial; lengthened partials promising | B / C | Moderate |
| F8 | Slow eccentrics are not superior | B / C | Moderate |
| F9 | General warm-up helps slightly; ramp percentages unvalidated | C / D | High |
| F10 | Deloads are low-risk, unproven enhancers | C | Moderate |
| F11 | RIR/RPE are group-level useful and individually noisy | B / C | High |
| F12 | Adherence, sleep and measurement error dominate real-world outcomes | A / B | High |

## Appendix B. Glossary of Turkish UI strings referenced

| String | Meaning | Where used |
|---|---|---|
| `'Göğüs'`, `'Sırt'`, `'Bacak'`, `'Omuz'`, `'Ön Kol'`, `'Arka Kol'`, `'Karın'`, `'Kardiyo'` | Muscle categories | `types/fitness.ts`, used as volume keys |
| `'Hacim Yetersiz (<6 Set)'` | "Insufficient volume (<6 sets)" | `evaluateWeeklyMuscleVolumeLandmarks` |
| `'Minimum Etkili Hacim (MEV: 6-9 Set)'` | "Minimum effective volume" | same |
| `'İdeal Hipertrofi Aralığı (MAV: 10-18 Set)'` | "Ideal hypertrophy range" | same |
| `'Tavan Hacim (MRV: 19-22 Set)'` | "Ceiling volume" | same |
| `'Aşırı Yükleme (>22 Set / Overtraining Riski)'` | "Overload (>22 sets / overtraining risk)" | same |
| `'Deload (Toparlanma)'` | "Deload (recovery)" | `calculateSmartAutoregulatedOverload` |
| `'Deload Önerisi (%50 Hacim, -%10 Yük)'` | "Deload suggestion (50% volume, −10% load)" | same |
| `'Hazır'` | "Ready" | `MuscleRecoveryHeatmap` |
| `'Makine & Kablo Bileşik (8-12 Reps)'` | "Machine & cable compound (8–12 reps)" | `getHypertrophyRepBracket` |

## Appendix C. Audit severity distribution

| Severity | Count | IDs |
|---|---|---|
| High | 4 | AUD-02, AUD-03, AUD-04, AUD-06 |
| Medium | 9 | AUD-01, AUD-05, AUD-07, AUD-09, AUD-10, AUD-11, AUD-13, AUD-15, AUD-16 |
| Low | 3 | AUD-08, AUD-12, AUD-14 |

The concentration of High severity in PR semantics, deload triggering and volume/recovery labelling reflects a single underlying issue: the interpretive layer converts logs into claims with more confidence than the data supports. Fixing the language in those four places would resolve most of the document's product risk without changing a single algorithm.

## Appendix D. Traceability matrix

Every finding in this document should be traceable to a code path, a backlog item, and a user-visible surface. Where a row has no code path, the finding is a gap rather than a defect.

| Finding | Code path | Backlog | User-visible surface | Current claim | Target claim |
|---|---|---|---|---|---|
| F1 volume dose–response | `evaluateWeeklyMuscleVolumeLandmarks` (`progressionEngine.ts:667`) | ES-03, ES-16 | Volume band card, heatmap ring | "MAV 10–18 set" | "Orta–yüksek hacim" |
| F2 load/rep continuum | `getHypertrophyRepBracket` (`:48`) | ES-07 | Overload target reps | "scientifically validated" | "varsayılan aralık" |
| F3 proximity to failure | `e1rm.ts:11`, RIR pill | ES-01 | Set row, e1RM | RIR 0 first | RIR 3 first |
| F4 failure not required | `calculateSmartAutoregulatedOverload` (`:370`) | ES-01 | Overload suggestion | push to failure implied | 1–2 RIR default |
| F5 frequency | split engine (spec) | — | Split recommendation | "more frequency = more growth" | "volume distribution" |
| F6 rest intervals | `calculateDynamicRestSeconds` (`:1006`) | ES-11 | Rest timer | exact seconds | suggested, floored |
| F7 range of motion | `getBiomechanicalProfile` (`:832`) | ES-10 | Exercise profile | inferred from name | user-tagged |
| F8 tempo | none | — | none | none | do not add |
| F9 warm-up | `WARMUP_RAMP` (`:319`) | ES-06 | Warm-up rows | fixed 50/70/85 | editable convention |
| F10 deloads | `detectPlateauAndDeload` (`:221`) | ES-04 | Deload card | detected stagnation | suggestion with reasoning |
| F11 RIR accuracy | `storage.ts:364`, `:463` | ES-01, ES-02 | PR badge | single PR | typed PR, provenance |
| F12 adherence | none | ES-09 | none | none | adherence metric |

### D.1 How to use this matrix

1. **Before shipping a change**, locate its row and confirm the target claim is the one being implemented. If the change moves a surface from "current" to "target", the backlog item is done.
2. **When a new surface is added**, add a row. A surface that computes a number without a row in this matrix is a surface whose evidentiary status is undocumented.
3. **When a citation is superseded**, the row tells you which code path and which copy need re-checking.

The matrix also exposes a structural asymmetry: three findings (F5, F8, F12) have no shipped code path. Two of those are deliberate — F8 is a non-goal, and F5 lives only in a specification — while one is the largest gap in the product (F12).

## Appendix E. Unverified and inferred claims

This document is explicit about what could not be verified. The following claims are inferences or conventions rather than findings with a located primary source. They are flagged here so that a future reviewer does not mistake them for cited evidence.

| Claim | Status | Basis | Recommended handling |
|---|---|---|---|
| "Effective reps" threshold of ~5 | `[unverified — needs source]` | Mechanistic reasoning from motor-unit recruitment; no located validation | Do not surface to users; keep as internal smoothing only |
| 50/70/85% warm-up ramp | `[unverified — needs source]` | Coaching convention | Label as default, allow override |
| MEV/MAV/MRV numeric values | `[unverified — needs source]` | Practitioner modelling | Relabel; do not present as measured |
| Per-muscle recovery half-lives (24–54 h) | `[unverified — needs source]` | Tuning values in `MUSCLE_RECOVERY_CONFIG` | Document as parameters |
| Hill exponent β = 2.4 | `[unverified — needs source]` | Chosen for curve shape | Document as parameter |
| Volume penalty of 4% per set above 5 | `[unverified — needs source]` | Tuning value; comment says 5% | Fix comment, document |
| Leverage ratios (0.42, 2.2, 0.45) | `[unverified — needs source]` | Engineering estimate | Present as range |
| Equipment strength weights (1.12/1.06/1.04) | `[unverified — needs source]` | Engineering estimate | Internal ordering only |
| "0.05 kg e1RM delta" plateau threshold | `[unverified — needs source]` | Code constant, not derived | Replace with noise-aware rule |
| Optimal RIR per exercise | `[unverified — needs source]` | Not established in any located study | Do not claim |
| Exact protein targets for recomposition | `[unverified — needs source]` | Narrative reviews only | Do not surface as prescription |
| Menstrual-cycle periodisation effects | `[unverified — needs source]` | Heterogeneous literature | Deliberate omission (§6.3) |

A claim is listed here if (a) it influences a product decision and (b) no peer-reviewed source establishing it was located during this review. Absence of a source is not proof of falsity; several of these are probably approximately correct. It is, however, a reason not to present them as settled.

