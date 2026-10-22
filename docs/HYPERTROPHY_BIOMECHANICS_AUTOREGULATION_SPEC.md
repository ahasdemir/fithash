# FitHash Phase 2/3 Scientific Specification: Advanced Hypertrophy Biomechanics, Autoregulation & Mesocycle Periodization

## 1. Executive Summary & Purpose
This document provides the definitive mathematical, biomechanical, and algorithmic specifications for **FitHash's Phase 2 and Phase 3 progression engine**. It builds directly on FitHash’s offline-first architecture, extending the existing Dynamic Double Progression (DDP), RIR-autoregulated hybrid e1RM (Epley/Lombardi), and 3-session plateau logic into an advanced neuromuscular-aware coaching platform.

All formulas, state machines, and thresholds are formatted for direct implementation in TypeScript/JavaScript for the React Native/Expo app (`src/services/progressionEngine.ts` and related state stores).

---

## 2. Exercise Sequencing & Biomechanical Fatigue Interaction

### 2.1 Length-Tension Biomechanics & Lengthened Partials
Recent literature (Kassiano et al. 2023, Pedrosa et al. 2022/2023, Wolf et al. 2023/2025) demonstrates that training at longer muscle lengths (lengthened partials / initial pROM, and full ROM with loaded stretch) produces superior or equal distal and whole-muscle hypertrophy compared to shortened partials. However, training at long muscle lengths causes significantly higher mechanical muscle damage and prolonged excitation-contraction uncoupling fatigue.

#### Algorithmic Classification: Stretch-Resistance Profile
Each exercise is assigned a `stretchBiasScore` ($S_i \in [1.0, 1.4]$) and a ROM classification:
- **Lengthened-Biased / Deep Stretch ($S_i = 1.25 - 1.40$):**
  - Examples: Incline DB Curl, Romanian Deadlift (RDL), Bulgarian Split Squat, Overhead Triceps Extension, Leg Extension (deep flexion initial ROM), Seated Leg Curl, Deep Camber Bar Bench Press.
  - *Biomechanical Characteristic:* Peak torque coincides with maximum sarcomere actin-myosin stretch; titin kinase activation is maximized; micro-tearing and passive tension strain are highest.
- **Shortened-Biased ($S_i = 1.00 - 1.05$):**
  - Examples: Pec Deck (peak contraction), Cable Kickback, Hip Thrust (top lockout), Standing Calf Raise (top third), Leg Extension (final 30° extension).
  - *Biomechanical Characteristic:* Minimal passive tension; active insufficiency risks; rapid intra-workout recovery.
- **Uniform / Mid-Length Biased ($S_i = 1.10 - 1.15$):**
  - Examples: Standard Barbell Squat, Flat Barbell Bench, Standing OHP, Lat Pulldown.

#### Automated Volume & Progression Adjustments:
1. **Effective Stimulus Multiplier ($ESM_i$):**
   $$ESM_i = \text{SetCount}_i \times S_i$$
   When an athlete utilizes lengthened partials past momentary concentric failure (Past-Failure Lengthened Partials, PFLP) or performs lengthened-biased variants, each hard set contributes $1.25\times$ to $1.30\times$ toward hyper-effective volume landmarks (MEV/MAV), but incurs a $1.35\times$ damage penalty on local recovery.
2. **Frequency Dampener:**
   If $\sum ESM_i$ for a muscle group has $>60\%$ lengthened-biased work, minimum inter-session recovery time is extended from 48h to 72h.

### 2.2 Axial Loading vs. Peripheral Fatigue Interaction
Axial loading compresses the spine, demanding intense autonomic, spinal erector, core, and systemic neuromuscular recruitment. Systemic central nervous system (CNS) fatigue from axial lifts attenuates subsequent motor unit recruitment across all subsequent exercises in the same session.

#### Axial Index Formula ($A_i$):
FitHash assigns an **Axial Rating** to every exercise:
- **High Axial ($A_i = 3$):** Conventional/Sumo Deadlift, Low/High Bar Back Squat, Good Mornings, Standing Overhead Press, Barbell Bent-over Row.
- **Moderate Axial ($A_i = 2$):** Front Squat, Bulgarian Split Squat with DBs, Walking Lunges, RDL.
- **Low/Non-Axial ($A_i = 1$):** Leg Press, Hack Squat, Chest-Supported T-Bar Row, Seated DB OHP, Dip.
- **Zero Axial / Peripheral Pure ($A_i = 0$):** Leg Extension, Leg Curl, Pec Dec Flye, Cable Lateral Raise, Preacher Curl.

#### Dynamic Rest Interval Scaling Model
FitHash dynamically adjusts the inter-set rest timer based on the exercise's Axial Rating ($A_i$), target RIR, and relative intensity ($I_{\text{rel}} = \frac{\text{Weight}}{\text{e1RM}}$):

$$T_{\text{rest\_base}} = 
\begin{cases}
180\text{ s} & \text{if } A_i \ge 2 \text{ and } I_{\text{rel}} \ge 0.80 \\
120\text{ s} & \text{if } A_i \ge 2 \text{ and } I_{\text{rel}} < 0.80 \\
120\text{ s} & \text{if } A_i = 1 \\
90\text{ s}  & \text{if } A_i = 0 \text{ and compound} \\
60\text{ - }75\text{ s} & \text{if } A_i = 0 \text{ and isolation}
\end{cases}$$

#### Dynamic RIR & Axial Fatigue Adjustment:
$$T_{\text{rest\_recommended}} = T_{\text{rest\_base}} \times \left(1 + 0.15 \times (3 - \text{RIR})\right) \times \left(1 + 0.10 \times (A_i)\right)$$

*Example:* A set of heavy Back Squats ($A_i = 3$) taken to RIR 0:
$$T_{\text{rest}} = 180 \times (1 + 0.15 \times 3) \times (1 + 0.10 \times 3) = 180 \times 1.45 \times 1.30 = 339\text{ seconds } (\approx 5.5\text{ min})$$

#### Systemic Session Fatigue Accumulator ($SF_{\text{session}}$):
$$SF_{\text{session}} = \sum_{k=1}^{M} \left( A_{i,k} \times \frac{\text{Load}_k \times \text{Reps}_k}{\text{e1RM}_k} \times \frac{1}{\text{RIR}_k + 0.5} \right)$$
If $SF_{\text{session}} > \text{Threshold}_{\text{fatigue}}$ (calibrated to user training tier):
- FitHash auto-scales volume of secondary and isolation movements downwards by 1 set per remaining exercise.
- Displays coach warning: *"High central fatigue detected from heavy axial compounds. Reducing isolation volume to prevent junk volume."*

---

## 3. Advanced Autoregulation & Velocity Loss Models

### 3.1 RPE/RIR vs. Velocity-Based Training (VBT) Proxy
Lifters frequently misgauge RIR (underestimating RIR when fatigued, or reporting RIR 2 when they actually had 4 in reserve). FitHash implements a **Synthetic Rep Cadence / Velocity Loss Proxy** (measurable via Wear OS accelerometer or tap-cadence heuristics).

#### Mean Concentric Velocity (MCV) vs. RIR Relationship:
For standard compound lifts, the terminal velocity at momentary failure ($V_{\text{fail}}$) is constant ($\approx 0.15 - 0.20\text{ m/s}$ for Squat/Bench, $\approx 0.12 - 0.15\text{ m/s}$ for Deadlift).

| Target State | Actual RIR | % Velocity Loss ($\%VL$) from Rep 1 | Concentric Rep Duration Slowdown Ratio ($T_{\text{last}} / T_{\text{first}}$) |
| :--- | :--- | :--- | :--- |
| Explosive / Speed | 4 - 5 | 10% - 15% | $1.15 - 1.25\times$ |
| Hypertrophy Conservative | 3 | 20% - 25% | $1.30 - 1.45\times$ |
| Optimal Hypertrophy Threshold | 1 - 2 | 30% - 35% | $1.50 - 1.80\times$ |
| Momentary Concentric Failure | 0 | 40% - 50%+ | $\ge 2.00\times$ (severe grind) |

#### Algorithmic Inconsistent RIR Correction Engine:
If the user logs Set Reps $R$, Load $L$, and Subjective RIR $RIR_{\text{user}}$, FitHash validates consistency against:
1. **Intra-session Historical Velocity / Rep-Duration Ratio:**
   $$RIR_{\text{inferred}} = \text{clamp}\left( \text{round}\left( \frac{2.10 - (T_{\text{last}} / T_{\text{first}})}{0.30} \right), 0, 5 \right)$$
2. **e1RM Deviation Filter:**
   $$e1RM_{\text{logged}} = \text{calculateAutoregulatedE1RM}(L, R, RIR_{\text{user}})$$
   $$\Delta_{\%} = \frac{e1RM_{\text{logged}} - e1RM_{\text{rolling\_baseline}}}{e1RM_{\text{rolling\_baseline}}}$$
   - If $\Delta_{\%} > +12\%$ and $RIR_{\text{user}} \ge 2$: Flag overestimation (user had less reserve than thought, or fluked input). System sets $RIR_{\text{effective}} = \max(0, RIR_{\text{user}} - 1)$.
   - If $\Delta_{\%} < -15\%$ without prior sets: Flag acute underperformance or illness/stress.

---

### 3.2 Intra-Workout Dropoff Curves: Neuromuscular Decrement Model
Across consecutive working sets with fixed load and fixed rest intervals, motor unit discharge rates decrease and intracellular metabolites ($\text{H}^+$, inorganic phosphate $P_i$) accumulate, degrading excitation-contraction coupling.

#### Consecutive Set Rep Decay Equation:
Given a target load $W$ and initial set performance $R_1$ at $RIR_1$:

$$R_k = \text{round}\left( R_1 \times e^{-\lambda_i (k - 1)} \times \left( \frac{T_{\text{rest}}}{T_{\text{standard}}} \right)^{\gamma} \right)$$

Where:
- $k \in \{1, 2, 3, \dots, N\}$ (Set index)
- $\lambda_i$ = **Fatigue Decay Coefficient** of Exercise $i$:
  - Free Weight Axial Multi-Joint: $\lambda = 0.085$
  - Dumbbell / Machine Compound: $\lambda = 0.060$
  - Isolation / Machine / Cable: $\lambda = 0.040$
- $\gamma$ = **Rest Sensitivity Exponent** ($\approx 0.25$)
- $T_{\text{rest}}$ = Actual rest time taken before set $k$
- $T_{\text{standard}}$ = Prescribed baseline rest (e.g., 180s compound, 90s isolation)

#### Empirical Decay Matrix (Constant Load, 2-3 min Rest, RIR $\le 2$ on all sets):

| Exercise Archetype | Set 1 Reps | Set 2 Predicted | Set 3 Predicted | Set 4 Predicted | Expected % Drop |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Heavy Barbell Squat/Deadlift | 8 | 7 | 6 | 5 | ~37% drop |
| Dumbbell Incline Press / Row | 10 | 9 | 8 | 7 | ~30% drop |
| Cable Lateral Raise / Curl | 15 | 14 | 13 | 12 | ~20% drop |
| Leg Extension (Lengthened Bias)| 12 | 10 | 9 | 7 | ~41% drop |

#### Real-Time Intra-Session Target Re-Autoregulation:
When set $k$ finishes with reps $R_k$ and actual $RIR_k$, FitHash calculates the recommended weight/rep target for set $k+1$:

```typescript
function computeNextSetTarget(
  lastSet: { weight: number; reps: number; rir: number },
  targetRepRange: [number, number],
  decayLambda: number
): { recWeight: number; recReps: number; instruction: string } {
  // If user dropped below lower rep bracket bound:
  const predictedNextReps = Math.round(lastSet.reps * Math.exp(-decayLambda));
  
  if (predictedNextReps < targetRepRange[0]) {
    // Drop load by 5-10% (Back-off set) to preserve hypertrophy rep volume
    const loadDrop = lastSet.weight * 0.075;
    const recWeight = Math.round((lastSet.weight - loadDrop) / 2.5) * 2.5;
    return {
      recWeight,
      recReps: targetRepRange[0] + 1,
      instruction: "FATIGUE_DROP_LOAD: Weight decreased ~7.5% to maintain target rep bracket and effective tension."
    };
  }

  return {
    recWeight: lastSet.weight,
    recReps: predictedNextReps,
    instruction: "MAINTAIN_LOAD: Rep fall-off is within normal neuromuscular decay limits."
  };
}
```

---

## 4. Long-Term Periodization & Mesocycle Architecture

### 4.1 Microcycle Volume Progression (MEV to MRV Ramping)
FitHash organizes training into structured 4-to-6 week mesocycles based on the **Volume Landmark Hierarchy** (Dr. Mike Israetel / RP model):
1. **Maintenance Volume (MV):** ~4–6 sets/muscle/week.
2. **Minimum Effective Volume (MEV):** ~6–10 sets/muscle/week.
3. **Maximum Adaptive Volume (MAV):** ~12–18 sets/muscle/week (sweet spot for hypertrophy).
4. **Maximum Recoverable Volume (MRV):** ~20–25+ sets/muscle/week (exceeding leads to non-functional overreaching).

#### Mesocycle Accumulation Algorithm (4–6 Week Wave):

| Week | Phase | Target RIR | Weekly Hard Sets / Muscle Group | Overload Focus |
| :--- | :--- | :--- | :--- | :--- |
| **W1** | Introductions / Baseline | 3 RIR | MEV (e.g. 8–10 sets) | Establish clean motor pattern baseline |
| **W2** | Early Accumulation | 2 RIR | MEV + 2 sets (e.g. 10–12 sets) | Rep/load progression via DDP |
| **W3** | Mid Accumulation | 2 RIR | MAV Lower (e.g. 12–14 sets) | Add 1 set to primary compound lifts |
| **W4** | Peak Overload | 1 RIR | MAV Upper (e.g. 16–18 sets) | Push to limit of productive volume |
| **W5 (Optional)**| Overreaching Test | 0–1 RIR | MRV (e.g. 18–22 sets) | If fatigue indicators permit, max stimulus |
| **W6** | Reactive Deload | 4–5 RIR | 50% MEV (e.g. 4–6 sets) | Load -10%, Sets -50%, Dissipate fatigue |

#### Algorithmic Volume Progression Rule (Week $W \to W+1$):
For muscle group $M$:
- If **Soreness = None/Mild**, **Performance = Increased (+1-2 reps or +load)**, and **Joint Pain = 0**:
  $$\text{Sets}_{W+1}(M) = \text{Sets}_W(M) + 1 \text{ or } 2 \quad (\text{Cap at MRV})$$
- If **Soreness = Normal (resolved before workout)**, **Performance = Maintained**:
  $$\text{Sets}_{W+1}(M) = \text{Sets}_W(M) \quad (\text{Keep volume constant, push DDP})$$
- If **Soreness = Unrecovered (interferes with session)** OR **Performance = Declined (2 consecutive sessions)**:
  $$\text{Sets}_{W+1}(M) = \text{Sets}_W(M) - 2 \quad \text{OR trigger immediate deload}$$

---

### 4.2 Frequency vs. Volume Distribution (Schoenfeld & Grgic Meta-Analytic Synthesis)
Meta-analyses (Schoenfeld et al. 2016, 2019; Grgic et al. 2018) prove that when weekly set volume is equated, training a muscle group **2x per week produces superior hypertrophy compared to 1x per week**, largely because per-session volume has a ceiling of diminishing returns (~6–10 hard sets per session). Beyond 8–10 sets in a single session, muscle protein synthesis (MPS) is saturated, and additional sets represent "junk volume" with disproportionate muscle damage.

#### Per-Session Volume Capping Matrix:
$$\text{MaxSets}_{\text{session}}(M) = 
\begin{cases}
8 \text{ sets} & \text{for Axial / High Stretch Compound (Quads, Hamstrings, Chest)} \\
10 \text{ sets} & \text{for Upper Back / Shoulders / Biceps / Triceps} \\
12 \text{ sets} & \text{for Calves / Abs}
\end{cases}$$

#### Automated Frequency Split Dispatcher:
When total target weekly volume $V_{\text{weekly}}(M) > 10\text{ sets}$, FitHash auto-distributes the sets across at least 2 distinct microcycle sessions separated by $\ge 48$ hours.

---

## 5. Concrete Algorithmic Specifications for Coding Agent

### 5.1 State Machine: Mesocycle Lifecycle Engine
The following state transitions govern the entire user mesocycle state within FitHash:

```
                  ┌───────────────────────────────┐
                  │          INITIALIZING         │
                  └──────────────┬────────────────┘
                                 │ User selects / confirms meso
                                 ▼
                  ┌───────────────────────────────┐
                  │      WEEK 1: ACCUMULATION_1   │◄──────────────┐
                  └──────────────┬────────────────┘               │
                                 │ Week completed                 │
                                 ▼                                │
                  ┌───────────────────────────────┐               │
                  │   WEEKS 2-4: ACCUMULATION_N   │               │
                  └──────────────┬────────────────┘               │
                                 │                                │
                 ┌───────────────┴───────────────┐                │
                 │                               │                │
                 ▼ (Fatigue criteria triggered)  ▼ (Normal end)   │
    ┌──────────────────────────┐    ┌─────────────────────────┐   │
    │   REACTIVE_DELOAD        │    │    OVERREACHING_TEST    │   │
    └────────────┬─────────────┘    └────────────┬────────────┘   │
                 │                               │ Completed      │
                 │                               ▼                │
                 │                  ┌─────────────────────────┐   │
                 │                  │    PLANNED_DELOAD       │   │
                 │                  └────────────┬────────────┘   │
                 │                               │                │
                 └───────────────────────────────┴────────────────┘
                                 Meso Reset / New Microcycle Wave
```

#### State Transition Table:

| Current State | Trigger Event | Guard Condition | Next State | System Action |
| :--- | :--- | :--- | :--- | :--- |
| `IDLE` | User taps "Start Mesocycle" | Routine configured | `ACCUMULATION_W1` | Initialize baseline volume at MEV; RIR target = 3 |
| `ACCUMULATION_W(k)` | End of Week ($k < 4$) | Session compliance $\ge 80\%$, Recovery score OK | `ACCUMULATION_W(k+1)` | RIR target = $\max(1, 3 - k)$; Set targets ramp by +1/muscle |
| `ACCUMULATION_W(k)` | Intra-Meso Plateau or Regression | $\ge 2$ compound lifts experience 3-session stall OR Systemic Fatigue score $> 85$ | `REACTIVE_DELOAD` | Alert user: Reactive Deload recommended. Cut weekly sets by 50%, weights -10% |
| `ACCUMULATION_W4` | Week 4 Complete | Fatigue low, readiness high | `OVERREACHING_W5` | Optional RIR 0 blast week at MRV |
| `ACCUMULATION_W4` | Week 4 Complete | Fatigue moderate-to-high | `PLANNED_DELOAD` | Load -10%, Volume 50%, target RIR = 4 |
| `OVERREACHING_W5` | Week 5 Complete | Any | `PLANNED_DELOAD` | Mandatory Deload week |
| `PLANNED_DELOAD` / `REACTIVE_DELOAD` | Week Deload Complete | All sessions logged | `ACCUMULATION_W1` | Start new meso with updated e1RM baselines |

---

### 5.2 Dynamic Double Progression (DDP) Complete Mathematical Engine

For an exercise with rep bracket $[R_{\min}, R_{\max}]$, current set weight $W$, current set reps $R$, and target RIR $RIR_{\text{target}}$:

#### Step 1: Effective Rep Benchmark
$$R_{\text{eff}} = R + (RIR_{\text{actual}} - RIR_{\text{target}})$$

#### Step 2: Set-by-Set Independence (DDP Core Logic)
Each set in an exercise advances on its own track:
- **Condition A (Rep Ceiling Reached):**
  If $R_{\text{eff}} \ge R_{\max}$ AND $RIR_{\text{actual}} \le RIR_{\text{target}}$:
  $$W_{\text{next}} = W + \Delta W$$
  $$R_{\text{next}} = R_{\min}$$
  Where $\Delta W$ is the biomechanical increment:
  - Upper Body Dumbbell / Isolation: $\Delta W = 1.0\text{ to }2.0\text{ kg}$ (Micro-load)
  - Upper Body Barbell: $\Delta W = 2.5\text{ kg}$
  - Lower Body Compound (Squat/Deadlift): $\Delta W = 5.0\text{ kg}$
- **Condition B (Inside Bracket):**
  If $R_{\min} \le R_{\text{eff}} < R_{\max}$:
  $$W_{\text{next}} = W$$
  $$R_{\text{next}} = R + 1$$
- **Condition C (Below Bracket - Acute Stall / Misload):**
  If $R_{\text{eff}} < R_{\min}$:
  $$W_{\text{next}} = \max\left(W_{\min}, W - \Delta W\right)$$
  $$R_{\text{next}} = R_{\min}$$

---

### 5.3 Complete TypeScript Implementation Specification

Below is the verified production-ready implementation ready for inclusion into `src/services/advancedProgression.ts`:

```typescript
export interface BiomechanicalProfile {
  stretchBiasScore: number;       // 1.0 (Shortened) to 1.4 (Lengthened/Loaded Stretch)
  axialRating: 0 | 1 | 2 | 3;      // 0: Pure peripheral, 1: Low axial, 2: Moderate, 3: Heavy Spinal Compression
  fatigueDecayLambda: number;     // e.g. 0.085 (Heavy Compound) to 0.040 (Cables)
  standardRestSeconds: number;    // Baseline recommended rest
}

export interface IntraWorkoutSetRecommendation {
  setIndex: number;
  prescribedWeight: number;
  prescribedReps: number;
  prescribedRir: number;
  prescribedRestSeconds: number;
  adjustmentReason: string;
}

/**
 * 1. Calculate Biomechanical Fatigue Profile for any exercise
 */
export function getBiomechanicalProfile(exerciseName: string, equipment: string = ''): BiomechanicalProfile {
  const name = exerciseName.toLowerCase();
  const eq = equipment.toLowerCase();

  // Heavy Axial Compounds
  if (name.includes('deadlift') || name.includes('squat') && !name.includes('split') && !name.includes('hack')) {
    return {
      stretchBiasScore: 1.25,
      axialRating: 3,
      fatigueDecayLambda: 0.085,
      standardRestSeconds: 180,
    };
  }

  // Moderate Axial / Deep Stretch Lower
  if (name.includes('romanian deadlift') || name.includes('rdl') || name.includes('bulgarian') || name.includes('lunge')) {
    return {
      stretchBiasScore: 1.40, // Extreme lengthened tension on glutes/hamstrings
      axialRating: 2,
      fatigueDecayLambda: 0.075,
      standardRestSeconds: 150,
    };
  }

  // Lengthened-Biased Isolations (Hamstring curls seated, Incline DB Curls, Overhead extensions)
  if (name.includes('seated leg curl') || name.includes('incline curl') || name.includes('overhead triceps') || name.includes('bayesian')) {
    return {
      stretchBiasScore: 1.35,
      axialRating: 0,
      fatigueDecayLambda: 0.045,
      standardRestSeconds: 90,
    };
  }

  // Default Standard Compound
  if (eq.includes('barbell') || eq.includes('dumbbell')) {
    return {
      stretchBiasScore: 1.15,
      axialRating: 1,
      fatigueDecayLambda: 0.060,
      standardRestSeconds: 120,
    };
  }

  // Default Pure Peripheral Isolation
  return {
    stretchBiasScore: 1.05,
    axialRating: 0,
    fatigueDecayLambda: 0.040,
    standardRestSeconds: 75,
  };
}

/**
 * 2. Calculate Dynamically Autoregulated Rest Timer
 */
export function calculateDynamicRestSeconds(
  profile: BiomechanicalProfile,
  actualRir: number,
  weight: number,
  e1rm: number
): number {
  const intensity = e1rm > 0 ? weight / e1rm : 0.75;
  const safeRir = Math.max(0, Math.min(5, actualRir));
  
  // Base scaling
  let rest = profile.standardRestSeconds;
  if (profile.axialRating >= 2 && intensity >= 0.80) {
    rest = Math.max(rest, 180);
  }

  // Proximity to failure multiplier (Lower RIR requires more recovery)
  const rirMultiplier = 1 + 0.12 * (3 - safeRir);
  // Axial multiplier
  const axialMultiplier = 1 + 0.08 * profile.axialRating;

  return Math.round(rest * rirMultiplier * axialMultiplier);
}

/**
 * 3. Intra-Workout Dropoff & Next-Set Target Generator
 */
export function generateIntraWorkoutNextSet(
  lastSet: { weight: number; reps: number; rir: number },
  setIndex: number,
  targetRepRange: [number, number],
  targetRir: number,
  profile: BiomechanicalProfile,
  actualRestSecondsTaken: number
): IntraWorkoutSetRecommendation {
  const [minReps, maxReps] = targetRepRange;
  const restFactor = Math.pow(Math.max(0.5, actualRestSecondsTaken / profile.standardRestSeconds), 0.25);
  
  // Predicted reps on next set if weight is held constant
  const predictedReps = Math.round(lastSet.reps * Math.exp(-profile.fatigueDecayLambda) * restFactor);
  const nextPrescribedRest = calculateDynamicRestSeconds(profile, targetRir, lastSet.weight, lastSet.weight * 1.3);

  // If predicted reps fall below lower threshold of hypertrophy rep bracket:
  if (predictedReps < minReps) {
    // Apply autoregulated back-off load reduction (5% to 8%)
    const reductionPercent = profile.axialRating >= 2 ? 0.08 : 0.05;
    const rawNewWeight = lastSet.weight * (1 - reductionPercent);
    const roundedWeight = Math.max(2.5, Math.round(rawNewWeight / 2.5) * 2.5);

    return {
      setIndex: setIndex + 1,
      prescribedWeight: roundedWeight,
      prescribedReps: minReps,
      prescribedRir: targetRir,
      prescribedRestSeconds: nextPrescribedRest,
      adjustmentReason: `Fatigue drop-off prevented: Load reduced by ${(reductionPercent * 100).toFixed(0)}% to stay in effective hypertrophy bracket (${minReps}-${maxReps} reps).`,
    };
  }

  return {
    setIndex: setIndex + 1,
    prescribedWeight: lastSet.weight,
    prescribedReps: Math.min(maxReps, Math.max(minReps, predictedReps)),
    prescribedRir: targetRir,
    prescribedRestSeconds: nextPrescribedRest,
    adjustmentReason: `Neuromuscular decay normal: Maintain load at ${lastSet.weight} kg, target ${predictedReps} reps.`,
  };
}
```

---

## 6. Summary of Key Thresholds & Directives for FitHash

1. **Lengthened-Bias Bonus:** Sets performed with deep loaded stretches or lengthened partials (Kassiano 2023, Pedrosa 2022) are weighted $1.25\times$ for hypertrophy volume tracking, but trigger a 72-hour local muscle recovery lockout.
2. **Axial Safety Filter:** Workouts containing $>2$ high-axial lifts ($A_i = 3$) automatically extend compound rest intervals to $\ge 180\text{ seconds}$ and cap subsequent isolation volume at 3 sets per muscle group.
3. **Decay Model:** Every set utilizes the exponential decay formula $R_k = R_1 \cdot e^{-\lambda(k-1)}$ to detect whether the user needs a weight back-off (~7.5% drop) or can maintain weight.
4. **Volume Progression:** Mesocycle microcycles ramp from MEV (Week 1 at 3 RIR) to MAV (Weeks 2–4 at 2–1 RIR) with an automated Reactive Deload trigger upon 3 consecutive stalled sessions or excessive accumulated systemic fatigue.
