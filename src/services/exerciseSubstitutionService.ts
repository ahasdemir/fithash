import { Exercise, MuscleCategory, EquipmentType } from '../types/fitness';
import { getBiomechanicalProfile, calculateAutoregulatedE1RM } from './progressionEngine';

export interface ExerciseSubstitutionCandidate {
  exercise: Exercise;
  matchScore: number; // 0 - 100
  matchReason: string;
  recommendedStartingWeight: number; // in kg
  stretchBiasScore: number;
  axialRating: 0 | 1 | 2 | 3;
  resistanceProfile: 'LENGTHENED' | 'UNIFORM' | 'SHORTENED';
}

/**
 * Biomechanical Exercise Substitution Engine (Jeff Nippard & RP model):
 * Finds optimal exercise substitutes matching:
 * 1. Primary target muscle & MuscleCategory
 * 2. Resistance profile (e.g., LENGTHENED -> LENGTHENED for maximum mechanical tension)
 * 3. Similar or lower axial fatigue loading (to relieve lower back / CNS when needed)
 * 4. Carries over previous e1RM to calculate accurate recommended starting weight.
 */
export function getExerciseSubstitutes(
  sourceExercise: {
    id?: string;
    name: string;
    category: MuscleCategory;
    equipment?: EquipmentType | string;
    targetMuscle?: string;
    lastWeight?: number;
    lastReps?: number;
    lastRir?: number;
    e1rm?: number;
  },
  allExercises: Exercise[],
  options?: {
    allowDifferentEquipment?: boolean;
    lowerAxialOnly?: boolean;
  }
): ExerciseSubstitutionCandidate[] {
  const srcName = sourceExercise.name.toLowerCase();
  const srcBiomech = getBiomechanicalProfile(
    sourceExercise.name,
    sourceExercise.equipment || '',
    sourceExercise.category
  );

  // Compute source e1RM
  let srcE1RM = sourceExercise.e1rm || 0;
  if (
    srcE1RM === 0 &&
    sourceExercise.lastWeight &&
    sourceExercise.lastWeight > 0 &&
    sourceExercise.lastReps &&
    sourceExercise.lastReps > 0
  ) {
    srcE1RM = calculateAutoregulatedE1RM(
      sourceExercise.lastWeight,
      sourceExercise.lastReps,
      sourceExercise.lastRir ?? 1
    );
  }

  // Filter pool: match primary muscle category or fallback to broader match if needed
  const pool = (allExercises && allExercises.length > 0 ? allExercises : []).filter(ex => {
    if (ex.id && sourceExercise.id && ex.id === sourceExercise.id) return false;
    if (ex.name.toLowerCase() === srcName) return false;
    // Match exact category OR cross-match if categories share movement profiles
    return ex.category === sourceExercise.category;
  });

  const candidates: ExerciseSubstitutionCandidate[] = [];

  for (const ex of pool) {
    const candidateBiomech = getBiomechanicalProfile(ex.name, ex.equipment, ex.category);

    // If lowerAxialOnly is requested, discard higher axial options
    if (options?.lowerAxialOnly && candidateBiomech.axialLoadingIndex > srcBiomech.axialLoadingIndex) {
      continue;
    }

    let score = 50; // base score for same category
    const reasons: string[] = [];

    // 1. Target Muscle Sub-focus Match
    if (
      sourceExercise.targetMuscle &&
      ex.targetMuscle &&
      (sourceExercise.targetMuscle.toLowerCase().includes(ex.targetMuscle.toLowerCase()) ||
        ex.targetMuscle.toLowerCase().includes(sourceExercise.targetMuscle.toLowerCase()))
    ) {
      score += 20;
      reasons.push(`Bölgesel odak uyumlu: ${ex.targetMuscle}`);
    }

    // 2. Resistance Profile Match (Lengthened vs Uniform vs Shortened)
    if (candidateBiomech.resistanceProfile === srcBiomech.resistanceProfile) {
      score += 20;
      reasons.push(`Direnç profili eşleşiyor: ${candidateBiomech.resistanceProfile}`);
    } else if (
      srcBiomech.resistanceProfile === 'LENGTHENED' &&
      candidateBiomech.resistanceProfile === 'UNIFORM'
    ) {
      score += 5;
    }

    // 3. Axial Loading Consideration
    if (candidateBiomech.axialLoadingIndex < srcBiomech.axialLoadingIndex) {
      score += 10;
      reasons.push(
        `Daha düşük omurga/aksiyel yük (A:${candidateBiomech.axialLoadingIndex} vs A:${srcBiomech.axialLoadingIndex})`
      );
    } else if (candidateBiomech.axialLoadingIndex === srcBiomech.axialLoadingIndex) {
      score += 5;
    }

    // 4. Equipment preference
    if (
      sourceExercise.equipment &&
      ex.equipment &&
      sourceExercise.equipment.toLowerCase() === ex.equipment.toLowerCase()
    ) {
      score += 10;
      reasons.push(`Aynı ekipman: ${ex.equipment}`);
    }

    // Recommended starting weight calculation based on e1RM carry-over & biomechanics
    // Different equipment and exercise archetypes require leverage adjustments
    let leverageRatio = 1.0;
    const srcEq = (sourceExercise.equipment || '').toLowerCase();
    const candEq = (ex.equipment || '').toLowerCase();

    // Barbell to Dumbbell leverage adjustment (per dumbbell ~40-45% of barbell total)
    if (srcEq.includes('barbell') && candEq.includes('dumbbell')) {
      leverageRatio = 0.42;
    } else if (srcEq.includes('dumbbell') && candEq.includes('barbell')) {
      leverageRatio = 2.2;
    } else if (srcEq.includes('barbell') && candEq.includes('makine')) {
      leverageRatio = 1.05; // Machine pulleys usually have slightly higher weight stack or 1:1
    } else if (srcEq.includes('dumbbell') && candEq.includes('makine')) {
      leverageRatio = 2.1;
    } else if (srcEq.includes('makine') && candEq.includes('dumbbell')) {
      leverageRatio = 0.45;
    }

    // Axial deload adjustment: if swapping away from heavy axial to isolation, isolate target load
    if (srcBiomech.axialLoadingIndex >= 3 && candidateBiomech.axialLoadingIndex === 0) {
      leverageRatio *= 0.6;
    }

    let recWeight = 0;
    if (sourceExercise.lastWeight && sourceExercise.lastWeight > 0) {
      recWeight = Math.round((sourceExercise.lastWeight * leverageRatio) / 2.5) * 2.5;
      if (recWeight <= 0) recWeight = candidateBiomech.axialLoadingIndex > 0 ? 20 : 10;
    }

    const reasonText = reasons.length > 0 ? reasons.join(' • ') : 'Benzer hareket şablonu';

    candidates.push({
      exercise: ex,
      matchScore: Math.min(100, score),
      matchReason: reasonText,
      recommendedStartingWeight: recWeight,
      stretchBiasScore: candidateBiomech.stimulusMultiplier,
      axialRating: candidateBiomech.axialLoadingIndex,
      resistanceProfile: candidateBiomech.resistanceProfile,
    });
  }

  // Sort by matchScore descending
  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}
