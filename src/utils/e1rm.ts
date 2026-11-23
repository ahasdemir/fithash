const EPLEY_MULTIPLIER_AT_10 = 1 + 10 / 30; // 4/3 ≈ 1.333333...

/**
 * Continuous RIR-Autoregulated Hybrid e1RM Calculation:
 * - Effective Reps = reps + clamp(rir ?? 1, 0, 5)
 * - If Effective Reps <= 10: weight * (1 + Effective Reps / 30) (RIR-corrected Epley)
 * - If Effective Reps > 10:  weight * (4 / 3) * (Effective Reps / 10) ** 0.10
 *   (Continuously anchored Lombardi tail — matches Epley at Effective Reps = 10
 *   and grows monotonically with damped high-rep scaling, preventing any drop at 10 -> 11.)
 */
export const calculateAutoregulatedE1RM = (
  weight: number,
  reps: number,
  rir: number = 1
): number => {
  if (weight <= 0 || reps <= 0) return 0;
  const safeRir = Math.max(0, Math.min(rir, 5));
  const effectiveReps = reps + safeRir;

  if (effectiveReps <= 10) {
    return weight * (1 + effectiveReps / 30);
  }
  return weight * EPLEY_MULTIPLIER_AT_10 * Math.pow(effectiveReps / 10, 0.10);
};
