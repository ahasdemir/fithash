import { MuscleCategory } from '../types/fitness';

export const ISOMETRIC_REGEX = /plank|hollow body|dead bug|bird dog|statik|isometric|static/i;

export const isIsometricExerciseName = (name?: string | null): boolean =>
  !!name && ISOMETRIC_REGEX.test(name);

export const EXERCISE_CATEGORIES: MuscleCategory[] = [
  'Göğüs',
  'Sırt',
  'Bacak',
  'Omuz',
  'Ön Kol',
  'Arka Kol',
  'Karın',
  'Kardiyo',
];

export const FILTER_CATEGORIES: ('Hepsi' | MuscleCategory)[] = [
  'Hepsi',
  ...EXERCISE_CATEGORIES,
];

export const formatVolumeShort = (kg: number): string => {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg).toLocaleString('tr-TR')} kg`;
};

/**
 * Parses a YYYY-MM-DD (or ISO) string as local midnight to avoid UTC timezone drift.
 */
export const parseLocalDateString = (dateStr: string): Date => {
  const clean = dateStr.split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
