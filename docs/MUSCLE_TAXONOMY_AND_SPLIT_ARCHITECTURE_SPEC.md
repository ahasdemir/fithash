# FitHash Scientific Specification: Evidence-Based Muscle Group Taxonomy, Fractional Compound Volume Attribution, and Split Architecture Engine

**Version:** 3.0.0  
**Author:** FitHash Scientific Research & Biomechanics Architecture Group  
**Target Platform:** React Native / Expo (Offline-First TypeScript Engine) & Wear OS  
**Status:** Approved for Implementation  
**Output Target:** `/home/ahmet/Projects/fitness-tracker/docs/MUSCLE_TAXONOMY_AND_SPLIT_ARCHITECTURE_SPEC.md`

---

## 1. Executive Summary & Problem Formulation

Standard fitness tracking applications suffer from two opposing anatomical design flaws:
1. **Gross Over-Simplification ("Bro Taxonomy"):** Categorizing volume purely by "Chest", "Back", "Legs", "Arms", and "Shoulders". This treats a Barbell Bent-Over Row, Lat Pulldown, and Face Pull identically as "Back", ignoring that latissimus dorsi mechanical leverage peaks during vertical pulling and shoulder extension with tight humeral adduction, whereas the mid-trapezius and rhomboids peak during horizontal scapular retraction. This leads to severe lagging divisions (e.g., undertrained upper back or clavicular chest) and unmonitored overuse injuries.
2. **Impractical Micro-Segmentation:** Tracking every individual head or muscle belly as an independent target (e.g., tracking *vastus medialis* separately from *vastus lateralis*), which cannot be isolated through resistance training without impossible biomechanical contortions.

Furthermore, traditional volume tracking counts exercises in binary integer sets (1 set of Squats = 1 set of Quads, 0 sets of Glutes/Adductors; or 1 set of Bench Press = 1 set of Chest, 1 set of Triceps, 1 set of Anterior Delts). The 2020–2026 exercise science literature (Baz-Valle et al. 2021, Schoenfeld et al. 2020, Wolf et al. 2023, Pelland et al. 2024, Refalo et al. 2023) demonstrates that **fractional set attribution** based on mechanical tension and relative electromyographic/fractional physiological cross-sectional area (PCSA) contribution is essential for valid volume tracking.

This specification provides:
1. A **2-Tier Anatomical Muscle Taxonomy** (12 Primary Functional Muscle Groups subdivided into 28 Biomechanically Isolated Muscle Divisions).
2. A **Fractional Volume Attribution Matrix ($C_{i,j} \in [0.0, 1.0]$)** across all major multi-joint compound movement patterns, accounting for prime mover vs. synergist vs. dynamic stabilizer recruitment.
3. Rigorous **Volume Landmarks** (Maintenance Volume [MV], Minimum Effective Volume [MEV], Maximum Adaptive Volume [MAV], and Maximum Recoverable Volume [MRV]) per muscle group.
4. **Intra-Session Volume Ceilings** ($5 - 8$ hard sets per muscle group per session) to eliminate "junk volume".
5. Complete **Split Architecture Archetypes** (3-day, 4-day, 5-day, and 6-day splits) with dynamic weekly frequency balancing ($2\times/\text{week}$ optimal frequency per muscle division).
6. Complete **TypeScript Data Structures, Interfaces, Concrete Matrices, and Split Recommendation Algorithms** ready for immediate compilation into FitHash.

---

## 2. Evidence-Based Muscle Group Taxonomy

### 2.1 Biomechanical Segmentation Rationale (2020–2026 Literature)

To provide actionable tracking without user interface fatigue, FitHash establishes a **Tier 1 (Major Muscle Group)** and **Tier 2 (Hypertrophy Target Sub-division)** hierarchy:

```
Tier 1: Major Functional Group (12 Groups)
└── Tier 2: Biomechanical Muscle Sub-division (28 Divisions)
```

#### Detailed Anatomical Justifications:

1. **Chest (Pectoralis Major):**
   - **Clavicular Head (Upper Chest):** Fibers originate along the medial half of the clavicle. Peak moment arm and recruitment occur during humerus flexion combined with horizontal adduction at an incline angle of $30^\circ - 45^\circ$ (Rodríguez-Ridao et al. 2020).
   - **Sternal / Costal Head (Mid & Lower Chest):** Fibers originate from the sternum and upper costal cartilages. They require horizontal adduction on flat or slight decline surfaces ($0^\circ$ to $-15^\circ$) or converging cable flyes.
2. **Back (Posterior Torso):**
   - **Latissimus Dorsi & Teres Major (Vertical Pull / Shoulder Extension):** Line of pull runs sagittally and diagonally. Highly stimulated when the elbow is tucked closer to the torso ($\le 45^\circ$ humeral abduction).
   - **Upper Back (Mid/Lower Trapezius & Rhomboids):** Line of pull requires wide elbow abduction ($60^\circ - 90^\circ$) and pronounced scapular retraction and upward/downward rotation (e.g., 45° Chest-Supported Rows, Wide Kelso Rows).
   - **Spinal Erectors (Thoracolumbar Extensors):** Static isometric and dynamic spinal extension resisting spinal flexion (RDLs, Good Mornings, Back Extensions).
3. **Shoulders (Deltoids):**
   - **Anterior Deltoid:** Frontal humerus flexion. Heavily activated in pressing movements (Bench Press, Incline Press, OHP). Rarely requires dedicated isolation unless pressing volume is minimal.
   - **Lateral Deltoid:** Abduction in the scapular plane ($30^\circ$ forward of coronal plane). Requires direct abduction or upright rowing due to minimal involvement in horizontal or vertical presses.
   - **Posterior Deltoid:** Horizontal humeral abduction and external rotation. Distinct from mid-traps; requires elbow line of drive tracking backwards at $45^\circ - 90^\circ$ of abduction (Reverse Flyes, Face Pulls).
4. **Quadriceps:**
   - **Vasti Complex (*Vastus Lateralis, Medialis, Intermedius*):** Monoarticular knee extensors. Heavily loaded in knee-dominant deep squats, leg presses, and hack squats where peak moment arm occurs at deep knee flexion.
   - **Rectus Femoris:** Biarticular hip flexor and knee extensor. Due to active/passive insufficiency across joint configurations, the rectus femoris does *not* significantly hypertrophy from multi-joint squats or leg presses; it requires isolated seated leg extensions (deep hip flexion + knee extension) or sissy squats (Pedrosa et al. 2022, Wolf et al. 2023).
5. **Hamstrings:**
   - **Biceps Femoris (Long Head), Semitendinosus, Semimembranosus (Hip Extension):** Biarticular posterior chain muscles. Maximally loaded under eccentric stretch via hip hinge movements (RDL, Stiff-Leg Deadlift).
   - **Knee Flexion Dominant (Seated/Lying Leg Curls):** Seated leg curl places hamstrings at longer muscle lengths (hip flexed), yielding superior hypertrophy compared to lying leg curl (Maeo et al. 2021).
6. **Gluteals & Adductors:**
   - **Gluteus Maximus:** Loaded heavily in deep hip flexion compounds (Squat, Bulgarian Split Squat) and terminal hip extension (Hip Thrust, 45° Hyperextension).
   - **Gluteus Medius & Minimus:** Pelvic stabilization and hip abduction. Requires abduction or kickback variations.
   - **Adductor Magnus:** The primary hip extensor out of deep hip flexion ($>60^\circ$ depth), sharing substantial load in deep squats and wide stances (Vigotsky et al. 2020).
7. **Triceps Brachii:**
   - **Medial & Lateral Heads:** Monoarticular elbow extensors. Heavily stimulated across all compound pressing (Bench, Dips, Close-Grip) and neutral pushdowns.
   - **Long Head:** Biarticular muscle crossing shoulder and elbow. Requires overhead or incline stretch extension movements to counter active insufficiency (Maeo et al. 2022).
8. **Biceps Brachii & Forearms:**
   - **Biceps Brachii (Long & Short Head):** Biarticular elbow flexor and forearm supinator. Highly stimulated in supinated curls and vertical pulling (chin-ups).
   - **Brachialis & Brachioradialis:** Prime flexors under neutral (hammer) or pronated grips. Brachialis sits deep under biceps, driving upper arm thickness.
   - **Forearm Flexors & Extensors:** Grip endurance, wrist flexion/extension.
9. **Calves:**
   - **Gastrocnemius:** Biarticular calf crossing the knee. Requires knee-extended calf raises (Standing Calf Raise, Leg Press Calf Raise) to avoid active insufficiency.
   - **Soleus:** Monoarticular calf muscle. Exclusively targeted when knees are bent at $90^\circ$ (Seated Calf Raise).
10. **Abdominals & Core:**
    - **Rectus Abdominis:** Spinal flexion (Crunches, Hanging Leg Raises).
    - **Obliques & Transverse Abdominis:** Rotational, anti-rotation (Pallof press), and lateral flexion.

---

## 3. Fractional Compound Volume Attribution Engine

### 3.1 The Direct vs. Indirect Attribution Problem
In conventional logs, 1 set of Barbell Bench Press is attributed as $1.0$ set to Chest and either ignored for Triceps/Shoulders or tallied as $1.0$ set to Triceps. Both methods distort the lifter's actual weekly volume:
- Assigning $1.0$ Triceps to Bench Press results in artificial volume inflation; 10 sets of Bench Press do not equate to 10 sets of Overhead Cable Extensions for Triceps long head hypertrophy.
- Assigning $0.0$ Triceps to Bench Press falsely under-reports triceps fatigue, causing the coach to program excessive isolation sets that exceed the lifter's MRV.

### 3.2 Evidence-Based Fractional Contribution Weightings ($C_{i,j}$)
Based on meta-analyses by Schoenfeld et al., Baz-Valle et al. (2021), and Vieira et al. (2022), FitHash establishes fractional volume coefficients $C_{i,j} \in [0.0, 1.0]$:

| Movement Pattern / Exercise | Prime Mover ($C = 1.0$) | Secondary / Synergist ($C = 0.5$) | Tertiary / Dynamic Stabilizer ($C = 0.25$) |
| :--- | :--- | :--- | :--- |
| **Flat Barbell / DB Bench Press** | Chest (Sternal): $1.0$ | Triceps (Med/Lat): $0.5$, Anterior Deltoid: $0.5$ | Chest (Clavicular): $0.25$ |
| **Incline Press (30° - 45°)** | Chest (Clavicular): $1.0$ | Anterior Deltoid: $0.5$, Triceps (Med/Lat): $0.5$ | Chest (Sternal): $0.25$ |
| **Dips (Chest Focus - Torso Leaned)** | Chest (Sternal): $1.0$ | Triceps (Med/Lat): $0.5$, Anterior Deltoid: $0.5$ | - |
| **Close-Grip Bench Press** | Triceps (Med/Lat): $1.0$ | Chest (Sternal): $0.5$, Anterior Deltoid: $0.5$ | - |
| **Overhead Press (Barbell / DB / MCH)** | Anterior Deltoid: $1.0$ | Triceps (Med/Lat): $0.5$, Lateral Deltoid: $0.25$ | Upper Back (Traps): $0.25$ |
| **Vertical Pull (Lat Pulldown / Pull-Up)** | Latissimus Dorsi: $1.0$ | Biceps (Brachii): $0.5$, Brachialis: $0.5$, Upper Back: $0.25$ | Posterior Deltoid: $0.25$ |
| **Chin-Up (Supinated Grip)** | Latissimus Dorsi: $1.0$ | Biceps (Brachii): $0.75$, Brachialis: $0.5$ | Upper Back: $0.25$ |
| **Horizontal Row (Chest-Supported Wide)**| Upper Back (Traps/Rhomb): $1.0$ | Posterior Deltoid: $0.5$, Biceps: $0.25$, Brachialis: $0.5$ | Latissimus Dorsi: $0.25$ |
| **Barbell Bent-Over Row (Torso 45°)** | Upper Back: $0.75$, Lats: $0.75$ | Biceps: $0.5$, Spinal Erectors: $0.5$ | Hamstrings (Iso): $0.25$, Posterior Delt: $0.25$ |
| **Conventional Deadlift** | Spinal Erectors: $1.0$, Gluteus Max: $0.75$ | Hamstrings: $0.5$, Adductor Magnus: $0.5$, Forearms: $0.5$ | Upper Back (Traps): $0.5$, Quads: $0.25$ |
| **Romanian Deadlift (RDL)** | Hamstrings (Biarticular): $1.0$, Gluteus Max: $0.75$ | Spinal Erectors: $0.5$, Adductor Magnus: $0.5$ | Forearms: $0.25$ |
| **Back Squat (Deep, High/Low Bar)** | Quads (Vasti): $1.0$, Gluteus Max: $0.75$ | Adductor Magnus: $0.5$, Spinal Erectors: $0.5$ | Quads (Rectus Femoris): $0.0$, Calves: $0.1$ |
| **Front Squat / Hack Squat** | Quads (Vasti): $1.0$ | Gluteus Max: $0.5$, Adductor Magnus: $0.25$ | Spinal Erectors: $0.25$, Core: $0.25$ |
| **Bulgarian Split Squat** | Quads (Vasti): $0.75$, Gluteus Max: $0.75$ | Adductor Magnus: $0.5$, Gluteus Medius: $0.25$ | Hamstrings: $0.1$ |
| **Hip Thrust** | Gluteus Max: $1.0$ | Hamstrings: $0.25$, Adductor Magnus: $0.25$ | Quads: $0.1$ |
| **Isolated Movements (Curls, Extensions, Flyes, Raises)** | Target Muscle: $1.0$ | Secondary: $0.0$ | - |

### 3.3 Mathematical Volume Aggregation Formula

For any target muscle division $j$ within a given microcycle (week) consisting of $M$ completed sets:

$$\text{EffectiveWeeklyVolume}_j = \sum_{k=1}^{M} \left( \text{SetCompleted}_k \times C_{k,j} \times S_k \times \Phi(\text{RIR}_k) \right)$$

Where:
- $\text{SetCompleted}_k \in \{0, 1\}$ indicates whether set $k$ was a working set ($\text{completed} = \text{true}$, not warm-up).
- $C_{k,j} \in [0.0, 1.0]$ is the exercise-to-muscle fractional attribution coefficient.
- $S_k \in [1.0, 1.3]$ is the **Lengthened-Bias Stimulus Multiplier** from FitHash Phase 2 (exercises with peak resistance at full stretch produce $1.25\times - 1.30\times$ sarcomere mechanical strain).
- $\Phi(\text{RIR}_k)$ is the **RIR Effective Stimulus Factor**:
  $$\Phi(\text{RIR}_k) = \begin{cases} 
  1.0 & \text{if } \text{RIR}_k \le 2 \\
  0.75 & \text{if } \text{RIR}_k = 3 \\
  0.50 & \text{if } \text{RIR}_k = 4 \\
  0.0 & \text{if } \text{RIR}_k \ge 5 \text{ (warm-up / non-stimulative)}
  \end{cases}$$

---

## 4. Hypertrophy Volume Landmarks & Session Ceilings

### 4.1 Volume Landmarks Definition (Sets per Week)

Based on Israetel et al. (RP Model) and updated meta-regressions (Schoenfeld, Pelland 2024), FitHash establishes default baseline volume landmarks per muscle group (scaled dynamically by user training tier: Novice $\times 0.75$, Intermediate $\times 1.0$, Advanced $\times 1.25$):

| Major Muscle Group | MV (Sets/wk) | MEV (Sets/wk) | MAV (Sets/wk) | MRV (Sets/wk) | Max Frequency / wk | Min Recovery Period |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Chest** | 4 | 8 | 12 - 18 | 22 | $3\times$ | 48h |
| **Back (Lats & Upper Back)** | 6 | 10 | 14 - 22 | 26 | $3\times$ | 48h |
| **Quadriceps** | 4 | 8 | 12 - 18 | 20 | $2 - 3\times$ | 72h (if high axial/lengthened) |
| **Hamstrings** | 3 | 6 | 10 - 16 | 18 | $2 - 3\times$ | 72h (lengthened RDLs) |
| **Gluteals** | 0 (covered by compounds) | 4 | 8 - 14 | 18 | $3\times$ | 48h |
| **Shoulders (Lateral Delt)** | 6 | 8 | 14 - 24 | 28 | $4 - 5\times$ | 24 - 48h (fast recovery) |
| **Shoulders (Rear Delt)** | 4 | 6 | 10 - 18 | 22 | $4\times$ | 24 - 48h |
| **Shoulders (Anterior Delt)**| 0 (compound covered) | 0 | 4 - 8 (isolated) | 12 | $2\times$ | 48h |
| **Triceps Brachii** | 2 | 6 | 10 - 16 | 20 | $3\times$ | 48h |
| **Biceps Brachii** | 4 | 6 | 10 - 18 | 22 | $3\times$ | 48h |
| **Calves** | 4 | 8 | 12 - 20 | 24 | $4\times$ | 24 - 48h |
| **Abdominals** | 0 | 4 | 8 - 14 | 18 | $3\times$ | 48h |

### 4.2 Intra-Session Volume Ceiling ("Junk Volume Law")

Data demonstrates that the relationship between per-session volume and muscle protein synthesis follows an asymptotic diminishing-returns curve:
- **Optimal Hypertrophy Stimulus Range:** $3 - 6$ hard sets per muscle group per session.
- **Diminishing Returns ("Soft Ceiling"):** $6 - 8$ hard sets per muscle group per session.
- **Junk Volume ("Hard Ceiling"):** $>8$ hard sets per muscle group per single workout session. Sets beyond 8–10 in a single session produce acute intracellular excitation-contraction uncoupling, disproportionate muscle damage, and prolonged central nervous fatigue without proportional myofibrillar protein synthesis accretion.

$$\text{SessionVolumeThresholds} = \begin{cases}
\text{Optimal:} & 3 \le V_{\text{session}} \le 6 \\
\text{Diminishing:} & 6 < V_{\text{session}} \le 8 \\
\text{Junk Volume Warning:} & V_{\text{session}} > 8 \implies \text{Split volume across another day}
\end{cases}$$

---

## 5. Optimal Evidence-Based Workout Split Architectures

The training frequency literature establishes that for a given weekly volume (e.g. 14 sets of Chest), training a muscle group **twice per week** ($2 \times 7$ sets) is superior to **once per week** ($1 \times 14$ sets) due to staying below per-session junk volume ceilings and stimulating Muscle Protein Synthesis (MPS) spikes twice in a 7-day period (Schoenfeld et al. 2016, 2021).

FitHash supports four core training frequency schedules:

### 5.1 3-Day Architecture: Full Body $(A / B / C)$
- **Target User:** Beginners, time-constrained individuals, or recovery-limited trainees.
- **Weekly Structure:** Non-consecutive days (e.g., Monday, Wednesday, Friday).
- **Per-Session Pattern:** Every muscle group trained with $3 - 5$ sets, hitting $10 - 15$ weekly sets at an optimal frequency of $3\times/\text{week}$.
- **Exercise Rotation:**
  - Day 1 (Full Body A): Quad Focus Squat, Flat Press, Lat Pulldown, Hamstring Hinge, Triceps.
  - Day 2 (Full Body B): Hip Hinge (RDL), Incline Press, Chest-Supported Row, Leg Extension, Lateral Raise, Biceps.
  - Day 3 (Full Body C): Hack Squat / Leg Press, Dips, Pull-Up, Seated Leg Curl, Rear Delts, Calves.

### 5.2 4-Day Architecture: Upper / Lower $(A / B)$
- **Target User:** Intermediates and the golden standard for muscle hypertrophy balance.
- **Weekly Structure:** 2 on, 1 off, 2 on, 2 off (e.g., Mon: Upper 1, Tue: Lower 1, Wed: Rest, Thu: Upper 2, Fri: Lower 2, Sat-Sun: Rest).
- **Muscle Frequency:** Strict $2\times/\text{week}$ per muscle group.
- **Volume per Session:** $5 - 7$ sets per muscle group, ideally within the 6-8 set per-session ceiling.
- **Synergy:** Eliminates overlap issues; leg training is fully quarantined from upper pushing/pulling.

### 5.3 5-Day Architecture: Push / Pull / Legs / Upper / Lower (PPL-UL)
- **Target User:** Advanced trainees needing 14–20 sets/week per muscle group without exceeding the 8-set daily session ceiling.
- **Weekly Structure:** Mon: Push, Tue: Pull, Wed: Legs, Thu: Rest, Fri: Upper, Sat: Lower, Sun: Rest.
- **Muscle Frequency:** $2\times/\text{week}$ for all primary groups.
- **Fatigue Management:** High axial movements placed early in the week; Friday/Saturday Upper/Lower uses higher machine/cable ratio to control systemic fatigue ($SF_{\text{session}}$).

### 5.4 6-Day Architecture: Push / Pull / Legs $\times 2$ (PPLRPPL)
- **Target User:** Highly conditioned, advanced lifters with high MRV capabilities.
- **Weekly Structure:** Mon: Push A, Tue: Pull A, Wed: Legs A, Thu: Push B, Fri: Pull B, Sat: Legs B, Sun: Rest (or rolling 3-on-1-off).
- **Volume Distribution:** Micro-dosed volume ($4 - 6$ sets per muscle group per workout) totaling $10 - 16$ weekly sets at $2\times/\text{week}$ frequency.

---

## 6. TypeScript Architecture & Concrete Specifications

### 6.1 Anatomical Types & Taxonomy Specification (`src/types/muscleTaxonomy.ts`)

```typescript
/**
 * FitHash Phase 3 Anatomical & Hypertrophy Split Engine
 * File: src/types/muscleTaxonomy.ts
 */

export type PrimaryMuscleGroup =
  | 'CHEST'
  | 'BACK'
  | 'SHOULDERS'
  | 'QUADRICEPS'
  | 'HAMSTRINGS'
  | 'GLUTEALS'
  | 'ADDUCTORS'
  | 'TRICEPS'
  | 'BICEPS'
  | 'FOREARMS'
  | 'CALVES'
  | 'CORE';

export type MuscleDivision =
  // CHEST
  | 'CHEST_CLAVICULAR'     // Upper Pec (30-45 deg incline)
  | 'CHEST_STERNAL'        // Mid/Lower Pec (Flat, Decline, Dips)
  // BACK
  | 'BACK_LATS'            // Latissimus Dorsi & Teres Major (Vertical Pull, tucked elbow rows)
  | 'BACK_UPPER'           // Rhomboids, Mid/Lower Trapezius (Scapular retraction, wide elbow rows)
  | 'BACK_ERECTORS'        // Erector Spinae (Spinal extension)
  // SHOULDERS
  | 'SHOULDER_ANTERIOR'    // Front Deltoid
  | 'SHOULDER_LATERAL'     // Side Deltoid
  | 'SHOULDER_POSTERIOR'   // Rear Deltoid
  // QUADRICEPS
  | 'QUAD_VASTI'           // Vastus Lateralis, Medialis, Intermedius (Squats, Presses)
  | 'QUAD_RECTUS_FEMORIS'  // Biarticular knee extensor/hip flexor (Seated Leg Ext, Sissy Squat)
  // HAMSTRINGS
  | 'HAMSTRING_BIARTICULAR'// Semitendinosus, Semimembranosus, Biceps Femoris Long Head (RDL/Hinge)
  | 'HAMSTRING_SHORT_HEAD' // Biceps Femoris Short Head (Leg Curls)
  // GLUTEALS
  | 'GLUTE_MAXIMUS'        // Hip extension
  | 'GLUTE_MEDIUS_MINIMUS' // Hip abduction & pelvic stabilization
  // ADDUCTORS
  | 'ADDUCTOR_MAGNUS'      // Adductor Magnus & Brevis (Deep squat hip extension)
  // ARMS
  | 'TRICEPS_MEDIAL_LATERAL'// Monoarticular elbow extension
  | 'TRICEPS_LONG_HEAD'    // Biarticular shoulder/elbow extension (Overhead / Incline stretch)
  | 'BICEPS_BRACHII'       // Long & short heads (Supinated flexion)
  | 'BRACHIALIS_FOREARMS'  // Brachialis & Brachioradialis (Hammer / Neutral grip)
  | 'FOREARM_FLEXORS'      // Grip & wrist flexion
  // LOWER LEG
  | 'CALF_GASTROCNEMIUS'   // Standing Calf Raise (Straight knee)
  | 'CALF_SOLEUS'          // Seated Calf Raise (Bent knee)
  // CORE
  | 'CORE_RECTUS_ABDOMINIS'// Spinal flexion
  | 'CORE_OBLIQUES'        // Rotational & anti-lateral flexion
  | 'CORE_TRANSVERSE';     // Deep abdominal wall & vacuum

export interface MuscleDivisionMetadata {
  id: MuscleDivision;
  primaryGroup: PrimaryMuscleGroup;
  displayNameTr: string;
  displayNameEn: string;
  defaultWeeklyLandmarks: {
    mv: number;   // Maintenance Volume (sets/week)
    mev: number;  // Minimum Effective Volume (sets/week)
    mavMin: number; // Maximum Adaptive Volume Lower (sets/week)
    mavMax: number; // Maximum Adaptive Volume Upper (sets/week)
    mrv: number;  // Maximum Recoverable Volume (sets/week)
  };
  sessionCeilingSets: number; // Default 8 (junk volume threshold)
  recommendedFrequencyPerWeek: { min: number; max: number };
  minInterSessionRecoveryHours: number;
}
```

### 6.2 Exercise-to-Muscle Fractional Attribution Matrix (`src/data/fractionalVolumeMatrix.ts`)

```typescript
/**
 * FitHash Exercise Compound-to-Muscle Fractional Contribution Matrix
 * File: src/data/fractionalVolumeMatrix.ts
 */

import { MuscleDivision } from '../types/muscleTaxonomy';

export interface FractionalContribution {
  division: MuscleDivision;
  coefficient: number; // Range 0.05 to 1.0
  isPrimeMover: boolean;
}

export interface ExerciseVolumeProfile {
  exerciseId: string;
  movementPattern: 
    | 'HORIZONTAL_PUSH'
    | 'INCLINE_PUSH'
    | 'VERTICAL_PUSH'
    | 'HORIZONTAL_ROW'
    | 'VERTICAL_PULL'
    | 'HIP_HINGE'
    | 'SQUAT_KNEE_DOMINANT'
    | 'LUNGE_SPLIT_SQUAT'
    | 'HIP_EXTENSION_THRUST'
    | 'ISOLATION';
  contributions: FractionalContribution[];
}

export const FRACTIONAL_VOLUME_MATRIX: Record<string, ExerciseVolumeProfile> = {
  // --- CHEST PRESSES ---
  'ex_barbell_bench': {
    exerciseId: 'ex_barbell_bench',
    movementPattern: 'HORIZONTAL_PUSH',
    contributions: [
      { division: 'CHEST_STERNAL', coefficient: 1.0, isPrimeMover: true },
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 0.5, isPrimeMover: false },
      { division: 'SHOULDER_ANTERIOR', coefficient: 0.5, isPrimeMover: false },
      { division: 'CHEST_CLAVICULAR', coefficient: 0.25, isPrimeMover: false },
    ],
  },
  'ex_bench_mch': {
    exerciseId: 'ex_bench_mch',
    movementPattern: 'HORIZONTAL_PUSH',
    contributions: [
      { division: 'CHEST_STERNAL', coefficient: 1.0, isPrimeMover: true },
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 0.5, isPrimeMover: false },
      { division: 'SHOULDER_ANTERIOR', coefficient: 0.5, isPrimeMover: false },
    ],
  },
  'ex_chest_2': { // Incline Dumbbell Press
    exerciseId: 'ex_chest_2',
    movementPattern: 'INCLINE_PUSH',
    contributions: [
      { division: 'CHEST_CLAVICULAR', coefficient: 1.0, isPrimeMover: true },
      { division: 'SHOULDER_ANTERIOR', coefficient: 0.5, isPrimeMover: false },
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 0.5, isPrimeMover: false },
      { division: 'CHEST_STERNAL', coefficient: 0.25, isPrimeMover: false },
    ],
  },
  'ex_incline_barbell_bench': {
    exerciseId: 'ex_incline_barbell_bench',
    movementPattern: 'INCLINE_PUSH',
    contributions: [
      { division: 'CHEST_CLAVICULAR', coefficient: 1.0, isPrimeMover: true },
      { division: 'SHOULDER_ANTERIOR', coefficient: 0.5, isPrimeMover: false },
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 0.5, isPrimeMover: false },
    ],
  },
  'ex_chest_dips': {
    exerciseId: 'ex_chest_dips',
    movementPattern: 'HORIZONTAL_PUSH',
    contributions: [
      { division: 'CHEST_STERNAL', coefficient: 1.0, isPrimeMover: true },
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 0.6, isPrimeMover: false },
      { division: 'SHOULDER_ANTERIOR', coefficient: 0.4, isPrimeMover: false },
    ],
  },

  // --- VERTICAL PRESSES ---
  'ex_shoulders_1': { // OHP Barbell
    exerciseId: 'ex_shoulders_1',
    movementPattern: 'VERTICAL_PUSH',
    contributions: [
      { division: 'SHOULDER_ANTERIOR', coefficient: 1.0, isPrimeMover: true },
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 0.5, isPrimeMover: false },
      { division: 'SHOULDER_LATERAL', coefficient: 0.25, isPrimeMover: false },
      { division: 'BACK_UPPER', coefficient: 0.2, isPrimeMover: false },
    ],
  },
  'ex_ohp_mch': {
    exerciseId: 'ex_ohp_mch',
    movementPattern: 'VERTICAL_PUSH',
    contributions: [
      { division: 'SHOULDER_ANTERIOR', coefficient: 1.0, isPrimeMover: true },
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 0.5, isPrimeMover: false },
      { division: 'SHOULDER_LATERAL', coefficient: 0.25, isPrimeMover: false },
    ],
  },

  // --- BACK & PULLING ---
  'ex_lat_pulldown': {
    exerciseId: 'ex_lat_pulldown',
    movementPattern: 'VERTICAL_PULL',
    contributions: [
      { division: 'BACK_LATS', coefficient: 1.0, isPrimeMover: true },
      { division: 'BICEPS_BRACHII', coefficient: 0.5, isPrimeMover: false },
      { division: 'BRACHIALIS_FOREARMS', coefficient: 0.5, isPrimeMover: false },
      { division: 'BACK_UPPER', coefficient: 0.25, isPrimeMover: false },
      { division: 'SHOULDER_POSTERIOR', coefficient: 0.25, isPrimeMover: false },
    ],
  },
  'ex_chinup': {
    exerciseId: 'ex_chinup',
    movementPattern: 'VERTICAL_PULL',
    contributions: [
      { division: 'BACK_LATS', coefficient: 1.0, isPrimeMover: true },
      { division: 'BICEPS_BRACHII', coefficient: 0.75, isPrimeMover: false },
      { division: 'BRACHIALIS_FOREARMS', coefficient: 0.5, isPrimeMover: false },
      { division: 'CORE_RECTUS_ABDOMINIS', coefficient: 0.25, isPrimeMover: false },
    ],
  },
  'ex_tbar_row_cs': { // Chest Supported T-Bar Row (Wide)
    exerciseId: 'ex_tbar_row_cs',
    movementPattern: 'HORIZONTAL_ROW',
    contributions: [
      { division: 'BACK_UPPER', coefficient: 1.0, isPrimeMover: true },
      { division: 'SHOULDER_POSTERIOR', coefficient: 0.5, isPrimeMover: false },
      { division: 'BRACHIALIS_FOREARMS', coefficient: 0.5, isPrimeMover: false },
      { division: 'BICEPS_BRACHII', coefficient: 0.25, isPrimeMover: false },
      { division: 'BACK_LATS', coefficient: 0.25, isPrimeMover: false },
    ],
  },
  'ex_bent_over_row': {
    exerciseId: 'ex_bent_over_row',
    movementPattern: 'HORIZONTAL_ROW',
    contributions: [
      { division: 'BACK_UPPER', coefficient: 0.75, isPrimeMover: true },
      { division: 'BACK_LATS', coefficient: 0.75, isPrimeMover: true },
      { division: 'BACK_ERECTORS', coefficient: 0.5, isPrimeMover: false },
      { division: 'HAMSTRING_BIARTICULAR', coefficient: 0.25, isPrimeMover: false },
      { division: 'BICEPS_BRACHII', coefficient: 0.5, isPrimeMover: false },
      { division: 'SHOULDER_POSTERIOR', coefficient: 0.3, isPrimeMover: false },
    ],
  },
  'ex_seated_cable_row': {
    exerciseId: 'ex_seated_cable_row',
    movementPattern: 'HORIZONTAL_ROW',
    contributions: [
      { division: 'BACK_LATS', coefficient: 0.75, isPrimeMover: true },
      { division: 'BACK_UPPER', coefficient: 0.75, isPrimeMover: true },
      { division: 'BICEPS_BRACHII', coefficient: 0.4, isPrimeMover: false },
      { division: 'BRACHIALIS_FOREARMS', coefficient: 0.4, isPrimeMover: false },
    ],
  },

  // --- LOWER BODY SQUATS & PRESSES ---
  'ex_legs_1': { // Barbell Back Squat
    exerciseId: 'ex_legs_1',
    movementPattern: 'SQUAT_KNEE_DOMINANT',
    contributions: [
      { division: 'QUAD_VASTI', coefficient: 1.0, isPrimeMover: true },
      { division: 'GLUTE_MAXIMUS', coefficient: 0.75, isPrimeMover: true },
      { division: 'ADDUCTOR_MAGNUS', coefficient: 0.5, isPrimeMover: false },
      { division: 'BACK_ERECTORS', coefficient: 0.5, isPrimeMover: false },
      { division: 'CALF_SOLEUS', coefficient: 0.15, isPrimeMover: false },
      { division: 'QUAD_RECTUS_FEMORIS', coefficient: 0.0, isPrimeMover: false }, // Biarticularly Insufficient!
    ],
  },
  'ex_leg_press': {
    exerciseId: 'ex_leg_press',
    movementPattern: 'SQUAT_KNEE_DOMINANT',
    contributions: [
      { division: 'QUAD_VASTI', coefficient: 1.0, isPrimeMover: true },
      { division: 'GLUTE_MAXIMUS', coefficient: 0.5, isPrimeMover: false },
      { division: 'ADDUCTOR_MAGNUS', coefficient: 0.3, isPrimeMover: false },
    ],
  },
  'ex_hack_squat': {
    exerciseId: 'ex_hack_squat',
    movementPattern: 'SQUAT_KNEE_DOMINANT',
    contributions: [
      { division: 'QUAD_VASTI', coefficient: 1.0, isPrimeMover: true },
      { division: 'GLUTE_MAXIMUS', coefficient: 0.4, isPrimeMover: false },
      { division: 'ADDUCTOR_MAGNUS', coefficient: 0.25, isPrimeMover: false },
    ],
  },
  'ex_bulgarian_split_squat': {
    exerciseId: 'ex_bulgarian_split_squat',
    movementPattern: 'LUNGE_SPLIT_SQUAT',
    contributions: [
      { division: 'QUAD_VASTI', coefficient: 0.8, isPrimeMover: true },
      { division: 'GLUTE_MAXIMUS', coefficient: 0.8, isPrimeMover: true },
      { division: 'ADDUCTOR_MAGNUS', coefficient: 0.5, isPrimeMover: false },
      { division: 'GLUTE_MEDIUS_MINIMUS', coefficient: 0.3, isPrimeMover: false },
    ],
  },

  // --- HIP HINGE & POSTERIOR CHAIN ---
  'ex_back_1': { // Barbell Deadlift
    exerciseId: 'ex_back_1',
    movementPattern: 'HIP_HINGE',
    contributions: [
      { division: 'BACK_ERECTORS', coefficient: 1.0, isPrimeMover: true },
      { division: 'GLUTE_MAXIMUS', coefficient: 0.8, isPrimeMover: true },
      { division: 'HAMSTRING_BIARTICULAR', coefficient: 0.5, isPrimeMover: false },
      { division: 'ADDUCTOR_MAGNUS', coefficient: 0.5, isPrimeMover: false },
      { division: 'FOREARM_FLEXORS', coefficient: 0.6, isPrimeMover: false },
      { division: 'BACK_UPPER', coefficient: 0.5, isPrimeMover: false },
      { division: 'QUAD_VASTI', coefficient: 0.3, isPrimeMover: false },
    ],
  },
  'ex_romanian_deadlift': {
    exerciseId: 'ex_romanian_deadlift',
    movementPattern: 'HIP_HINGE',
    contributions: [
      { division: 'HAMSTRING_BIARTICULAR', coefficient: 1.0, isPrimeMover: true },
      { division: 'GLUTE_MAXIMUS', coefficient: 0.8, isPrimeMover: true },
      { division: 'BACK_ERECTORS', coefficient: 0.5, isPrimeMover: false },
      { division: 'ADDUCTOR_MAGNUS', coefficient: 0.5, isPrimeMover: false },
      { division: 'FOREARM_FLEXORS', coefficient: 0.3, isPrimeMover: false },
    ],
  },
  'ex_hip_thrust': {
    exerciseId: 'ex_hip_thrust',
    movementPattern: 'HIP_EXTENSION_THRUST',
    contributions: [
      { division: 'GLUTE_MAXIMUS', coefficient: 1.0, isPrimeMover: true },
      { division: 'HAMSTRING_BIARTICULAR', coefficient: 0.25, isPrimeMover: false },
      { division: 'ADDUCTOR_MAGNUS', coefficient: 0.25, isPrimeMover: false },
    ],
  },

  // --- ISOLATIONS (STRICT 1.0 TO SPECIFIC TARGET) ---
  'ex_leg_extension': {
    exerciseId: 'ex_leg_extension',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'QUAD_RECTUS_FEMORIS', coefficient: 1.0, isPrimeMover: true },
      { division: 'QUAD_VASTI', coefficient: 1.0, isPrimeMover: true },
    ],
  },
  'custom_ex_1786959435976': { // Seated Leg Curl
    exerciseId: 'custom_ex_1786959435976',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'HAMSTRING_BIARTICULAR', coefficient: 1.0, isPrimeMover: true },
      { division: 'HAMSTRING_SHORT_HEAD', coefficient: 1.0, isPrimeMover: true },
    ],
  },
  'ex_lat_raise_drop': { // Lateral Raise
    exerciseId: 'ex_lat_raise_drop',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'SHOULDER_LATERAL', coefficient: 1.0, isPrimeMover: true },
    ],
  },
  'ex_cable_lateral_raise': {
    exerciseId: 'ex_cable_lateral_raise',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'SHOULDER_LATERAL', coefficient: 1.0, isPrimeMover: true },
    ],
  },
  'ex_reverse_fly': {
    exerciseId: 'ex_reverse_fly',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'SHOULDER_POSTERIOR', coefficient: 1.0, isPrimeMover: true },
      { division: 'BACK_UPPER', coefficient: 0.35, isPrimeMover: false },
    ],
  },
  'ex_rope_pushdown': {
    exerciseId: 'ex_rope_pushdown',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 1.0, isPrimeMover: true },
    ],
  },
  'ex_cable_overhead_triceps_ext': {
    exerciseId: 'ex_cable_overhead_triceps_ext',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'TRICEPS_LONG_HEAD', coefficient: 1.0, isPrimeMover: true },
      { division: 'TRICEPS_MEDIAL_LATERAL', coefficient: 0.5, isPrimeMover: false },
    ],
  },
  'ex_biceps_curl': {
    exerciseId: 'ex_biceps_curl',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'BICEPS_BRACHII', coefficient: 1.0, isPrimeMover: true },
      { division: 'BRACHIALIS_FOREARMS', coefficient: 0.3, isPrimeMover: false },
    ],
  },
  'ex_hammer_curl': {
    exerciseId: 'ex_hammer_curl',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'BRACHIALIS_FOREARMS', coefficient: 1.0, isPrimeMover: true },
      { division: 'BICEPS_BRACHII', coefficient: 0.4, isPrimeMover: false },
    ],
  },
  'ex_standing_calf_raise': {
    exerciseId: 'ex_standing_calf_raise',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'CALF_GASTROCNEMIUS', coefficient: 1.0, isPrimeMover: true },
      { division: 'CALF_SOLEUS', coefficient: 0.5, isPrimeMover: false },
    ],
  },
  'ex_seated_calf_raise': {
    exerciseId: 'ex_seated_calf_raise',
    movementPattern: 'ISOLATION',
    contributions: [
      { division: 'CALF_SOLEUS', coefficient: 1.0, isPrimeMover: true },
    ],
  },
};
```

### 6.3 Volume Landmarks & Dynamic Landmark Scaler (`src/services/volumeLandmarkService.ts`)

```typescript
/**
 * FitHash Volume Landmark & Autoregulation Engine
 * File: src/services/volumeLandmarkService.ts
 */

import { MuscleDivision, PrimaryMuscleGroup } from '../types/muscleTaxonomy';
import { FRACTIONAL_VOLUME_MATRIX } from '../data/fractionalVolumeMatrix';
import { WorkoutSession } from '../types/fitness';

export interface VolumeStatusReport {
  division: MuscleDivision;
  primaryGroup: PrimaryMuscleGroup;
  effectiveWeeklySets: number;
  landmarkTier: 'BELOW_MV' | 'MAINTENANCE' | 'OPTIMAL_ADAPTIVE' | 'NEAR_MRV' | 'OVERTRAINING_RISK';
  sessionOverloadWarning: boolean; // Triggers if any session > 8 sets
  maxSetsInSingleSession: number;
}

export class VolumeLandmarkEngine {
  /**
   * Calculates effective stimulus multiplier based on RIR
   */
  private static calculateRirFactor(rir?: number): number {
    if (rir === undefined || rir === null) return 1.0;
    if (rir <= 2) return 1.0;
    if (rir === 3) return 0.75;
    if (rir === 4) return 0.50;
    return 0.0; // Warmups or >4 RIR have negligible hypertrophy stimulus
  }

  /**
   * Aggregates completed sets in a 7-day rolling window into fractional volume per division
   */
  public static calculateWeeklyVolume(
    recentSessions: WorkoutSession[],
    cutoffTimestampMs: number
  ): Map<MuscleDivision, { effectiveSets: number; maxSessionSets: number }> {
    const volumeMap = new Map<MuscleDivision, { effectiveSets: number; maxSessionSets: number }>();

    for (const session of recentSessions) {
      if (session.startTime < cutoffTimestampMs || !session.completed) continue;

      const sessionDivisionSets = new Map<MuscleDivision, number>();

      for (const exercise of session.exercises) {
        const profile = FRACTIONAL_VOLUME_MATRIX[exercise.exerciseId];
        if (!profile) continue;

        for (const set of exercise.sets) {
          if (!set.completed || set.isWarmup) continue;

          const rirFactor = this.calculateRirFactor(set.rir);
          if (rirFactor === 0) continue;

          for (const contrib of profile.contributions) {
            const addedVolume = contrib.coefficient * rirFactor;
            const currentSessionSets = sessionDivisionSets.get(contrib.division) || 0;
            sessionDivisionSets.set(contrib.division, currentSessionSets + addedVolume);
          }
        }
      }

      // Merge session sets into weekly map and record session maximums
      sessionDivisionSets.forEach((sets, division) => {
        const existing = volumeMap.get(division) || { effectiveSets: 0, maxSessionSets: 0 };
        volumeMap.set(division, {
          effectiveSets: Number((existing.effectiveSets + sets).toFixed(2)),
          maxSessionSets: Math.max(existing.maxSessionSets, Number(sets.toFixed(2))),
        });
      });
    }

    return volumeMap;
  }
}
```

---

## 7. Split Recommendation Engine Specification

### 7.1 Recommendation Algorithm Rules
The recommendation engine inspects:
1. `weeklyTrainingDaysTarget` $\in \{3, 4, 5, 6\}$.
2. `primaryGoal`: `'HYPERTROPHY'` | `'STRENGTH'` | `'RECOMPOSITION'`.
3. `preferredSessionDurationMinutes`: $45 - 90\text{ min}$.
4. `fatigueProfile` (Axial tolerance score).

#### Decision Matrix:
- **3 Days:** Returns **Full Body A / B / C** (Ensures $3\times/\text{week}$ frequency; prevents bro-split once-per-week undertraining).
- **4 Days:** Returns **Upper / Lower Split (Upper 1, Lower 1, Upper 2, Lower 2)**. Optimal recovery with 72h spacing between identical muscle workouts.
- **5 Days:** Returns **Hybrid PPL-Upper-Lower** (Push, Pull, Legs, Upper, Lower). Prevents the unresolvable 5-day asymmetry of standard PPL.
- **6 Days:** Returns **PPL-RPPL or PPL-PPL** (Push A, Pull A, Legs A, Push B, Pull B, Legs B, Rest).

### 7.2 Complete Concrete Routine Templates (TypeScript Implementation)

```typescript
/**
 * FitHash Evidence-Based Split Templates & Recommendation Engine
 * File: src/services/splitRecommendationEngine.ts
 */

import { Routine } from '../types/fitness';

export interface SplitArchitecture {
  id: string;
  name: string;
  weeklyDays: 3 | 4 | 5 | 6;
  description: string;
  scientificRationale: string;
  routines: Routine[];
}

export const EVIDENCE_BASED_SPLITS: Record<string, SplitArchitecture> = {
  // ==========================================
  // 3-DAY SPLIT: FULL BODY HIGH-FREQUENCY (A/B/C)
  // ==========================================
  'split_3day_fullbody': {
    id: 'split_3day_fullbody',
    name: '3-Day Full Body Frequency (A/B/C)',
    weeklyDays: 3,
    description: 'High frequency full body split hitting every muscle group 3x/week with 3-5 sets per session.',
    scientificRationale: 'Optimizes muscle protein synthesis across 7 days without exceeding the 6-set single session ceiling.',
    routines: [
      {
        id: 'routine_fullbody_a',
        name: 'Full Body A (Knee Dominant & Chest Focus)',
        description: 'Squat, Flat Press, Lat Pulldown, Hamstring Curl, Triceps',
        category: 'Tüm Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_hack_squat', exerciseName: 'Hack Squat Machine', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 8, targetRir: 1 },
          { exerciseId: 'ex_bench_mch', exerciseName: 'Bench Press MCH', category: 'Göğüs', equipment: 'Makine', targetSets: 3, targetReps: 8, targetRir: 1 },
          { exerciseId: 'ex_lat_pulldown', exerciseName: 'Lat Pulldown', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'custom_ex_1786959435976', exerciseName: 'Seated Leg Curl', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 1 },
          { exerciseId: 'ex_rope_pushdown', exerciseName: 'Rope Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetRir: 0 },
        ],
      },
      {
        id: 'routine_fullbody_b',
        name: 'Full Body B (Hinge & Upper Back Focus)',
        description: 'Romanian Deadlift, Incline Press, Chest Supported Row, Lateral Raise, Biceps',
        category: 'Tüm Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_romanian_deadlift', exerciseName: 'Romanian Deadlift (RDL)', category: 'Sırt', equipment: 'Barbell', targetSets: 3, targetReps: 8, targetRir: 2 },
          { exerciseId: 'ex_chest_2', exerciseName: 'Incline Dumbbell Press', category: 'Göğüs', equipment: 'Dumbbell', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_tbar_row_cs', exerciseName: 'T-Bar Row (Chest Supported)', category: 'Sırt', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_leg_extension', exerciseName: 'Leg Extension', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_lat_raise_drop', exerciseName: 'Lateral Raise (Dropset)', category: 'Omuz', equipment: 'Dumbbell', targetSets: 4, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_biceps_curl', exerciseName: 'Biceps Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 3, targetReps: 12, targetRir: 1 },
        ],
      },
      {
        id: 'routine_fullbody_c',
        name: 'Full Body C (Leg Press & Vertical Upper)',
        description: 'Leg Press, Dips, Cable Row, Overhead Triceps, Calves',
        category: 'Tüm Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_leg_press', exerciseName: 'Leg Press', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_chest_dips', exerciseName: 'Chest Dips', category: 'Göğüs', equipment: 'Vücut Ağırlığı', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_seated_cable_row', exerciseName: 'Seated Cable Row', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_cable_overhead_triceps_ext', exerciseName: 'Cable Overhead Triceps Extension', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetRir: 1 },
          { exerciseId: 'ex_standing_calf_raise', exerciseName: 'Standing Calf Raise', category: 'Bacak', equipment: 'Makine', targetSets: 4, targetReps: 15, targetRir: 0 },
        ],
      },
    ],
  },

  // ==========================================
  // 4-DAY SPLIT: UPPER / LOWER OPTIMAL HYPERTROPHY
  // ==========================================
  'split_4day_upper_lower': {
    id: 'split_4day_upper_lower',
    name: '4-Day Upper / Lower Periodized',
    weeklyDays: 4,
    description: 'Gold-standard 4-day split with complete separation of axial lower loading and upper pressing/pulling.',
    scientificRationale: 'Guarantees 2x/week frequency with 48-72h recovery between identical muscle recruitment patterns.',
    routines: [
      {
        id: 'routine_ul_upper_1',
        name: 'Upper 1 (Chest & Lat Dominant)',
        description: 'Flat Press, Lat Pulldown, Incline Fly, Cable Row, Side Delts, Triceps',
        category: 'Üst Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_barbell_bench', exerciseName: 'Barbell Bench Press', category: 'Göğüs', equipment: 'Barbell', targetSets: 3, targetReps: 8, targetRir: 1 },
          { exerciseId: 'ex_lat_pulldown', exerciseName: 'Lat Pulldown', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 9, targetRir: 1 },
          { exerciseId: 'ex_chest_2', exerciseName: 'Incline Dumbbell Press', category: 'Göğüs', equipment: 'Dumbbell', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_tbar_row_cs', exerciseName: 'T-Bar Row (Chest Supported)', category: 'Sırt', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_lat_raise_drop', exerciseName: 'Lateral Raise (Dropset)', category: 'Omuz', equipment: 'Dumbbell', targetSets: 4, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_rope_pushdown', exerciseName: 'Rope Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetRir: 1 },
        ],
      },
      {
        id: 'routine_ul_lower_1',
        name: 'Lower 1 (Quad & Calves Dominant)',
        description: 'Back Squat, Leg Press, Seated Leg Curl, Leg Extension, Calves',
        category: 'Alt Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_legs_1', exerciseName: 'Barbell Back Squat', category: 'Bacak', equipment: 'Barbell', targetSets: 3, targetReps: 6, targetRir: 2 },
          { exerciseId: 'ex_leg_press', exerciseName: 'Leg Press', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'custom_ex_1786959435976', exerciseName: 'Seated Leg Curl', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 1 },
          { exerciseId: 'ex_leg_extension', exerciseName: 'Leg Extension', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_standing_calf_raise', exerciseName: 'Standing Calf Raise', category: 'Bacak', equipment: 'Makine', targetSets: 4, targetReps: 12, targetRir: 0 },
        ],
      },
      {
        id: 'routine_ul_upper_2',
        name: 'Upper 2 (Upper Back, Shoulder & Incline Focus)',
        description: 'OHP, Wide Row, Incline Press MCH, Reverse Fly, Biceps, Long Head Triceps',
        category: 'Üst Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_ohp_mch', exerciseName: 'Overhead Press MCH', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 8, targetRir: 1 },
          { exerciseId: 'ex_incline_press_mch', exerciseName: 'Incline Press MCH', category: 'Göğüs', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_tbar_row_cs', exerciseName: 'T-Bar Row (Chest Supported)', category: 'Sırt', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_reverse_fly', exerciseName: 'Reverse Fly', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_cable_overhead_triceps_ext', exerciseName: 'Cable Overhead Triceps Extension', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetRir: 1 },
          { exerciseId: 'ex_hammer_curl', exerciseName: 'Hammer Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 3, targetReps: 12, targetRir: 1 },
        ],
      },
      {
        id: 'routine_ul_lower_2',
        name: 'Lower 2 (Hamstring & Glute Dominant)',
        description: 'Romanian Deadlift, Bulgarian Split Squat, Leg Curl, Hip Thrust, Seated Calf',
        category: 'Alt Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_romanian_deadlift', exerciseName: 'Romanian Deadlift (RDL)', category: 'Sırt', equipment: 'Barbell', targetSets: 3, targetReps: 8, targetRir: 2 },
          { exerciseId: 'ex_bulgarian_split_squat', exerciseName: 'Bulgarian Split Squat', category: 'Bacak', equipment: 'Dumbbell', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_hip_thrust', exerciseName: 'Barbell Hip Thrust', category: 'Bacak', equipment: 'Barbell', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'custom_ex_1786959435976', exerciseName: 'Seated Leg Curl', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_seated_calf_raise', exerciseName: 'Seated Calf Raise', category: 'Bacak', equipment: 'Makine', targetSets: 4, targetReps: 15, targetRir: 0 },
        ],
      },
    ],
  },

  // ==========================================
  // 5-DAY SPLIT: PUSH / PULL / LEGS / UPPER / LOWER (PPL-UL)
  // ==========================================
  'split_5day_pplul': {
    id: 'split_5day_pplul',
    name: '5-Day PPL-Upper-Lower Hybrid',
    weeklyDays: 5,
    description: 'High volume modern split solving the 5-day asymmetry with PPL followed by Upper/Lower.',
    scientificRationale: 'Distributes 14-18 weekly sets per muscle group across exactly 2 sessions, avoiding single-session junk volume (>8 sets).',
    routines: [
      {
        id: 'routine_pplul_push',
        name: 'Day 1: Push (Chest & Shoulders Heavy)',
        description: 'Bench, OHP, Incline Press, Lateral Raise, Triceps Pushdown',
        category: 'İtiş (Push)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_barbell_bench', exerciseName: 'Barbell Bench Press', category: 'Göğüs', equipment: 'Barbell', targetSets: 3, targetReps: 8, targetRir: 1 },
          { exerciseId: 'ex_ohp_mch', exerciseName: 'Overhead Press MCH', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 8, targetRir: 1 },
          { exerciseId: 'ex_chest_2', exerciseName: 'Incline Dumbbell Press', category: 'Göğüs', equipment: 'Dumbbell', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_lat_raise_drop', exerciseName: 'Lateral Raise (Dropset)', category: 'Omuz', equipment: 'Dumbbell', targetSets: 4, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_rope_pushdown', exerciseName: 'Rope Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetRir: 0 },
        ],
      },
      {
        id: 'routine_pplul_pull',
        name: 'Day 2: Pull (Lats & Upper Back Heavy)',
        description: 'T-Bar Row, Lat Pulldown, Reverse Fly, Hammer Curl, Face Pull',
        category: 'Çekiş (Pull)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_tbar_row_cs', exerciseName: 'T-Bar Row (Chest Supported)', category: 'Sırt', equipment: 'Makine', targetSets: 3, targetReps: 8, targetRir: 1 },
          { exerciseId: 'ex_lat_pulldown', exerciseName: 'Lat Pulldown', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_reverse_fly', exerciseName: 'Reverse Fly', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_hammer_curl', exerciseName: 'Hammer Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_face_pull', exerciseName: 'Face Pull', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 15, targetRir: 0 },
        ],
      },
      {
        id: 'routine_pplul_legs',
        name: 'Day 3: Legs (Squat & Hamstrings)',
        description: 'Squat, Seated Leg Curl, Leg Press, Calf Raise',
        category: 'Bacak (Legs)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_legs_1', exerciseName: 'Barbell Back Squat', category: 'Bacak', equipment: 'Barbell', targetSets: 3, targetReps: 6, targetRir: 2 },
          { exerciseId: 'custom_ex_1786959435976', exerciseName: 'Seated Leg Curl', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_leg_press', exerciseName: 'Leg Press', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_standing_calf_raise', exerciseName: 'Standing Calf Raise', category: 'Bacak', equipment: 'Makine', targetSets: 4, targetReps: 12, targetRir: 0 },
        ],
      },
      {
        id: 'routine_pplul_upper',
        name: 'Day 4: Upper (Machine & Cable Hypertrophy)',
        description: 'Incline Press MCH, Cable Row, Cable Lateral, Machine Curl, Overhead Triceps',
        category: 'Üst Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_incline_press_mch', exerciseName: 'Incline Press MCH', category: 'Göğüs', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_seated_cable_row', exerciseName: 'Seated Cable Row', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_cable_lateral_raise', exerciseName: 'Cable Lateral Raise', category: 'Omuz', equipment: 'Kablo', targetSets: 4, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_cable_overhead_triceps_ext', exerciseName: 'Cable Overhead Triceps Extension', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_biceps_curl', exerciseName: 'Biceps Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 3, targetReps: 12, targetRir: 1 },
        ],
      },
      {
        id: 'routine_pplul_lower',
        name: 'Day 5: Lower (RDL & Isolation)',
        description: 'Romanian Deadlift, Hack Squat, Leg Extension, Seated Calf',
        category: 'Alt Vücut',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_romanian_deadlift', exerciseName: 'Romanian Deadlift (RDL)', category: 'Sırt', equipment: 'Barbell', targetSets: 3, targetReps: 8, targetRir: 2 },
          { exerciseId: 'ex_hack_squat', exerciseName: 'Hack Squat Machine', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_leg_extension', exerciseName: 'Leg Extension', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_seated_calf_raise', exerciseName: 'Seated Calf Raise', category: 'Bacak', equipment: 'Makine', targetSets: 4, targetReps: 15, targetRir: 0 },
        ],
      },
    ],
  },

  // ==========================================
  // 6-DAY SPLIT: PUSH / PULL / LEGS (PPLRPPL)
  // ==========================================
  'split_6day_ppl': {
    id: 'split_6day_ppl',
    name: '6-Day PPL High Volume Micro-Dose',
    weeklyDays: 6,
    description: 'High frequency PPL with targeted variation between A and B sessions.',
    scientificRationale: 'Permits 16-22 sets/week per muscle while keeping daily session volume strictly within 4-6 sets, preventing per-session neuromuscular degradation.',
    routines: [
      {
        id: 'routine_6day_push_a',
        name: 'Push A (Flat Chest & Lateral Focus)',
        description: 'Barbell Bench, Machine OHP, Lateral Raise, Triceps Pushdown',
        category: 'İtiş (Push)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_barbell_bench', exerciseName: 'Barbell Bench Press', category: 'Göğüs', equipment: 'Barbell', targetSets: 3, targetReps: 8, targetRir: 1 },
          { exerciseId: 'ex_ohp_mch', exerciseName: 'Overhead Press MCH', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_lat_raise_drop', exerciseName: 'Lateral Raise (Dropset)', category: 'Omuz', equipment: 'Dumbbell', targetSets: 4, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_rope_pushdown', exerciseName: 'Rope Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetRir: 0 },
        ],
      },
      {
        id: 'routine_6day_pull_a',
        name: 'Pull A (Lats & Brachialis Focus)',
        description: 'Lat Pulldown, Chest-Supported Row, Hammer Curl, Face Pull',
        category: 'Çekiş (Pull)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_lat_pulldown', exerciseName: 'Lat Pulldown', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 9, targetRir: 1 },
          { exerciseId: 'ex_tbar_row_cs', exerciseName: 'T-Bar Row (Chest Supported)', category: 'Sırt', equipment: 'Makine', targetSets: 3, targetReps: 9, targetRir: 1 },
          { exerciseId: 'ex_hammer_curl', exerciseName: 'Hammer Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 3, targetReps: 11, targetRir: 1 },
          { exerciseId: 'ex_face_pull', exerciseName: 'Face Pull', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 15, targetRir: 0 },
        ],
      },
      {
        id: 'routine_6day_legs_a',
        name: 'Legs A (Quad Dominant)',
        description: 'Back Squat, Leg Press, Seated Leg Curl, Standing Calf',
        category: 'Bacak (Legs)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_legs_1', exerciseName: 'Barbell Back Squat', category: 'Bacak', equipment: 'Barbell', targetSets: 3, targetReps: 6, targetRir: 2 },
          { exerciseId: 'ex_leg_press', exerciseName: 'Leg Press', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'custom_ex_1786959435976', exerciseName: 'Seated Leg Curl', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 1 },
          { exerciseId: 'ex_standing_calf_raise', exerciseName: 'Standing Calf Raise', category: 'Bacak', equipment: 'Makine', targetSets: 4, targetReps: 12, targetRir: 0 },
        ],
      },
      {
        id: 'routine_6day_push_b',
        name: 'Push B (Incline & Long Head Focus)',
        description: 'Incline DB Press, Dips, Cable Lateral, Overhead Triceps Extension',
        category: 'İtiş (Push)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_chest_2', exerciseName: 'Incline Dumbbell Press', category: 'Göğüs', equipment: 'Dumbbell', targetSets: 3, targetReps: 9, targetRir: 1 },
          { exerciseId: 'ex_chest_dips', exerciseName: 'Chest Dips', category: 'Göğüs', equipment: 'Vücut Ağırlığı', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_cable_lateral_raise', exerciseName: 'Cable Lateral Raise', category: 'Omuz', equipment: 'Kablo', targetSets: 4, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_cable_overhead_triceps_ext', exerciseName: 'Cable Overhead Triceps Extension', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetRir: 0 },
        ],
      },
      {
        id: 'routine_6day_pull_b',
        name: 'Pull B (Upper Back & Biceps Focus)',
        description: 'T-Bar Row, Seated Cable Row, Reverse Fly, Biceps Curl',
        category: 'Çekiş (Pull)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_tbar_row_cs', exerciseName: 'T-Bar Row (Chest Supported)', category: 'Sırt', equipment: 'Makine', targetSets: 3, targetReps: 9, targetRir: 1 },
          { exerciseId: 'ex_seated_cable_row', exerciseName: 'Seated Cable Row', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_reverse_fly', exerciseName: 'Reverse Fly', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_biceps_curl', exerciseName: 'Biceps Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 3, targetReps: 11, targetRir: 1 },
        ],
      },
      {
        id: 'routine_6day_legs_b',
        name: 'Legs B (Hamstring & Glute Focus)',
        description: 'Romanian Deadlift, Hack Squat, Leg Extension, Seated Calf',
        category: 'Bacak (Legs)',
        createdAt: '2026-10-22T00:00:00.000Z',
        exercises: [
          { exerciseId: 'ex_romanian_deadlift', exerciseName: 'Romanian Deadlift (RDL)', category: 'Sırt', equipment: 'Barbell', targetSets: 3, targetReps: 8, targetRir: 2 },
          { exerciseId: 'ex_hack_squat', exerciseName: 'Hack Squat Machine', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 10, targetRir: 1 },
          { exerciseId: 'ex_leg_extension', exerciseName: 'Leg Extension', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetRir: 0 },
          { exerciseId: 'ex_seated_calf_raise', exerciseName: 'Seated Calf Raise', category: 'Bacak', equipment: 'Makine', targetSets: 4, targetReps: 15, targetRir: 0 },
        ],
      },
    ],
  },
};
```

---

## 8. Integration Architecture with FitHash Wear OS & Analytics

```
┌────────────────────────────────────────────────────────┐
│             Wear OS Sensor / Workout Log               │
│  - Set Completed (Weight, Reps, RIR)                   │
│  - Accelerometer Cadence / Velocity Loss Proxy         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             Progression & Biomechanics Engine          │
│  - Stretch-Bias Multiplier (S_i: 1.0 - 1.3)            │
│  - Axial Fatigue Accumulator (A_i: 0 - 3)              │
│  - RIR Autoregulation Verification                     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         Fractional Volume Attribution Engine           │
│  - Matrix Lookup: ExerciseID -> FractionalContribution │
│  - Mathematical Aggregation across 28 Divisions        │
│  - 7-Day Rolling Window Volume Landmark Check          │
└───────────────────────────┬────────────────────────────┘
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   Analytics Tab UI       │  │  Split Recommendation    │
│  - MEV / MAV / MRV Gauges│  │  Engine                  │
│  - Lagging Muscle Alerts │  │  - User Schedule Match   │
│  - Junk Volume Warnings  │  │  - Dynamic Program Switch│
└──────────────────────────┘  └──────────────────────────┘
```

1. **Storage Compatibility:** Fractional volume values are stored in `@fithash_weekly_muscle_volume_v1` using standard AsyncStorage JSON key-value format.
2. **Offline-First:** All matrices, landmark calculations, and recommendation logic run purely on-device with zero external API requirements.
3. **Wear OS Synchronization:** Set completion with RIR syncs via DataLayer API to the handheld engine, triggering immediate recalculation of real-time session volume ceilings.

---

## 9. Verification & Implementation Checklist for Coding Agent

- [ ] **Type Definitions:** Copy `MuscleDivision` and `PrimaryMuscleGroup` to `src/types/fitness.ts` or `src/types/muscleTaxonomy.ts`.
- [ ] **Matrix Export:** Implement `src/data/fractionalVolumeMatrix.ts` mapping all `INITIAL_EXERCISES` to their respective fractional weights.
- [ ] **Volume Service:** Create `src/services/volumeLandmarkService.ts` exposing `calculateWeeklyVolume` and session ceiling checks ($>8$ sets).
- [ ] **Split Engine:** Create `src/services/splitRecommendationEngine.ts` exporting `EVIDENCE_BASED_SPLITS` and user recommendation selectors.
- [ ] **UI Presentation:** Integrate into `src/screens/AnalyticsTab.tsx` to visualize fractional volume bars alongside MEV/MAV/MRV reference lines.
