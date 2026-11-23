import { WorkoutSession } from '../types/fitness';
import { calculateAutoregulatedE1RM } from './e1rm';
import { isIsometricExerciseName, parseLocalDateString } from './exerciseHelpers';

export type SBDGroup = 'squat' | 'bench' | 'deadlift';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'vertical_push'
  | 'vertical_pull'
  | 'horizontal_pull';

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: 'Bacak İtiş',
  hinge: 'Arka Zincir',
  horizontal_push: 'Yatay İtiş',
  vertical_push: 'Dikey İtiş',
  vertical_pull: 'Dikey Çekiş',
  horizontal_pull: 'Yatay Çekiş',
};

export const SBD_GROUP_LABELS: Record<SBDGroup, string> = {
  squat: 'SQUAT',
  bench: 'BENCH',
  deadlift: 'DEADLIFT',
};

export interface SBDVariationItem {
  exerciseName: string;
  category?: string;
  equipment?: string;
  group: SBDGroup;
  max1RM: number;
  weight: number;
  reps: number;
  date: string;
  isRecent: boolean;
}

export interface SBDGroupSummary {
  group: SBDGroup;
  label: string;
  primary: SBDVariationItem | null;
  variations: SBDVariationItem[];
}

export interface RecentCompoundItem {
  exerciseName: string;
  category?: string;
  equipment?: string;
  pattern: MovementPattern;
  patternLabel: string;
  sbdGroup: SBDGroup | null;
  recentE1RM: number;
  weight: number;
  reps: number;
  date: string;
  allTimeE1RM: number;
  sessionsCount: number;
  isInRecentWindow: boolean;
  isAtAllTimePR: boolean;
  deltaPercent: number | null;
}

export interface StrengthOverview {
  sbd: {
    squat: SBDGroupSummary;
    bench: SBDGroupSummary;
    deadlift: SBDGroupSummary;
    totalE1RM: number | null;
    loggedCount: number;
    extraVariations: SBDVariationItem[];
  };
  recentCompounds: RecentCompoundItem[];
  recentWindowDays: number;
  hasRecentWindowData: boolean;
}

const ISOLATION_EXCLUDE_REGEX =
  /\b(curl|fly|flye|pec deck|crossover|pushdown|kickback|skullcrusher|french press|lateral raise|front raise|rear delt|reverse fly|face pull|shrug|upright row|leg extension|leg curl|calf|kalf|abductor|adductor|tibialis|pullover|straight[- ]arm|sissy squat|hyperextension|back extension|ghd|nordic|crunch|woodchopper|twist|rollout|leg raise|knee raise|dragon flag|toes[- ]to[- ]bar|mountain climber|flutter kick|triceps? extension|triceps? press|overhead\b.*\bextension|wrist|forearm)\b/i;

const SQUAT_SBD_REGEX = /\b(squat|çömelme)\b/i;

const BENCH_SBD_REGEX =
  /\b(bench|chest press|incline dumbbell press|incline press|decline press|super incline press)\b/i;

const DEADLIFT_SBD_REGEX =
  /\b(deadlift|rdl|sldl|rack pull|trap bar|hex bar|stiff[- ]leg)\b/i;

const isExcludedNonStrength = (exerciseName: string, category?: string): boolean => {
  if (category === 'Kardiyo' || category === 'Karın') return true;
  if (isIsometricExerciseName(exerciseName)) return true;
  return false;
};

/**
 * Classifies an exercise into one of the Big 3 (Squat / Bench / Deadlift) variation families.
 * Excludes isolations & non-pressing/non-squatting false positives (e.g., Calf Raise (Hacksquat),
 * Sissy Squat, Decline Bench Crunch, Bench Dips).
 */
export const classifySBDGroup = (exerciseName: string, category?: string): SBDGroup | null => {
  if (isExcludedNonStrength(exerciseName, category)) return null;
  const name = exerciseName.trim();
  if (!name) return null;
  if (ISOLATION_EXCLUDE_REGEX.test(name)) return null;

  // Exclude dips from Bench SBD (dips are still valid compounds under horizontal_push)
  if (/\bdips?\b/i.test(name)) return null;

  if (DEADLIFT_SBD_REGEX.test(name)) return 'deadlift';
  if (SQUAT_SBD_REGEX.test(name)) return 'squat';
  if (BENCH_SBD_REGEX.test(name)) return 'bench';
  return null;
};

/**
 * Classifies whether an exercise is a multi-joint compound strength movement and maps it
 * to one of the 6 primary biomechanical movement patterns.
 */
export const classifyCompoundPattern = (
  exerciseName: string,
  category?: string
): MovementPattern | null => {
  if (isExcludedNonStrength(exerciseName, category)) return null;
  const name = exerciseName.trim();
  if (!name) return null;
  if (ISOLATION_EXCLUDE_REGEX.test(name)) return null;

  // 1. Hinge / posterior chain compounds
  if (
    DEADLIFT_SBD_REGEX.test(name) ||
    /\b(hip thrust|good morning|power clean|hang clean|kettlebell swing)\b/i.test(name)
  ) {
    return 'hinge';
  }

  // 2. Squat / knee-dominant lower-body compounds
  if (
    SQUAT_SBD_REGEX.test(name) ||
    /\b(leg press|lunge|split squat|step[- ]up)\b/i.test(name)
  ) {
    return 'squat';
  }

  // 3. Vertical push (overhead / shoulder presses)
  if (
    /\b(overhead\b.*\bpress|ohp|shoulder press|military press|arnold press|viking press|landmine press|push press|z[- ]press)\b/i.test(
      name
    )
  ) {
    return 'vertical_push';
  }

  // 4. Horizontal push (bench / chest press / dips / weighted push-up)
  if (
    BENCH_SBD_REGEX.test(name) ||
    /\b(push[- ]?up|dips?|dip\b|floor press)\b/i.test(name)
  ) {
    return 'horizontal_push';
  }

  // 5. Vertical pull (pull-up / chin-up / lat pulldown)
  if (/\b(pull[- ]?up|chin[- ]?up|pulldown|barfiks)\b/i.test(name)) {
    return 'vertical_pull';
  }

  // 6. Horizontal pull (barbell/dumbbell/cable/machine/T-bar rows)
  if (/\b(row|t[- ]bar)\b/i.test(name)) {
    return 'horizontal_pull';
  }

  return null;
};

export const isCompoundStrengthExercise = (
  exerciseName: string,
  category?: string
): boolean => classifyCompoundPattern(exerciseName, category) !== null;

interface ExerciseAggregate {
  key: string;
  exerciseName: string;
  category?: string;
  equipment?: string;
  pattern: MovementPattern;
  sbdGroup: SBDGroup | null;
  allTimeE1RM: number;
  allTimeWeight: number;
  allTimeReps: number;
  allTimeDate: string;
  recentE1RM: number;
  recentWeight: number;
  recentReps: number;
  recentDate: string;
  priorBestE1RM: number;
  recentSessionBestList: { dateMs: number; e1rm: number }[];
  totalSessionsCount: number;
  lastPerformedMs: number;
  lastPerformedDate: string;
}

const getEquipmentStrengthWeight = (equipment?: string): number => {
  const eq = (equipment || '').toLowerCase();
  if (eq.includes('barbell')) return 1.12;
  if (eq.includes('dumbbell') || eq.includes('dambıl')) return 1.06;
  if (eq.includes('vücut')) return 1.04;
  return 1.0;
};

export const buildStrengthOverview = (
  workouts: WorkoutSession[],
  options?: {
    nowMs?: number;
    recentWindowDays?: number;
    maxRecentCompounds?: number;
  }
): StrengthOverview => {
  const nowMs = options?.nowMs ?? Date.now();
  const recentWindowDays = options?.recentWindowDays ?? 45;
  const maxRecentCompounds = options?.maxRecentCompounds ?? 5;
  const recentCutoffMs = nowMs - recentWindowDays * 24 * 60 * 60 * 1000;

  const map: Record<string, ExerciseAggregate> = {};

  workouts.forEach(session => {
    if (session.completed === false) return;
    const sessionMs = parseLocalDateString(session.date).getTime();
    const isInRecent = sessionMs >= recentCutoffMs;

    session.exercises.forEach(ex => {
      const pattern = classifyCompoundPattern(ex.exerciseName, ex.category);
      if (!pattern) return;

      let sessionBestE1RM = 0;
      let sessionBestWeight = 0;
      let sessionBestReps = 0;

      ex.sets.forEach(set => {
        if (set.completed && !set.isWarmup && set.weight > 0 && set.reps > 0) {
          const e1rm = Math.round(calculateAutoregulatedE1RM(set.weight, set.reps, set.rir ?? 1));
          if (
            e1rm > sessionBestE1RM ||
            (e1rm === sessionBestE1RM && set.weight > sessionBestWeight)
          ) {
            sessionBestE1RM = e1rm;
            sessionBestWeight = set.weight;
            sessionBestReps = set.reps;
          }
        }
      });

      if (sessionBestE1RM <= 0) return;

      const key = ex.exerciseName.trim().toLowerCase();
      const sbdGroup = classifySBDGroup(ex.exerciseName, ex.category);
      let agg = map[key];

      if (!agg) {
        agg = {
          key,
          exerciseName: ex.exerciseName,
          category: ex.category,
          equipment: ex.equipment,
          pattern,
          sbdGroup,
          allTimeE1RM: sessionBestE1RM,
          allTimeWeight: sessionBestWeight,
          allTimeReps: sessionBestReps,
          allTimeDate: session.date,
          recentE1RM: isInRecent ? sessionBestE1RM : 0,
          recentWeight: isInRecent ? sessionBestWeight : 0,
          recentReps: isInRecent ? sessionBestReps : 0,
          recentDate: isInRecent ? session.date : '',
          priorBestE1RM: !isInRecent ? sessionBestE1RM : 0,
          recentSessionBestList: isInRecent ? [{ dateMs: sessionMs, e1rm: sessionBestE1RM }] : [],
          totalSessionsCount: 1,
          lastPerformedMs: sessionMs,
          lastPerformedDate: session.date,
        };
        map[key] = agg;
        return;
      }

      agg.totalSessionsCount += 1;
      if (ex.category) agg.category = ex.category;
      if (ex.equipment) agg.equipment = ex.equipment;

      if (sessionMs > agg.lastPerformedMs) {
        agg.lastPerformedMs = sessionMs;
        agg.lastPerformedDate = session.date;
      }

      if (
        sessionBestE1RM > agg.allTimeE1RM ||
        (sessionBestE1RM === agg.allTimeE1RM && session.date > agg.allTimeDate)
      ) {
        agg.allTimeE1RM = sessionBestE1RM;
        agg.allTimeWeight = sessionBestWeight;
        agg.allTimeReps = sessionBestReps;
        agg.allTimeDate = session.date;
      }

      if (isInRecent) {
        agg.recentSessionBestList.push({ dateMs: sessionMs, e1rm: sessionBestE1RM });
        if (
          sessionBestE1RM > agg.recentE1RM ||
          (sessionBestE1RM === agg.recentE1RM && session.date > agg.recentDate)
        ) {
          agg.recentE1RM = sessionBestE1RM;
          agg.recentWeight = sessionBestWeight;
          agg.recentReps = sessionBestReps;
          agg.recentDate = session.date;
        }
      } else if (sessionBestE1RM > agg.priorBestE1RM) {
        agg.priorBestE1RM = sessionBestE1RM;
      }
    });
  });

  const allAggs = Object.values(map);

  // --- 1. Build SBD Variations ---
  const buildGroupSummary = (group: SBDGroup): SBDGroupSummary => {
    const variations: SBDVariationItem[] = allAggs
      .filter(a => a.sbdGroup === group)
      .map(a => ({
        exerciseName: a.exerciseName,
        category: a.category,
        equipment: a.equipment,
        group,
        max1RM: a.allTimeE1RM,
        weight: a.allTimeWeight,
        reps: a.allTimeReps,
        date: a.allTimeDate,
        isRecent: a.recentE1RM > 0,
      }))
      .sort((a, b) => {
        if (b.max1RM !== a.max1RM) return b.max1RM - a.max1RM;
        return b.date.localeCompare(a.date);
      });

    return {
      group,
      label: SBD_GROUP_LABELS[group],
      primary: variations[0] ?? null,
      variations,
    };
  };

  const squat = buildGroupSummary('squat');
  const bench = buildGroupSummary('bench');
  const deadlift = buildGroupSummary('deadlift');

  const primaries = [squat.primary, bench.primary, deadlift.primary].filter(
    (p): p is SBDVariationItem => p !== null
  );
  const loggedCount = primaries.length;
  const totalE1RM =
    loggedCount === 3 ? primaries.reduce((sum, p) => sum + p.max1RM, 0) : null;

  const extraVariations: SBDVariationItem[] = [
    ...squat.variations.slice(1),
    ...bench.variations.slice(1),
    ...deadlift.variations.slice(1),
  ]
    .sort((a, b) => {
      if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
      return b.max1RM - a.max1RM;
    })
    .slice(0, 6);

  // --- 2. Build Dynamic Recent 5 Compound Strength Movements ---
  const scoredCandidates = allAggs.map(agg => {
    const isInRecentWindow = agg.recentE1RM > 0;
    const daysSinceLast = Math.max(0, (nowMs - agg.lastPerformedMs) / (24 * 60 * 60 * 1000));
    const displayE1RM = isInRecentWindow ? agg.recentE1RM : agg.allTimeE1RM;
    const recentSessions = agg.recentSessionBestList.length;

    const recencyScore = isInRecentWindow
      ? Math.max(0.3, 1 - daysSinceLast / (recentWindowDays * 1.35))
      : 0.15 / (1 + daysSinceLast / 90);
    const frequencyScore = isInRecentWindow
      ? 1 + Math.min(recentSessions, 6) * 0.25
      : 1 + Math.min(agg.totalSessionsCount, 4) * 0.1;
    const equipmentBoost = getEquipmentStrengthWeight(agg.equipment);
    const loadSignal = 0.8 + Math.log10(Math.max(10, displayE1RM)) * 0.2;

    const score = recencyScore * frequencyScore * equipmentBoost * loadSignal;

    // Trend delta vs prior period or earliest session in recent window
    let deltaPercent: number | null = null;
    if (isInRecentWindow) {
      if (agg.priorBestE1RM > 0) {
        deltaPercent = Math.round(((agg.recentE1RM - agg.priorBestE1RM) / agg.priorBestE1RM) * 100);
      } else if (agg.recentSessionBestList.length >= 2) {
        const sortedSessions = [...agg.recentSessionBestList].sort((a, b) => a.dateMs - b.dateMs);
        const first = sortedSessions[0].e1rm;
        const latest = sortedSessions[sortedSessions.length - 1].e1rm;
        if (first > 0) {
          deltaPercent = Math.round(((latest - first) / first) * 100);
        }
      }
    }

    const item: RecentCompoundItem = {
      exerciseName: agg.exerciseName,
      category: agg.category,
      equipment: agg.equipment,
      pattern: agg.pattern,
      patternLabel: MOVEMENT_PATTERN_LABELS[agg.pattern],
      sbdGroup: agg.sbdGroup,
      recentE1RM: displayE1RM,
      weight: isInRecentWindow ? agg.recentWeight : agg.allTimeWeight,
      reps: isInRecentWindow ? agg.recentReps : agg.allTimeReps,
      date: isInRecentWindow ? agg.recentDate : agg.allTimeDate,
      allTimeE1RM: agg.allTimeE1RM,
      sessionsCount: isInRecentWindow ? recentSessions : agg.totalSessionsCount,
      isInRecentWindow,
      isAtAllTimePR:
        isInRecentWindow && agg.totalSessionsCount >= 2 && agg.recentE1RM >= agg.allTimeE1RM,
      deltaPercent,
    };

    return { item, score };
  });

  // Sort candidates: in-window compounds first, then by dynamic strength representativeness score
  scoredCandidates.sort((a, b) => {
    if (a.item.isInRecentWindow !== b.item.isInRecentWindow) {
      return a.item.isInRecentWindow ? -1 : 1;
    }
    if (b.score !== a.score) return b.score - a.score;
    return b.item.recentE1RM - a.item.recentE1RM;
  });

  // Pass 1: maximize movement-pattern diversity across recent compounds
  const selected: RecentCompoundItem[] = [];
  const usedNames = new Set<string>();
  const usedPatterns = new Set<MovementPattern>();

  for (const { item } of scoredCandidates) {
    if (selected.length >= maxRecentCompounds) break;
    if (!usedPatterns.has(item.pattern)) {
      selected.push(item);
      usedNames.add(item.exerciseName.toLowerCase());
      usedPatterns.add(item.pattern);
    }
  }

  // Pass 2: fill remaining slots up to 5 with next highest-scoring compounds
  for (const { item } of scoredCandidates) {
    if (selected.length >= maxRecentCompounds) break;
    const lower = item.exerciseName.toLowerCase();
    if (!usedNames.has(lower)) {
      selected.push(item);
      usedNames.add(lower);
    }
  }

  // Present selected 5 sorted by e1RM descending for effortless strength scanning
  selected.sort((a, b) => b.recentE1RM - a.recentE1RM);

  return {
    sbd: {
      squat,
      bench,
      deadlift,
      totalE1RM,
      loggedCount,
      extraVariations,
    },
    recentCompounds: selected,
    recentWindowDays,
    hasRecentWindowData: selected.some(item => item.isInRecentWindow),
  };
};
