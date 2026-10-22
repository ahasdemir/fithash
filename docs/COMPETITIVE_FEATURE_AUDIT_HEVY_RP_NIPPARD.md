# Comprehensive Competitive Feature Audit: Hevy, Strong, RP Hypertrophy, Jeff Nippard (Pure Bodybuilding) & Lightweight vs. FitHash

**Document Status:** Approved Architectural & Product Reconnaissance  
**Target Platform:** FitHash (React Native / Expo SDK 54 / TypeScript / Standalone Wear OS Companion / Offline-First)  
**Primary Focus:** Biomechanical & Hypertrophy AI Coaching, Gym Quality-of-Life, Fatigue & Recovery Visualization  
**Target Path:** `/home/ahmet/Projects/fitness-tracker/docs/COMPETITIVE_FEATURE_AUDIT_HEVY_RP_NIPPARD.md`  

---

## 1. Executive Summary

FitHash is built on an offline-first architecture with strict local persistence (`AsyncStorage`), direct Wear OS bidirectional communication (`wearSyncService.ts` / Kotlin Wear companion), Health Connect synchronization, and evidence-based overload engines (Dynamic Double Progression, RIR-autoregulated hybrid e1RM, 3-session plateau deload, and biomechanical axial/lengthened fatigue coefficients).

However, modern lifters navigate a competitive landscape of specialized bodybuilding and strength trackers:
1. **Hevy:** The market leader in social workout logging, real-time Apple Watch/Wear OS background sync, muscle recovery heatmaps, and frictionless logging UX.
2. **Strong:** The benchmark for utilitarian gym UI, set tagging (`W`, `D`, `F`), plate loading calculators, and 1RM tables.
3. **RP Hypertrophy App (Renaissance Periodization / Dr. Mike Israetel):** The scientific gold standard for reactive hypertrophy autoregulation—dynamically adding/subtracting weekly sets based on individual pump, soreness, and joint ache ratings within structured mesocycles.
4. **Jeff Nippard's Pure Bodybuilding / MacroFactor Coaching:** The pinnacle of biomechanically grounded exercise execution, resistance-profile-matched exercise substitution engines, progressive warmup protocols, and video cues for execution mastery.
5. **Lightweight / FitNotes:** The minimal, privacy-focused offline logging gold standard with zero battery drain, instant rest/plate presets, and clean data mobility.

This document performs an exhaustive, feature-by-feature comparative reconnaissance across all 5 benchmark applications against FitHash's current codebase. It identifies critical missing architectural components and delivers a phased, code-ready roadmap for transforming FitHash into the definitive offline-first, hypertrophy-science workout tracker.

---

## 2. Benchmark Profiles: 5 Flagship Apps

### 2.1 Hevy
* **Target Audience:** Intermediate-to-advanced gymgoers who value fast logging, social routine sharing, and cross-device sync.
* **Core Strengths:**
  - **Frictionless UI/UX:** Ultra-fast set logging with previous performance ghosted into every input field.
  - **Hardware Integration:** Best-in-class Wear OS and watchOS live tracking with standalone and tethered background execution.
  - **Visual Recovery Heatmap:** Human anatomical 2D silhouette displaying muscle fatigue based on volume decay over 48–72 hours.
  - **Community & Routine Hub:** In-app community feed, social routine cloning via QR/web link, and deep exercise search.
* **Key Limitations:** Simplistic volume accounting (binary set counting; 1 set of Bench Press = 1 set to Chest, ignoring triceps/anterior delts or overcounting); zero autoregulation of load based on fatigue; no mesocycle periodization.

### 2.2 Strong
* **Target Audience:** Powerlifters, strength athletes, and traditional lifters who want zero fluff.
* **Core Strengths:**
  - **Set Tagging System:** Industry standard tagging taxonomy (`Normal`, `Warmup [W]`, `Drop Set [D]`, `Failure [F]`).
  - **Plate Calculator:** Fast visual breakdown of barbell sleeve loads (45/25/10/5/2.5 lb or 25/20/15/10/5/2.5/1.25 kg) with custom bar weight presets (e.g. 20kg Olympic, 15kg Women's, 10kg EZ-bar, 25kg Squat bar).
  - **Warmup Generator:** Automated calculation of 3–5 ramp-up warmup sets leading to working weight with percentage steps.
  - **1RM Percentage Lookup:** Quick reference tables (60%, 70%, 80%, 85%, 90%) for strength prescriptions.
* **Key Limitations:** Development has stagnated for years; lack of biomechanical modeling; no stretch/shortened resistance profiles; no joint pain tracking.

### 2.3 RP Hypertrophy App (Renaissance Periodization)
* **Target Audience:** Dedicated bodybuilders following evidence-based volume landmarks (MEV, MAV, MRV) popularized by Dr. Mike Israetel.
* **Core Strengths:**
  - **Pump & Soreness Autoregulation Loop:** After each exercise, user rates:
    - *Muscle Pump:* 1 (None), 2 (Moderate), 3 (Skin-splitting).
    - *Workload Strain / Joint Ache:* 1 (Pain free), 2 (Irritated), 3 (Severe joint discomfort).
    - *Muscle Soreness (logged before next session):* 1 (Recovered early), 2 (Recovered just in time), 3 (Still sore/stiff).
  - **Automated Set Addition/Subtraction:** If pump is high and soreness recovered early, the app automatically adds +1 set next week. If soreness lingers or joint ache is high, it holds sets constant or subtracts sets.
  - **Mesocycle Periodization Engine:** 4–6 week blocks starting at RIR 3, progressing to RIR 2, RIR 1, RIR 0/Overreaching, terminating in a planned or reactive deload week.
  - **Exercise-Specific RIR Ceilings:** Prevents axial compounds (e.g., Deadlifts, Squats) from accumulating excessive junk volume.
* **Key Limitations:** Expensive recurring monthly subscription; cloud-dependent webview wrapper with high latency; rigid structure that frustrates casual gymgoers.

### 2.4 Jeff Nippard's Pure Bodybuilding / MacroFactor
* **Target Audience:** Hypertrophy enthusiasts focused on optimized biomechanics, regional hypertrophy, and length-tension relationships.
* **Core Strengths:**
  - **Biomechanical Substitution Engine:** Recommends substitutes based on matching resistance profiles (Lengthened vs. Uniform vs. Shortened), equipment availability, and regional muscle focus (e.g., swapping Barbell Squat for Hack Squat to reduce axial fatigue while preserving lengthened quad tension).
  - **Form Mastery & Video Cues:** Direct anatomical cues highlighting active range of motion, scapular position, and tempo prescriptions (e.g., 3-second eccentric stretch).
  - **Integrated Rest & Warmup Flow:** Smart warmup ramps that specifically prime neuromuscular recruitment without fatiguing motor units.
* **Key Limitations:** Proprietary content walls; locked linear program structures with limited free-form logging.

### 2.5 Lightweight / FitNotes
* **Target Audience:** Minimalist lifters, privacy advocates, engineers, and offline purists.
* **Core Strengths:**
  - **Instant Speed & Zero Bloat:** Native rendering with zero cloud latency; loads instantly under low battery or no gym reception.
  - **Data Mobility:** Clean CSV / backup export and restore without vendor lock-in.
  - **Fast Weight/Rep Steppers:** Quick presets (+1.25, +2.5, +5, +10) and instant set duplicating.
* **Key Limitations:** Lacks modern UX animations; zero automated coaching; no biomechanical modeling or recovery calculations.

---

## 3. High-Density Competitive Feature Matrix

The following table compares FitHash against the 5 benchmark applications across all functional dimensions:

| Capability / Feature | FitHash (Current) | Hevy | Strong | RP Hypertrophy | Jeff Nippard / Pure | Lightweight |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Offline-First Architecture** | **Native Local** | Partial (Sync) | Native Local | Cloud Webview | Cloud Required | **Native Local** |
| **Dynamic Double Progression (DDP)** | **Full Native** | Manual | Manual | Semi-Auto | Fixed Rules | Manual |
| **RIR-Autoregulated e1RM & Plateau Deload** | **Full Native** | No | 1RM Epley only | Set Ramping | Fixed Steps | Basic 1RM |
| **Wear OS / Smartwatch Companion** | **Kotlin Wear OS** | WatchOS / WearOS | WatchOS only | No | No | No |
| **Set Tagging (`Normal`, `Warmup`, `Drop Set`, `Myo-Rep`, `Failure`)** | Partial (Warmup only) | Normal, W, D, F | Normal, W, D, F | Normal, Myo, Partials | Normal, Warmup | Normal, Warmup |
| **Barbell Plate Calculator Widget** | Missing | Paid Tier | Yes (Configurable) | No | Limited | Basic |
| **Automated Warmup Set Generator (Ramp-Up %)** | Missing | No | Yes | Yes (Programmed) | Yes | No |
| **Biomechanical Resistance Profile (Lengthened/Uniform/Shortened)** | Data Spec only | No | No | Qualitative | **Yes** | No |
| **Biomechanical Exercise Substitution Engine** | Missing | Category Only | Category Only | Similar Movement | **Resistance Profile Match** | Alphabetical Only |
| **Pump / Soreness / Joint Discomfort Autoregulation** | Missing | No | No | **Core Algorithm** | Survey Cues | No |
| **Muscle Recovery Heatmap (48–72h Decay)** | Missing | **2D Silhouette** | No | Microcycle Text | No | No |
| **Fractional Compound Volume Attribution** | Documented Spec | Binary 1.0 | Binary 1.0 | Fixed Fraction | Partial | Binary 1.0 |
| **Axial vs. Peripheral Fatigue Accumulator** | In Progression Engine | No | No | Axial Capped | Programmed | No |
| **1RM % Percentage Table Quick-Sheet** | Widget e1RM only | Static Chart | **Interactive Table** | Target % based | Fixed Program % | No |
| **Superset / Giant Set Grouping & UI Linkage** | Missing | **Yes** | **Yes** | Limited | Yes | No |
| **Custom Barbell & Collar Weight Offsets** | Missing | Basic | Yes (Custom Bars) | No | No | Basic |

---

## 4. Deep Gap Analysis: Missing High-Impact Features in FitHash

FitHash has already established the mathematical and computational foundation for advanced progressive overload (in `src/services/progressionEngine.ts` and `src/types/fitness.ts`). However, when evaluated against real gym floor ergonomics and competitive flagships, three clear feature clusters are currently absent from the production UX.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FITHASH COMPETITIVE GAPS                              │
├───────────────────────────────┬─────────────────────────────┬───────────────┤
│ 1. BIOMECHANICAL & AI COACH   │ 2. GYM QUALITY-OF-LIFE      │ 3. RECOVERY & │
│                               │                             │    HEATMAPS   │
├───────────────────────────────┼─────────────────────────────┼───────────────┤
│ • Pump/Soreness/Joint Rating  │ • Barbell Plate Calculator  │ • 2D Anatomy  │
│ • Equivalent Exercise Swaps   │ • Warm-up Ramp Generator    │   Heatmap     │
│ • Dynamic Microcycle Ramping  │ • Drop-set / Myo-rep Tags   │ • 48-72h S-C  │
│ • Past-Failure Partials Log   │ • Superset Grouping Cards   │   Decay Curve │
└───────────────────────────────┴─────────────────────────────┴───────────────┘
```

---

### Gap Category 1: Biomechanical & Hypertrophy AI Coaching

#### 1.1 Post-Exercise Reactive Hypertrophy Feedback (RP Model)
* **What Competitors Do (RP App):** Immediately upon completing the final set of an exercise, a 3-question card prompts:
  1. *Pump:* 1 = Low, 2 = Good, 3 = Amazing/Skin-splitting.
  2. *Joint / Tendon Ache:* 1 = Zero pain, 2 = Mild irritation, 3 = Sharp pain / excessive joint load.
  3. Prior to the next session targeting that muscle: *Soreness:* 1 = Fully recovered 24h ago, 2 = Just recovered today, 3 = Still sore/impaired.
* **Why FitHash Needs This:** FitHash calculates neuromuscular fatigue mathematically based on $A_i$ and $\lambda_i$, but lacks individual subjective biological validation. Integrating this loop allows the engine to auto-scale weekly target sets between MEV (Minimum Effective Volume) and MRV (Maximum Recoverable Volume) automatically.

#### 1.2 Biomechanically Equivalent Exercise Substitution Engine (Jeff Nippard Model)
* **What Competitors Do (Pure Bodybuilding):** When a piece of gym equipment is occupied, the lifter taps "Swap Exercise". Instead of showing a random alphabetical list of chest exercises, the app filters by:
  1. *Primary Muscle Subdivision* (e.g., Clavicular Pectoralis Major).
  2. *Resistance Profile / Length-Tension Match* (e.g., Incline DB Press $\rightarrow$ Incline Machine Press $\rightarrow$ Low-to-High Cable Fly).
  3. *Axial Fatigue Swap* (e.g., Swap Barbell Squat for Hack Squat or Belt Squat when spinal erectors are taxed).
* **FitHash State:** FitHash already has `resistanceProfile` ('LENGTHENED' | 'UNIFORM' | 'SHORTENED') and `axialLoadingIndex` (0–3) in `BiomechanicalProfile`, but `ExercisePickerModal.tsx` does not utilize them for intelligent substitution.

#### 1.3 Extended Set Modalities: Drop Sets, Myo-Reps & Lengthened Partials
* **What Competitors Do (Hevy / RP / Strong):** Sets can be tagged not just as `Normal` or `Warmup`, but as:
  - `Drop Set [D]`: Immediate reduction in load with minimal rest.
  - `Myo-Rep [M]`: Activation set to failure followed by 3–5 cluster mini-sets of 3–5 reps with 15s rest.
  - `Lengthened Partials [LP]`: Reps taken past concentric failure in the stretched position.
* **FitHash State:** `ExerciseSet` only has `isWarmup?: boolean`. In `progressionEngine.ts`, stimulus multipliers exist for lengthened work, but the UI cannot log drop sets or myo-reps.

---

### Gap Category 2: Practical Gym Quality-of-Life (Strong & Lightweight UX)

#### 2.1 Visual Barbell Plate Calculator Widget
* **What Competitors Do (Strong / Hevy):** Tapping the weight input or a plate icon next to a barbell or hack squat movement brings up a plate loading sheet:
  - Select Barbell Weight: Olympic Bar (20 kg / 45 lb), Women's Bar (15 kg / 35 lb), EZ-Curl Bar (10 kg), Trap Bar (25 kg), or Smith Machine carriage (typically 7–11 kg).
  - Target Load: Automatically calculates the required plates **per side**.
  - Available Plate Inventory: User can toggle available inventory (e.g., only 20kg, 10kg, 5kg, 2.5kg, 1.25kg).
  - Visual Sleeve Graphic: Shows the plates loaded in descending order with standardized Olympic color-coding (Red 25kg, Blue 20kg, Yellow 15kg, Green 10kg, White 5kg, Black 2.5kg/1.25kg).
* **FitHash State:** Completely missing. Lifters must do mental arithmetic on heavy compound sets.

#### 2.2 Automated Warm-Up Set Generator with Progressive Ramp-Up
* **What Competitors Do (Strong / RP):** Given a target working weight (e.g. 100 kg), the app generates an evidence-based ramp-up protocol:
  - Set 1: Empty Bar (20 kg) $\times 10$ reps (Movement grooving & synovial fluid circulation).
  - Set 2: 50% working load (50 kg) $\times 5$ reps (Light motor unit priming).
  - Set 3: 70% working load (70 kg) $\times 3$ reps (Medium potentiation).
  - Set 4: 85% working load (85 kg) $\times 1$ rep (Post-activation potentiation without fatigue).
  - Auto-inserts these rows as `isWarmup: true`, which are excluded from volume/PR calculations and assigned brief rest timers (45–60s).
* **FitHash State:** Users must manually add warmup sets one by one and manually calculate percentages.

#### 2.3 Superset & Giant-Set Grouping Cards
* **What Competitors Do (Hevy / Strong):** Lifters can link 2 or more exercises into a Superset (e.g., Incline DB Curl + Overhead Cable Triceps Extension). The UI visually connects the cards with a colored accent border, manages alternating set completion, and activates rest timers only after the paired set completes.
* **FitHash State:** All exercises are strictly sequential single lists.

#### 2.4 Quick 1RM % Reference Lookup Sheet
* **What Competitors Do (Strong):** When working with percentage-based routines, a 1-tap sheet displays the lifter's current e1RM broken down into 95%, 90%, 85%, 80%, 75%, 70%, 65%, 60% with the exact plate loads rounded to gym increments.

---

### Gap Category 3: Recovery & Fatigue Visualization (Hevy Silhouette & Biomechanical Heatmaps)

#### 3.1 2D Anatomical Muscle Recovery Heatmap (48–72h Decay)
* **What Competitors Do (Hevy):** A full-body 2D vector silhouette (Anterior and Posterior) displays color-coded muscle status:
  - **Red / Fatigued ($0\% - 40\%$ recovered):** Trained within the last 24 hours or accumulated high volume.
  - **Yellow / Recovering ($41\% - 85\%$ recovered):** 24–48 hours post-session.
  - **Green / Fresh ($86\% - 100\%$ recovered):** 48–72+ hours post-session, ready for progressive overload.
* **FitHash Opportunity (Evidence-Based Elevation):** Hevy's heatmap uses crude binary set counting. FitHash can lead the industry by driving the recovery heatmap using its **Biomechanical Lengthened Damage Multiplier** ($S_i \times \text{SetCount}$) and **Fractional Attribution Matrix** ($C_{i,j}$), providing anatomically realistic recovery forecasting.

#### 3.2 Systemic Spinal / Axial Stress Index & Joint Discomfort Ledger
* **What Competitors Do:** No competitor adequately visualizes the interaction between spinal axial fatigue and local recovery. RP notes joint pain in logs, but provides no historical trend visualizer.
* **FitHash State:** FitHash has the $SF_{\text{session}}$ formula in the Phase 2 specification, but lacks an interactive chart in `AnalyticsTab.tsx` showing weekly spinal compression fatigue and joint stress hotspots.

---

## 5. Architectural Specifications for FitHash

### 5.1 Enhanced Set Tagging Model

Extend `ExerciseSet` in `src/types/fitness.ts`:

```typescript
export type SetTypeTag = 'NORMAL' | 'WARMUP' | 'DROPSET' | 'MYOREP' | 'FAILURE';

export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: number;
  reps: number;
  tag?: SetTypeTag;        // Replaces legacy isWarmup boolean while maintaining backward compatibility
  isWarmup?: boolean;      // Kept for backward compatibility (tag === 'WARMUP')
  isPR?: boolean;
  rir?: number;            // Reps in reserve
  targetRepsMin?: number;
  targetRepsMax?: number;
  // Execution extensions
  partialRepsLengthened?: number; // Reps performed past failure in lengthened position
  restSecondsTaken?: number;
  completed: boolean;
}
```

### 5.2 Barbell Plate Calculator Algorithm

A deterministic, greedy change-making algorithm calibrated for gym plates:

```typescript
export interface PlateCalculationResult {
  targetWeight: number;
  barbellWeight: number;
  weightPerSide: number;
  platesPerSide: { weight: number; count: number; colorHex: string }[];
  remainder: number;
  isExact: boolean;
}

export const OLYMPIC_PLATES_KG = [
  { weight: 25, colorHex: '#EF4444', label: '25 kg' }, // Red
  { weight: 20, colorHex: '#3B82F6', label: '20 kg' }, // Blue
  { weight: 15, colorHex: '#FBBF24', label: '15 kg' }, // Yellow
  { weight: 10, colorHex: '#10B981', label: '10 kg' }, // Green
  { weight: 5,  colorHex: '#FFFFFF', label: '5 kg' },  // White
  { weight: 2.5, colorHex: '#1F2937', label: '2.5 kg' }, // Black
  { weight: 1.25, colorHex: '#9CA3AF', label: '1.25 kg' } // Micro
];

export function calculatePlates(
  totalWeight: number,
  barbellWeight: number = 20,
  availablePlates = OLYMPIC_PLATES_KG
): PlateCalculationResult {
  if (totalWeight <= barbellWeight) {
    return {
      targetWeight: totalWeight,
      barbellWeight,
      weightPerSide: 0,
      platesPerSide: [],
      remainder: 0,
      isExact: totalWeight === barbellWeight,
    };
  }

  let sideWeight = (totalWeight - barbellWeight) / 2;
  const platesPerSide: { weight: number; count: number; colorHex: string }[] = [];

  for (const plate of availablePlates) {
    if (sideWeight <= 0) break;
    const count = Math.floor(sideWeight / plate.weight);
    if (count > 0) {
      platesPerSide.push({
        weight: plate.weight,
        count,
        colorHex: plate.colorHex,
      });
      sideWeight = Math.round((sideWeight - count * plate.weight) * 100) / 100;
    }
  }

  return {
    targetWeight: totalWeight,
    barbellWeight,
    weightPerSide: (totalWeight - barbellWeight) / 2,
    platesPerSide,
    remainder: sideWeight * 2,
    isExact: sideWeight === 0,
  };
}
```

### 5.3 Warm-Up Set Protocol Generator

```typescript
export interface WarmupSetProtocol {
  setNumber: number;
  percentage: number;
  weight: number;
  reps: number;
  restSeconds: number;
  annotation: string;
}

export function generateWarmupProtocol(
  workingWeight: number,
  barWeight: number = 20
): WarmupSetProtocol[] {
  if (workingWeight <= barWeight * 1.5) {
    // Light weight: single bar primer
    return [
      {
        setNumber: 1,
        percentage: 50,
        weight: barWeight,
        reps: 10,
        restSeconds: 45,
        annotation: 'Barbell Mobility & Primer',
      },
    ];
  }

  const roundToIncrement = (w: number) => Math.max(barWeight, Math.round(w / 2.5) * 2.5);

  return [
    {
      setNumber: 1,
      percentage: 0,
      weight: barWeight,
      reps: 10,
      restSeconds: 45,
      annotation: 'Barbell Form Groove',
    },
    {
      setNumber: 2,
      percentage: 50,
      weight: roundToIncrement(workingWeight * 0.5),
      reps: 5,
      restSeconds: 60,
      annotation: 'Sub-maximal Neuromuscular Primer',
    },
    {
      setNumber: 3,
      percentage: 70,
      weight: roundToIncrement(workingWeight * 0.7),
      reps: 3,
      restSeconds: 75,
      annotation: 'Motor Unit Recruitment',
    },
    {
      setNumber: 4,
      percentage: 85,
      weight: roundToIncrement(workingWeight * 0.85),
      reps: 1,
      restSeconds: 90,
      annotation: 'Potentiation (PAP) - Zero Fatigue',
    },
  ];
}
```

### 5.4 Muscle Recovery Decay Formula (48–72h S-Curve)

Using a modified sigmoidal Hill function to model neuromuscular and myofibrillar repair over time:

$$R(t, j) = \frac{t^\beta}{t^\beta + (\tau_{j} \cdot \mu_j)^\beta} \times 100\%$$

Where:
- $t$: Elapsed hours since the last completed working set on muscle $j$.
- $\beta$: Hill recovery slope factor ($\approx 2.5$).
- $\tau_j$: Baseline recovery half-life ($\tau = 36\text{ hours}$ for small isolations like lateral delts/biceps; $\tau = 48\text{ hours}$ for large compounds like quads/erectors).
- $\mu_j$: Damage modifier based on lengthened bias and volume:
  $$\mu_j = 1 + 0.15 \times \left(\frac{\text{LengthenedSets}}{\text{TotalSets}}\right) + 0.05 \times \max(0, \text{HardSets} - 6)$$

```typescript
export interface MuscleRecoveryStatus {
  muscleId: string;
  muscleName: string;
  recoveryPercentage: number; // 0 to 100
  hoursSinceTrained: number;
  status: 'FATIGUED' | 'RECOVERING' | 'OPTIMAL' | 'SUPERCOMPENSATED';
  colorHex: string;
}

export function computeMuscleRecovery(
  lastTrainedTimestamp: number,
  isLengthenedBiased: boolean = false,
  hardSetCount: number = 4
): number {
  const elapsedHours = (Date.now() - lastTrainedTimestamp) / (1000 * 60 * 60);
  if (elapsedHours <= 0) return 0;

  const baseTau = 36; // 36h half-life
  const damageModifier = 1 + (isLengthenedBiased ? 0.2 : 0) + Math.max(0, hardSetCount - 5) * 0.05;
  const tauEffective = baseTau * damageModifier;

  const beta = 2.4;
  const recovery = (Math.pow(elapsedHours, beta) / (Math.pow(elapsedHours, beta) + Math.pow(tauEffective, beta))) * 100;
  return Math.min(100, Math.round(recovery));
}
```

---

## 6. Actionable Implementation Roadmap

```
PHASE 1: Gym Floor QoL (Immediate High-Impact Ergonomics)
├── [1.1] Set Tagging Taxonomy: Normal, Warmup [W], Drop Set [D], Myo-Rep [M], Failure [F]
├── [1.2] Modal Barbell Plate Calculator with custom bar weights and Olympic color coding
└── [1.3] 1-Tap Warmup Set Protocol Generator in ActiveWorkoutModal

PHASE 2: Hypertrophy AI & Biomechanical Intelligence
├── [2.1] Post-exercise RP Feedback Modal (Pump: 1-3, Joint Ache: 1-3)
├── [2.2] Pre-workout Soreness Check-in (1-3) feeding weekly set volume adjustments
├── [2.3] Biomechanical Exercise Substitution Engine (matching resistanceProfile & axial index)
└── [2.4] Lengthened partials past failure logger (PFLP)

PHASE 3: Visualization, Recovery & Advanced UI
├── [3.1] Interactive 2D Muscle Recovery Heatmap (Anterior/Posterior vector canvas)
├── [3.2] Superset / Giant Set UI grouping with alternating timers
├── [3.3] Systemic Spinal / Axial Stress Index chart in AnalyticsTab
└── [3.4] Interactive 1RM Percentage Lookup Sheet
```

### Milestone Specifications

#### Milestone 1: Gym Floor QoL & Set Tagging (Target: Immediate)
1. **Model Update:** Extend `ExerciseSet` in `src/types/fitness.ts` with `tag: 'NORMAL' | 'WARMUP' | 'DROPSET' | 'MYOREP' | 'FAILURE'`.
2. **Set Numbering Engine:** Update `ActiveWorkoutModal.tsx` to handle tag badging:
   - `W`: Warmup (gray badge, excluded from volume and PRs).
   - `D`: Drop Set (purple badge, linked to prior set load).
   - `F`: Failure / RIR 0 (red badge, flags neuromuscular check).
3. **Plate Calculator Modal:** Component `src/components/PlateCalculatorModal.tsx` accessible via a plate icon beside any barbell/smith exercise.
4. **Warmup Protocol Generator:** "Add Warmup Ramp" button above sets in `ActiveWorkoutModal.tsx` injecting calculated warmup sets.

#### Milestone 2: RP-Style Reactive Autoregulation & Biomechanical Swaps
1. **RP Feedback Modal:** Lightweight sheet appearing when the last set of an exercise is completed, capturing `pumpScore` (1–3) and `jointAcheScore` (1–3).
2. **Weekly Set Adjustment Engine:** Implement Dr. Mike Israetel's volume adjustment rules:
   - High pump ($3$), zero soreness ($1$) $\rightarrow$ Add $+1$ working set next week.
   - Low pump ($1$), high soreness ($3$), or high joint ache ($3$) $\rightarrow$ Subtract $-1$ set or recommend a lower-axial exercise substitution.
3. **Smart Exercise Substitution Modal:** Filter exercise library by matching `category`, `resistanceProfile`, and offering lower `axialLoadingIndex` variants.

#### Milestone 3: 2D Anatomical Recovery Heatmap & Superset Architecture
1. **SVG Anatomical Heatmap:** Lightweight React Native SVG component in `src/components/MuscleRecoveryHeatmap.tsx` rendering anterior/posterior muscle groups color-coded by the 48–72h recovery equation.
2. **Superset Grouping:** Add `supersetGroupId?: string` to `WorkoutExercise` and render linked cards with connected borders and interleaved rest timers.
3. **Spinal Axial Stress Dashboard:** Render weekly cumulative spinal compression units in `AnalyticsTab.tsx`.

---

## 7. Competitive Edge Summary

By executing this prioritized roadmap, FitHash unites the best elements of the fitness app ecosystem into a unified, privacy-respecting, zero-subscription tool:
* **The utilitarian speed of Strong & Lightweight** (frictionless logging, plate calculator, instant warmup generation).
* **The hardware integration and visual recovery of Hevy** (Wear OS companion + evidence-based 2D muscle recovery heatmap).
* **The periodized scientific intelligence of RP Hypertrophy** (pump, soreness, joint pain feedback loops, mesocycle progression, volume landmark autoregulation).
* **The biomechanical optimization of Jeff Nippard** (resistance profile matching, lengthened partial logging, axial fatigue mitigation).
* **All wrapped in FitHash's 100% offline, privacy-first local architecture.**
