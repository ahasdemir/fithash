/**
 * RIR-Autoregulated Hybrid e1RM Calculation:
 * - Effective Reps = reps + clamp(rir ?? 1, 0, 5)
 * - If Effective Reps <= 10: weight * (1 + Effective Reps / 30) (RIR-corrected Epley)
 * - If Effective Reps > 10: weight * (Effective Reps ** 0.10) (Lombardi model)
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
  return weight * Math.pow(effectiveReps, 0.10);
};
