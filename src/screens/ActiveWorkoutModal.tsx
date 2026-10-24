import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  PanResponder,
  Animated,
  Dimensions,
  AppState,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession, WorkoutExercise, ExerciseSet, Exercise, ExerciseFeedback } from '../types/fitness';
import { RestTimerBar } from '../components/RestTimerBar';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { CustomAlertModal, CustomAlertOptions } from '../components/CustomAlertModal';
import { ExercisePRDetailModal } from '../components/ExercisePRDetailModal';
import { ExerciseSwapModal } from '../components/ExerciseSwapModal';
import { ExerciseRPFeedback } from '../components/ExerciseRPFeedback';
import { getExercises, getWorkouts, getActiveRestTimerEnd, saveActiveRestTimerEnd } from '../services/storage';
import { scheduleRestTimerNotification, cancelRestTimerNotification } from '../services/notifications';
import {
  calculateSmartAutoregulatedOverload,
  SmartOverloadRecommendation,
  getBiomechanicalProfile,
  calculateDynamicRestSeconds,
  predictFatigueDecayReps,
  suggestBackOffWeightDrop,
  getHypertrophyRepBracket
} from '../services/progressionEngine';
import { getAppSettings } from '../services/settings';

interface ActiveWorkoutModalProps {
  visible: boolean;
  activeSession: WorkoutSession | null;
  onUpdateSession: (session: WorkoutSession) => void;
  onFinishSession: (session: WorkoutSession) => void;
  onCancelSession: () => void;
  onBackgroundSession?: () => void;
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({
  visible,
  activeSession,
  onUpdateSession,
  onFinishSession,
  onCancelSession,
  onBackgroundSession,
}) => {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<WorkoutSession | null>(activeSession);
  const [pastWorkouts, setPastWorkouts] = useState<WorkoutSession[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(90);
  const [restTimerKey, setRestTimerKey] = useState(Date.now());
  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);
  const [toggledRecs, setToggledRecs] = useState<Record<string, boolean>>({});
  const [rawInputMap, setRawInputMap] = useState<Record<string, string>>({});
  const [selectedPRExercise, setSelectedPRExercise] = useState<Exercise | null>(null);
  const [swappingExercise, setSwappingExercise] = useState<{ exercise: WorkoutExercise; index: number } | null>(null);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const lastRecTapTimeRef = useRef<Record<string, number>>({});

  const [userSettings, setUserSettings] = useState<{ defaultRestSeconds: number; autoStartRestTimer: boolean }>({
    defaultRestSeconds: 90,
    autoStartRestTimer: true,
  });

  const restoredTimerRef = useRef(false);

  useEffect(() => {
    setSession(activeSession);
    if (activeSession) {
      const elapsed = Math.floor((Date.now() - activeSession.startTime) / 1000);
      setElapsedSeconds(elapsed > 0 ? elapsed : 0);
    }
  }, [activeSession]);

  useEffect(() => {
    if (visible) {
      restoredTimerRef.current = false;
      if (activeSession) {
        const elapsed = Math.floor((Date.now() - activeSession.startTime) / 1000);
        setElapsedSeconds(elapsed > 0 ? elapsed : 0);
      }
      getWorkouts().then(data => setPastWorkouts(data));
      getExercises().then(data => setAvailableExercises(data));
      getAppSettings().then(s => {
        setUserSettings({
          defaultRestSeconds: s.defaultRestSeconds ?? 90,
          autoStartRestTimer: s.autoStartRestTimer ?? true,
        });
      });
    }
  }, [visible]);

  useEffect(() => {
    if (visible && session && !session.completed && !restoredTimerRef.current) {
      restoredTimerRef.current = true;
      restoreRestTimer();
    }
  }, [visible, session]);

  // Handle app coming to foreground from locked screen
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        if (activeSession) {
          const elapsed = Math.floor((Date.now() - activeSession.startTime) / 1000);
          setElapsedSeconds(elapsed > 0 ? elapsed : 0);
        }
        const endTime = await getActiveRestTimerEnd();
        if (endTime !== null) {
          if (endTime > Date.now()) {
            const remaining = Math.max(1, Math.ceil((endTime - Date.now()) / 1000));
            setRestTimerSeconds(remaining);
            setShowRestTimer(true);
          } else {
            await saveActiveRestTimerEnd(null);
            cancelRestTimerNotification();
            setShowRestTimer(false);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [activeSession]);

  const restoreRestTimer = async () => {
    const endTime = await getActiveRestTimerEnd();
    if (endTime === null) return;

    if (endTime > Date.now()) {
      const remaining = Math.max(1, Math.ceil((endTime - Date.now()) / 1000));
      setRestTimerSeconds(remaining);
      setRestTimerKey(Date.now());
      setShowRestTimer(true);
      scheduleRestTimerNotification(endTime);
    } else {
      saveActiveRestTimerEnd(null);
      cancelRestTimerNotification();
    }
  };

  const handleRestDeadlineChange = useCallback((endTime: number | null) => {
    saveActiveRestTimerEnd(endTime);
    if (endTime !== null) {
      scheduleRestTimerNotification(endTime);
    } else {
      cancelRestTimerNotification();
    }
  }, []);

  const translateY = useRef(new Animated.Value(0)).current;

  const handleBackground = useCallback(() => {
    setShowRestTimer(false);
    onBackgroundSession?.();
    translateY.setValue(0);
  }, [onBackgroundSession, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.4) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            handleBackground();
          });
        } else if (Math.abs(gestureState.dy) < 6 && Math.abs(gestureState.dx) < 6) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            handleBackground();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    let timer: any = null;
    if (visible && session && session.completed === false) {
      const updateElapsed = () => {
        const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
        setElapsedSeconds(elapsed > 0 ? elapsed : 0);
      };
      updateElapsed();
      timer = setInterval(updateElapsed, 1000);
    }
    return () => clearInterval(timer);
  }, [visible, session?.startTime, session?.completed]);

  if (!session) return null;

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  };

  // Progressive Overload weight recommendation engine (Gold-Standard Double Progression & RP Model)
  const calculateRecommendation = (
    exName: string,
    exId: string,
    equipment: string = '',
    category: string = ''
  ): SmartOverloadRecommendation | null => {
    const pastSessions: ExerciseSet[][] = [];
    for (const past of pastWorkouts) {
      if (past.id === session.id) continue;

      const match = past.exercises.find(e => e.exerciseId === exId || e.exerciseName.toLowerCase() === exName.toLowerCase());
      if (match) {
        const validSets = match.sets.filter(s => s.completed && s.weight > 0);
        if (validSets.length > 0) {
          pastSessions.push(validSets);
          if (pastSessions.length >= 3) break; // Collect up to 3 past sessions for trend analysis
        }
      }
    }

    if (pastSessions.length > 0) {
      return calculateSmartAutoregulatedOverload(exName, equipment, pastSessions, undefined, category);
    }
    return null;
  };

  const handleToggleRecView = (exId: string) => {
    setToggledRecs(prev => ({ ...prev, [exId]: !prev[exId] }));
  };

  const handleRecPress = (exId: string, rec: SmartOverloadRecommendation) => {
    const now = Date.now();
    const lastTap = lastRecTapTimeRef.current[exId] || 0;
    const DOUBLE_TAP_DELAY = 300; // ms

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap -> Fill sets with recommendation!
      handleApplyRecommendation(exId, rec);
      lastRecTapTimeRef.current[exId] = 0;
    } else {
      // Single tap -> Toggle view between recommendation badge label and last stats preview
      lastRecTapTimeRef.current[exId] = now;
      handleToggleRecView(exId);
    }
  };

  const handleOpenExercisePR = (ex: WorkoutExercise) => {
    setSelectedPRExercise({
      id: ex.exerciseId,
      name: ex.exerciseName,
      category: ex.category,
      equipment: ex.equipment,
      isCustom: false,
    });
  };

  const handleApplyRecommendation = (exId: string, rec: SmartOverloadRecommendation) => {
    // Fill recommendation targets into sets (triggered on long press or explicit apply)
    setRawInputMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k.startsWith(`${exId}_`)) delete next[k];
      });
      return next;
    });

    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      
      // If DELOAD recommendation provides a custom number of sets (e.g. 50% volume cut)
      let setsToApply = ex.sets;
      if (rec.actionType === 'DELOAD' && rec.setTargets && rec.setTargets.length > 0) {
        setsToApply = ex.sets.slice(0, rec.setTargets.length);
      }

      const copySets = setsToApply.map((s, idx) => {
        const setTarget = rec.setTargets && rec.setTargets[idx];
        return {
          ...s,
          weight: setTarget ? setTarget.weight : (rec.recWeight > 0 ? rec.recWeight : s.weight),
          reps: setTarget ? setTarget.reps : (rec.recReps > 0 ? rec.recReps : s.reps),
          rir: setTarget ? setTarget.targetRir : (s.rir ?? 1),
        };
      });
      return { ...ex, sets: copySets };
    });

    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleAddExercise = (ex: Exercise) => {
    const rec = calculateRecommendation(ex.name, ex.id, ex.equipment, ex.category);
    const defaultWeight = rec ? rec.recWeight : 0;
    const isCardio = ex.category === 'Kardiyo';
    const isIso = isIsometricExercise(ex.name, ex.category);

    const newWorkoutEx: WorkoutExercise = {
      id: `wex_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      exerciseId: ex.id,
      exerciseName: ex.name,
      category: ex.category,
      equipment: ex.equipment,
      sets: [
        {
          id: `set_1_${Date.now()}`,
          setNumber: 1,
          weight: isCardio || isIso ? 0 : defaultWeight,
          reps: isCardio || isIso ? 0 : 10,
          rir: isCardio ? undefined : 1,
          durationSeconds: isIso ? 60 : undefined,
          durationMinutes: isCardio ? 15 : undefined,
          distanceKm: isCardio ? 2.5 : undefined,
          completed: false,
        },
      ],
    };

    const updated = {
      ...session,
      exercises: [...session.exercises, newWorkoutEx],
    };

    setSession(updated);
    onUpdateSession(updated);
  };

  const handleMoveExercise = (index: number, direction: -1 | 1) => {
    if (!session) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= session.exercises.length) return;

    const copy = [...session.exercises];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const updated = { ...session, exercises: copy };
    setSession(updated);
    onUpdateSession(updated);
  };

  const isIsometricExercise = (name: string, cat?: string) => {
    return /plank|hollow body|dead bug|bird dog|statik/i.test(name);
  };

  const handleSetChange = (exId: string, setIdx: number, field: keyof ExerciseSet, val: any) => {
    let cleanString = typeof val === 'string' ? val : (val != null ? String(val) : '');
    const isDecimalField = field === 'weight' || field === 'distanceKm';
    const rawKey = `${exId}_${setIdx}_${field}`;

    if (isDecimalField && typeof val === 'string') {
      // Normalize Samsung keyboard comma (,) to dot (.) and sanitize
      cleanString = val.replace(',', '.').replace(/[^0-9.]/g, '');
      const parts = cleanString.split('.');
      if (parts.length > 2) {
        cleanString = parts[0] + '.' + parts.slice(1).join('');
      }
      setRawInputMap(prev => ({ ...prev, [rawKey]: cleanString }));
    } else if ((field === 'reps' || field === 'durationMinutes' || field === 'durationSeconds') && typeof val === 'string') {
      cleanString = val.replace(/[^0-9]/g, '');
      setRawInputMap(prev => ({ ...prev, [rawKey]: cleanString }));
    }

    const floatVal = parseFloat(cleanString);
    const parsedVal = isNaN(floatVal) ? 0 : floatVal;

    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      const copySets = [...ex.sets];

      const updatedSet = {
        ...copySets[setIdx],
        [field]: parsedVal,
      };

      // Recalculate average speed for cardio sets
      if (field === 'durationMinutes' || field === 'distanceKm') {
        const mins = field === 'durationMinutes' ? parsedVal : (updatedSet.durationMinutes || 0);
        const dist = field === 'distanceKm' ? parsedVal : (updatedSet.distanceKm || 0);
        if (mins > 0 && dist > 0) {
          updatedSet.avgSpeedKmh = parseFloat(((dist / mins) * 60).toFixed(1));
        }
      }

      copySets[setIdx] = updatedSet;
      return { ...ex, sets: copySets };
    });

    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleCycleRir = (exId: string, setIdx: number) => {
    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      const copySets = [...ex.sets];
      const currentSet = copySets[setIdx];

      let nextRir: number | undefined;
      let nextIsWarmup = false;

      if (currentSet.isWarmup) {
        // W (Warmup) -> RIR 0 (Tükeniş / Failure)
        nextRir = 0;
        nextIsWarmup = false;
      } else if (currentSet.rir === 0) {
        // RIR 0 -> RIR 1
        nextRir = 1;
        nextIsWarmup = false;
      } else if (currentSet.rir === 1) {
        // RIR 1 -> RIR 2
        nextRir = 2;
        nextIsWarmup = false;
      } else if (currentSet.rir === 2) {
        // RIR 2 -> RIR 3
        nextRir = 3;
        nextIsWarmup = false;
      } else if (currentSet.rir === 3) {
        // RIR 3 -> Boş / Belirtilmemiş (-)
        nextRir = undefined;
        nextIsWarmup = false;
      } else {
        // Boş / Undefined (-) -> W (Isınma / Warmup)
        nextRir = undefined;
        nextIsWarmup = true;
      }

      copySets[setIdx] = {
        ...currentSet,
        rir: nextRir,
        isWarmup: nextIsWarmup,
      };

      // Çalışma setlerini 1, 2, 3... ve ısınma setlerini bağımsız olarak yeniden numaralandır
      let workingCounter = 0;
      let warmupCounter = 0;
      const reindexedSets = copySets.map(s => {
        if (s.isWarmup) {
          warmupCounter++;
          return { ...s, setNumber: warmupCounter };
        } else {
          workingCounter++;
          return { ...s, setNumber: workingCounter };
        }
      });

      return { ...ex, sets: reindexedSets };
    });

    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleToggleSetComplete = (exId: string, setIdx: number) => {
    let isNowCompleted = false;
    let completedExercise: WorkoutExercise | undefined;
    let completedSet: ExerciseSet | undefined;

    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      const copySets = [...ex.sets];
      const currentState = copySets[setIdx].completed;
      isNowCompleted = !currentState;
      copySets[setIdx] = {
        ...copySets[setIdx],
        completed: isNowCompleted,
      };

      // Autoregulation: If set was completed and there is a subsequent set,
      // evaluate intra-workout neuromuscular fatigue decay and suggest back-off weight drop if needed.
      if (isNowCompleted && setIdx < copySets.length - 1) {
        const nextSet = copySets[setIdx + 1];
        if (!nextSet.completed && !nextSet.isWarmup) {
          const finishedSet = copySets[setIdx];
          const biomech = getBiomechanicalProfile(ex.exerciseName, ex.equipment, ex.category);
          const repBracket = getHypertrophyRepBracket(ex.exerciseName, ex.equipment, ex.category);
          const predictedNextReps = predictFatigueDecayReps(
            finishedSet.reps,
            nextSet.setNumber || (setIdx + 2),
            biomech.decayConstantLambda,
            biomech.standardRestSeconds,
            biomech.standardRestSeconds
          );
          const backOff = suggestBackOffWeightDrop(
            predictedNextReps,
            repBracket.minReps,
            finishedSet.weight,
            ex.equipment,
            biomech.axialLoadingIndex
          );

          if (backOff.shouldDropWeight && nextSet.weight >= finishedSet.weight) {
            copySets[setIdx + 1] = {
              ...nextSet,
              weight: backOff.recommendedWeight,
              reps: Math.max(repBracket.minReps, nextSet.reps),
            };
          }
        }
      }

      completedExercise = ex;
      completedSet = copySets[setIdx];
      return { ...ex, sets: copySets };
    });

    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);

    if (isNowCompleted && userSettings.autoStartRestTimer && completedExercise) {
      const isCardio = completedExercise.category === 'Kardiyo';
      let restSecs = userSettings.defaultRestSeconds || 90;

      if (!isCardio && completedSet) {
        const biomech = getBiomechanicalProfile(completedExercise.exerciseName, completedExercise.equipment, completedExercise.category);
        const setRir = completedSet.rir ?? 2;
        // Dynamically scale rest time based on base rest, RIR proximity to failure, and axial load index
        restSecs = calculateDynamicRestSeconds(
          userSettings.defaultRestSeconds || biomech.standardRestSeconds,
          setRir,
          biomech.axialLoadingIndex
        );
      }

      const targetEnd = Date.now() + restSecs * 1000;
      saveActiveRestTimerEnd(targetEnd);
      scheduleRestTimerNotification(targetEnd);
      setRestTimerSeconds(restSecs);
      setRestTimerKey(Date.now());
      setShowRestTimer(true);
    }
  };

  const handleAddSet = (exId: string) => {
    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      const lastSet = ex.sets[ex.sets.length - 1];
      const isCardio = ex.category === 'Kardiyo';
      const isIsometric = isIsometricExercise(ex.exerciseName, ex.category);

      const newSet: ExerciseSet = {
        id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        setNumber: 1, // aşağıda reindexedSets ile belirlenecek
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : (isIsometric ? 0 : 10),
        isWarmup: false,
        rir: lastSet && !lastSet.isWarmup ? lastSet.rir : 1,
        durationSeconds: lastSet?.durationSeconds ?? (isIsometric ? 60 : undefined),
        durationMinutes: lastSet?.durationMinutes ?? (isCardio ? 15 : undefined),
        distanceKm: lastSet?.distanceKm ?? (isCardio ? 2.5 : undefined),
        completed: false,
      };

      const newSets = [...ex.sets, newSet];
      let workingCounter = 0;
      let warmupCounter = 0;
      const reindexedSets = newSets.map(s => {
        if (s.isWarmup) {
          warmupCounter++;
          return { ...s, setNumber: warmupCounter };
        } else {
          workingCounter++;
          return { ...s, setNumber: workingCounter };
        }
      });

      return { ...ex, sets: reindexedSets };
    });

    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleRemoveSet = (exId: string, setIdx: number) => {
    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      if (ex.sets.length <= 1) {
        setCustomAlert({
          visible: true,
          type: 'warning',
          title: 'Uyarı',
          message: 'Bir harekette en az 1 set bulunmalıdır.',
          onConfirm: () => setCustomAlert(null),
        });
        return ex;
      }
      const remainingSets = ex.sets.filter((_, i) => i !== setIdx);
      let workingCounter = 0;
      let warmupCounter = 0;
      const reindexedSets = remainingSets.map(s => {
        if (s.isWarmup) {
          warmupCounter++;
          return { ...s, setNumber: warmupCounter };
        } else {
          workingCounter++;
          return { ...s, setNumber: workingCounter };
        }
      });
      return { ...ex, sets: reindexedSets };
    });

    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleSwapExerciseSelect = (newEx: Exercise, recommendedWeight: number) => {
    if (!swappingExercise) return;
    const { exercise: oldEx } = swappingExercise;

    const isCardio = newEx.category === 'Kardiyo';
    const isIso = isIsometricExercise(newEx.name, newEx.category);

    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== oldEx.id) return ex;

      // Preserve completed status if any, but update IDs and names
      return {
        ...ex,
        exerciseId: newEx.id,
        exerciseName: newEx.name,
        category: newEx.category,
        equipment: newEx.equipment,
        sets: ex.sets.map(s => ({
          ...s,
          weight: recommendedWeight > 0 ? recommendedWeight : (isCardio || isIso ? 0 : s.weight),
        })),
      };
    });

    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
    setSwappingExercise(null);
  };

  const handleUpdateExerciseFeedback = (exId: string, feedback: ExerciseFeedback) => {
    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      return { ...ex, feedback };
    });
    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleRemoveExercise = (exId: string) => {
    const updatedExercises = session.exercises.filter(ex => ex.id !== exId);
    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleFinish = () => {
    let totalVolume = 0;
    let totalSetsCount = 0;
    let rirSum = 0;
    let rirCount = 0;
    let totalCaloriesBurned = 0;
    let totalCardioDistance = 0;
    let totalCardioMins = 0;

    session.exercises.forEach(ex => {
      const isCardio = ex.category === 'Kardiyo';
      const isIso = isIsometricExercise(ex.exerciseName, ex.category);

      ex.sets.forEach(s => {
        if (s.completed) {
          totalSetsCount++;
          if (isIso) {
            const holdSecs = s.durationSeconds || 60;
            // Isometric calorie estimation (MET ~4.0 for plank/core holds)
            totalCaloriesBurned += Math.round(4.0 * 75 * (holdSecs / 3600));
            if (s.rir !== undefined && !s.isWarmup) {
              rirSum += s.rir;
              rirCount++;
            }
          } else if (!isCardio) {
            if (s.weight > 0) {
              totalVolume += s.weight * s.reps;
            }
            if (s.rir !== undefined && !s.isWarmup) {
              rirSum += s.rir;
              rirCount++;
            }
            // Resistance training calorie estimation
            totalCaloriesBurned += Math.round(s.reps * (1 + s.weight / 60) * 0.4);
          } else if (isCardio) {
            const mins = s.durationMinutes || 15;
            const dist = s.distanceKm || 0;
            totalCardioDistance += dist;
            totalCardioMins += mins;

            let met = 7.0;
            const name = ex.exerciseName.toLowerCase();
            if (name.includes('yürüyüş') || name.includes('walk')) met = 3.8;
            else if (name.includes('koşu') || name.includes('treadmill')) met = 9.8;
            else if (name.includes('bisiklet') || name.includes('cycle')) met = 7.5;
            else if (name.includes('eliptik')) met = 7.0;
            else if (name.includes('kürek') || name.includes('row')) met = 7.0;

            const kcal = Math.round(met * 75 * (mins / 60));
            totalCaloriesBurned += kcal;
          }
        }
      });
    });

    if (totalSetsCount === 0) {
      setCustomAlert({
        visible: true,
        type: 'warning',
        title: 'Boş Antrenman',
        message: 'Antrenmanı tamamlamak için en az bir seti tamamlamış (işaretlemiş) olmanız gerekir. Antrenmanı kaydetmek istemiyorsanız "Vazgeç" butonunu kullanabilirsiniz.',
        confirmText: 'Tamam',
        onConfirm: () => setCustomAlert(null),
      });
      return;
    }

    const finalSession: WorkoutSession = {
      ...session,
      endTime: Date.now(),
      durationSeconds: elapsedSeconds,
      totalVolume,
      totalSets: totalSetsCount,
      avgRir: rirCount > 0 ? Math.round((rirSum / rirCount) * 10) / 10 : undefined,
      totalCaloriesBurned,
      totalCardioDistanceKm: Math.round(totalCardioDistance * 10) / 10,
      totalCardioMinutes: totalCardioMins,
      completed: true,
    };

    onFinishSession(finalSession);
    saveActiveRestTimerEnd(null);
    cancelRestTimerNotification();
  };

  const getRirColor = (rir?: number, isWarmup?: boolean) => {
    if (isWarmup) return '#F97316';   // Warm Orange (Warmup)
    if (rir === 0) return '#EF4444'; // Failure / Crimson Red
    if (rir === 1) return '#F59E0B'; // Amber
    if (rir === 2) return '#10B981'; // Emerald
    if (rir === 3) return '#3B82F6'; // Muted Blue
    return COLORS.textMuted;         // Empty / Undefined
  };

  const getRirLabel = (rir?: number, isWarmup?: boolean) => {
    if (isWarmup) return 'W';
    if (rir !== undefined) return `RIR ${rir}`;
    return '-';
  };

  const handleCancelSession = () => {
    setCustomAlert({
      visible: true,
      type: 'danger',
      title: 'Antrenman İptal Edilsin mi?',
      message: 'Mevcut antrenman kaydedilmeden sonlandırılacaktır. Emin misiniz?',
      confirmText: 'Evet, İptal Et',
      cancelText: 'Vazgeç',
      onConfirm: () => {
        setCustomAlert(null);
        saveActiveRestTimerEnd(null);
        cancelRestTimerNotification();
        onCancelSession();
      },
      onCancel: () => setCustomAlert(null),
    });
  };

  return (
    <Modal visible={visible} animationType="none" transparent>
      <Animated.View style={[styles.container, { paddingTop: Math.max(10, insets.top), transform: [{ translateY }] }]}>
        {/* Top Sheet Drag Handle Bar for Minimizing */}
        {onBackgroundSession && (
          <View
            {...panResponder.panHandlers}
            style={styles.topDragHandleBarContainer}
          >
            <View style={styles.topDragHandleBar} />
          </View>
        )}

        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancelSession}
            style={styles.cancelBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Vazgeç</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <TextInput
              style={styles.sessionTitleInput}
              value={session.name}
              numberOfLines={1}
              selectTextOnFocus
              onChangeText={txt => {
                const updated = { ...session, name: txt };
                setSession(updated);
                onUpdateSession(updated);
              }}
            />
            <View style={styles.timerBadge}>
              <Ionicons name="time" size={12} color="#111111" />
              <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} activeOpacity={0.8}>
            <Text style={styles.finishText}>Bitir</Text>
          </TouchableOpacity>
        </View>

        {showRestTimer && (
          <View style={{ paddingHorizontal: 16 }}>
            <RestTimerBar
              key={restTimerKey}
              initialSeconds={restTimerSeconds}
              onClose={() => {
                saveActiveRestTimerEnd(null);
                cancelRestTimerNotification();
                setShowRestTimer(false);
              }}
              onDeadlineChange={handleRestDeadlineChange}
            />
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 70 }
          ]}
        >
          {session.exercises.map((ex, exIndex) => {
            const catColor = COLORS.category[ex.category] || COLORS.textPrimary;
            const isCardio = ex.category === 'Kardiyo';
            const exVolume = ex.sets.reduce((acc, s) => s.completed ? acc + (s.weight * s.reps) : acc, 0);
            const recommendation = !isCardio ? calculateRecommendation(ex.exerciseName, ex.exerciseId, ex.equipment, ex.category) : null;

            return (
              <View key={ex.id} style={styles.exCard}>
                <View style={styles.exCardHeader}>
                  {/* Top Row: Exercise Name & Controls */}
                  <View style={styles.exTopRow}>
                    <Text style={styles.exName} numberOfLines={1} ellipsizeMode="tail">
                      {exIndex + 1}. {ex.exerciseName}
                    </Text>

                    <View style={styles.exCardHeaderRight}>
                      {!isCardio && exVolume > 0 && (
                        <Text style={styles.exVolumeText}>{exVolume} kg</Text>
                      )}

                      {/* Biomechanical Exercise Swap Button (Icon Only) */}
                      {!isCardio && (
                        <TouchableOpacity
                          style={styles.swapExIconBtn}
                          onPress={() => setSwappingExercise({ exercise: ex, index: exIndex })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="swap-horizontal" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                      )}

                      {session.exercises.length > 1 && (
                        <View style={styles.activeReorderGroup}>
                          <TouchableOpacity
                            style={[styles.activeReorderBtn, exIndex === 0 && styles.activeReorderBtnDisabled]}
                            disabled={exIndex === 0}
                            onPress={() => handleMoveExercise(exIndex, -1)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="chevron-up" size={16} color={exIndex === 0 ? COLORS.textMuted : COLORS.textPrimary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.activeReorderBtn, exIndex === session.exercises.length - 1 && styles.activeReorderBtnDisabled]}
                            disabled={exIndex === session.exercises.length - 1}
                            onPress={() => handleMoveExercise(exIndex, 1)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="chevron-down" size={16} color={exIndex === session.exercises.length - 1 ? COLORS.textMuted : COLORS.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      )}

                      <TouchableOpacity
                        onPress={() => handleRemoveExercise(ex.id)}
                        style={{ padding: 4 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Bottom Row: Muscle Group Tag & Recommendation Tag */}
                  <View style={styles.exMetaRow}>
                    <View style={[styles.catBadge, { backgroundColor: catColor + '15' }]}>
                      <Text style={[styles.catBadgeText, { color: catColor }]}>{ex.category}</Text>
                    </View>

                    {recommendation && (() => {
                      const isToggled = !!toggledRecs[ex.id];
                      const recentStatsText = recommendation.lastWeight > 0
                        ? `Son: ${recommendation.lastWeight} kg × ${recommendation.lastReps} rep`
                        : `Son: ${recommendation.lastReps} rep`;
                      const displayText = isToggled ? recentStatsText : recommendation.badgeLabel;

                      return (
                        <TouchableOpacity
                          style={[styles.recBadgePill, isToggled && styles.recBadgePillToggled]}
                          activeOpacity={0.8}
                          onPress={() => handleRecPress(ex.id, recommendation)}
                          onLongPress={() => handleOpenExercisePR(ex)}
                        >
                          <Ionicons
                            name={
                              isToggled
                                ? 'stats-chart-outline'
                                : (recommendation.actionType === 'MORE_WEIGHT' || recommendation.actionType === 'AGGRESSIVE_MORE_WEIGHT'
                                  ? 'trending-up'
                                  : recommendation.actionType === 'MORE_REPS'
                                  ? 'add-circle-outline'
                                  : recommendation.actionType === 'DELOAD'
                                  ? 'refresh-circle-outline'
                                  : recommendation.actionType === 'LESS_WEIGHT'
                                  ? 'trending-down'
                                  : 'shield-checkmark-outline')
                            }
                            size={12}
                            color={isToggled ? COLORS.textPrimary : (recommendation.actionType === 'DELOAD' ? COLORS.warning || '#f59e0b' : '#111111')}
                          />
                          <Text style={[styles.recBadgeText, isToggled && styles.recBadgeTextToggled]}>
                            {displayText}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </View>

                {/* Table Header */}
                {isCardio ? (
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { width: 28 }]}>SET</Text>
                    <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>SÜRE (DK)</Text>
                    <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>MESAFE (KM)</Text>
                    <Text style={[styles.th, { width: 68, textAlign: 'center' }]}>ORT. HIZ</Text>
                    <Text style={[styles.th, { width: 36, textAlign: 'center' }]}>ONAY</Text>
                    <Text style={[styles.th, { width: 28, textAlign: 'center' }]}></Text>
                  </View>
                ) : isIsometricExercise(ex.exerciseName, ex.category) ? (
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { width: 28 }]}>SET</Text>
                    <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>SÜRE (SN)</Text>
                    <Text style={[styles.th, { width: 58, textAlign: 'center' }]}>RIR</Text>
                    <Text style={[styles.th, { width: 36, textAlign: 'center' }]}>ONAY</Text>
                    <Text style={[styles.th, { width: 28, textAlign: 'center' }]}></Text>
                  </View>
                ) : (
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { width: 28 }]}>SET</Text>
                    <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>
                      {ex.equipment === 'Vücut Ağırlığı' ? '+KG' : 'KG'}
                    </Text>
                    <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>TEKRAR</Text>
                    <Text style={[styles.th, { width: 58, textAlign: 'center' }]}>RIR</Text>
                    <Text style={[styles.th, { width: 36, textAlign: 'center' }]}>ONAY</Text>
                    <Text style={[styles.th, { width: 28, textAlign: 'center' }]}></Text>
                  </View>
                )}

                {/* Sets Rows */}
                {ex.sets.map((set, setIdx) => {
                  const isIso = isIsometricExercise(ex.exerciseName, ex.category);
                  const isBodyweight = ex.equipment === 'Vücut Ağırlığı' && !isCardio && !isIso;
                  const workingSetIndex = ex.sets.slice(0, setIdx + 1).filter(s => !s.isWarmup).length;
                  const displaySetNumber = set.isWarmup ? 'W' : (workingSetIndex || set.setNumber);

                  if (isCardio) {
                    const mins = set.durationMinutes || 0;
                    const dist = set.distanceKm || 0;
                    const speed = mins > 0 && dist > 0 ? ((dist / mins) * 60).toFixed(1) : '-';
                    const durRawKey = `${ex.id}_${setIdx}_durationMinutes`;
                    const distRawKey = `${ex.id}_${setIdx}_distanceKm`;
                    const durDisplay = rawInputMap[durRawKey] !== undefined ? rawInputMap[durRawKey] : (mins > 0 ? mins.toString() : '');
                    const distDisplay = rawInputMap[distRawKey] !== undefined ? rawInputMap[distRawKey] : (dist > 0 ? dist.toString() : '');

                    return (
                      <View key={set.id} style={[styles.tableRow, set.completed && styles.tableRowCompleted]}>
                        <Text style={styles.setNumberText}>{displaySetNumber}</Text>

                        {/* Duration Minutes Input */}
                        <View style={styles.inputCell}>
                          <TextInput
                            style={[styles.setNumInput, set.completed && styles.inputCompleted]}
                            keyboardType="number-pad"
                            placeholder="15"
                            placeholderTextColor={COLORS.textMuted}
                            value={durDisplay}
                            onChangeText={v => handleSetChange(ex.id, setIdx, 'durationMinutes', v)}
                          />
                        </View>

                        {/* Distance KM Input */}
                        <View style={styles.inputCell}>
                          <TextInput
                            style={[styles.setNumInput, set.completed && styles.inputCompleted]}
                            keyboardType="decimal-pad"
                            placeholder="2.5"
                            placeholderTextColor={COLORS.textMuted}
                            value={distDisplay}
                            onChangeText={v => handleSetChange(ex.id, setIdx, 'distanceKm', v)}
                            onBlur={() => {
                              if (rawInputMap[distRawKey]?.endsWith('.')) {
                                const cleaned = rawInputMap[distRawKey].slice(0, -1);
                                setRawInputMap(prev => ({ ...prev, [distRawKey]: cleaned }));
                              }
                            }}
                          />
                        </View>

                        {/* Speed Pill Display */}
                        <View style={styles.speedPill}>
                          <Text style={styles.speedPillText}>{speed} km/h</Text>
                        </View>

                        {/* Checkmark Button */}
                        <TouchableOpacity
                          style={[styles.checkBtn, set.completed && styles.checkBtnCompleted]}
                          onPress={() => handleToggleSetComplete(ex.id, setIdx)}
                        >
                          <Ionicons name="checkmark" size={14} color={set.completed ? '#111111' : COLORS.textMuted} />
                        </TouchableOpacity>

                        {/* Delete Set */}
                        <TouchableOpacity
                          style={styles.deleteSetBtn}
                          onPress={() => handleRemoveSet(ex.id, setIdx)}
                          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (isIso) {
                    const secs = set.durationSeconds !== undefined ? set.durationSeconds : 60;
                    const durRawKey = `${ex.id}_${setIdx}_durationSeconds`;
                    const durDisplay = rawInputMap[durRawKey] !== undefined ? rawInputMap[durRawKey] : (secs > 0 ? secs.toString() : '');
                    const rirColor = getRirColor(set.rir, set.isWarmup);
                    const rirLabel = getRirLabel(set.rir, set.isWarmup);

                    return (
                      <View
                        key={set.id}
                        style={[
                          styles.tableRow,
                          set.completed && styles.tableRowCompleted,
                          set.isWarmup && styles.tableRowWarmup,
                        ]}
                      >
                        <Text style={[styles.setNumberText, set.isWarmup && styles.setNumberWarmup]}>
                          {displaySetNumber}
                        </Text>

                        {/* Duration Seconds Input */}
                        <View style={[styles.inputCell, { flex: 1 }]}>
                          <TextInput
                            style={[styles.setNumInput, set.completed && styles.inputCompleted]}
                            keyboardType="number-pad"
                            placeholder="60"
                            placeholderTextColor={COLORS.textMuted}
                            value={durDisplay}
                            onChangeText={v => handleSetChange(ex.id, setIdx, 'durationSeconds', v)}
                          />
                        </View>

                        {/* RIR pill selector button */}
                        <TouchableOpacity
                          style={[
                            styles.rirPill,
                            {
                              backgroundColor: set.rir !== undefined || set.isWarmup ? rirColor + '20' : COLORS.surfaceSubtle,
                              borderColor: rirColor,
                            },
                          ]}
                          activeOpacity={0.7}
                          onPress={() => handleCycleRir(ex.id, setIdx)}
                        >
                          <Text style={[styles.rirPillText, { color: rirColor, fontWeight: set.isWarmup ? '900' : '800' }]}>
                            {rirLabel}
                          </Text>
                        </TouchableOpacity>

                        {/* Checkmark Button */}
                        <TouchableOpacity
                          style={[
                            styles.checkBtn,
                            set.completed && styles.checkBtnCompleted,
                          ]}
                          onPress={() => handleToggleSetComplete(ex.id, setIdx)}
                        >
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={set.completed ? '#111111' : COLORS.textMuted}
                          />
                        </TouchableOpacity>

                        {/* Delete Set Icon Button */}
                        <TouchableOpacity
                          style={styles.deleteSetBtn}
                          onPress={() => handleRemoveSet(ex.id, setIdx)}
                          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  const rirColor = getRirColor(set.rir, set.isWarmup);
                  const rirLabel = getRirLabel(set.rir, set.isWarmup);
                  const weightRawKey = `${ex.id}_${setIdx}_weight`;
                  const repsRawKey = `${ex.id}_${setIdx}_reps`;
                  const weightDisplay = rawInputMap[weightRawKey] !== undefined ? rawInputMap[weightRawKey] : (set.weight > 0 ? set.weight.toString() : '');
                  const repsDisplay = rawInputMap[repsRawKey] !== undefined ? rawInputMap[repsRawKey] : (set.reps > 0 ? set.reps.toString() : '');

                  return (
                    <View
                      key={set.id}
                      style={[
                        styles.tableRow,
                        set.completed && styles.tableRowCompleted,
                        set.isWarmup && styles.tableRowWarmup,
                      ]}
                    >
                      <Text style={[styles.setNumberText, set.isWarmup && styles.setNumberWarmup]}>
                        {displaySetNumber}
                      </Text>

                      {/* Weight input */}
                      <View style={styles.inputCell}>
                        <TextInput
                          style={[styles.setNumInput, set.completed && styles.inputCompleted]}
                          keyboardType="decimal-pad"
                          placeholder={
                            isBodyweight
                              ? "+0"
                              : recommendation?.setTargets?.[setIdx]
                              ? `${recommendation.setTargets[setIdx].weight}`
                              : (recommendation ? `${recommendation.recWeight}` : "0")
                          }
                          placeholderTextColor={COLORS.textMuted}
                          value={weightDisplay}
                          onChangeText={v => handleSetChange(ex.id, setIdx, 'weight', v)}
                          onBlur={() => {
                            if (rawInputMap[weightRawKey]?.endsWith('.')) {
                              const cleaned = rawInputMap[weightRawKey].slice(0, -1);
                              setRawInputMap(prev => ({ ...prev, [weightRawKey]: cleaned }));
                            }
                          }}
                        />
                      </View>

                      {/* Reps input */}
                      <View style={styles.inputCell}>
                        <TextInput
                          style={[styles.setNumInput, set.completed && styles.inputCompleted]}
                          keyboardType="number-pad"
                          placeholder={
                            recommendation?.setTargets?.[setIdx]
                              ? `${recommendation.setTargets[setIdx].reps}`
                              : recommendation
                              ? `${recommendation.recReps}`
                              : "0"
                          }
                          placeholderTextColor={COLORS.textMuted}
                          value={repsDisplay}
                          onChangeText={v => handleSetChange(ex.id, setIdx, 'reps', v)}
                        />
                      </View>

                      {/* RIR pill selector button */}
                      <TouchableOpacity
                        style={[
                          styles.rirPill,
                          {
                            backgroundColor: set.rir !== undefined || set.isWarmup ? rirColor + '20' : COLORS.surfaceSubtle,
                            borderColor: rirColor,
                          },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleCycleRir(ex.id, setIdx)}
                      >
                        <Text style={[styles.rirPillText, { color: rirColor, fontWeight: set.isWarmup ? '900' : '800' }]}>
                          {rirLabel}
                        </Text>
                      </TouchableOpacity>

                      {/* Checkmark Button */}
                      <TouchableOpacity
                        style={[
                          styles.checkBtn,
                          set.completed && styles.checkBtnCompleted,
                        ]}
                        onPress={() => handleToggleSetComplete(ex.id, setIdx)}
                      >
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={set.completed ? '#111111' : COLORS.textMuted}
                        />
                      </TouchableOpacity>

                      {/* Delete Set Icon Button */}
                      <TouchableOpacity
                        style={styles.deleteSetBtn}
                        onPress={() => handleRemoveSet(ex.id, setIdx)}
                        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  );
                })}

                <View style={styles.exCardFooter}>
                  <TouchableOpacity style={styles.addSetBtn} onPress={() => handleAddSet(ex.id)}>
                    <Ionicons name="add" size={14} color="#111111" />
                    <Text style={styles.addSetBtnText}>Set Ekle</Text>
                  </TouchableOpacity>
                </View>

                {/* RP Hypertrophy Feedback (Pump / Soreness / Joint Ache) */}
                {!isCardio && ex.sets.some(s => s.completed) && (
                  <ExerciseRPFeedback
                    feedback={ex.feedback}
                    onChangeFeedback={(fb) => handleUpdateExerciseFeedback(ex.id, fb)}
                    exerciseName={ex.exerciseName}
                  />
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.bigAddExBtn}
            onPress={() => setShowExercisePicker(true)}
          >
            <Ionicons name="add-circle" size={22} color="#111111" />
            <Text style={styles.bigAddExBtnText}>Antrenmana Egzersiz Ekle</Text>
          </TouchableOpacity>
        </ScrollView>

        <ExercisePickerModal
          visible={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          onSelectExercise={handleAddExercise}
        />

        {/* Biomechanical Exercise Swap Modal */}
        <ExerciseSwapModal
          visible={!!swappingExercise}
          sourceExercise={
            swappingExercise
              ? {
                  id: swappingExercise.exercise.exerciseId,
                  name: swappingExercise.exercise.exerciseName,
                  category: swappingExercise.exercise.category,
                  equipment: swappingExercise.exercise.equipment,
                  lastWeight: Math.max(0, ...(swappingExercise.exercise.sets || []).map(s => s.weight || 0)),
                  lastReps: swappingExercise.exercise.sets?.[0]?.reps || 10,
                  lastRir: swappingExercise.exercise.sets?.[0]?.rir ?? 1,
                }
              : null
          }
          allExercises={availableExercises && availableExercises.length > 0 ? availableExercises : []}
          onSelectSwap={handleSwapExerciseSelect}
          onClose={() => setSwappingExercise(null)}
        />

        {customAlert && (
          <CustomAlertModal
            {...customAlert}
          />
        )}

        {selectedPRExercise && (
          <ExercisePRDetailModal
            visible={!!selectedPRExercise}
            exercise={selectedPRExercise}
            workouts={pastWorkouts}
            onClose={() => setSelectedPRExercise(null)}
          />
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingTop: 0,
  },
  topDragHandleBarContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: COLORS.surface,
  },
  topDragHandleBar: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  cancelBtn: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 100,
  },
  cancelText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  sessionTitleInput: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    width: '100%',
    paddingVertical: 0,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    marginTop: 2,
  },
  timerText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  finishBtn: {
    flexShrink: 0,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  finishText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  exCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  exCardDragging: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.surfaceSubtle,
    transform: [{ scale: 1.02 }],
  },
  exCardHeader: {
    marginBottom: 12,
    gap: 8,
  },
  exTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dragGripBtn: {
    paddingRight: 4,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  exCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  activeReorderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  activeReorderBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  activeReorderBtnDisabled: {
    opacity: 0.3,
  },
  exName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  exMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  catBadge: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  recBadgePill: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  recBadgePillToggled: {
    backgroundColor: COLORS.surfaceSubtle,
    borderColor: COLORS.border,
  },
  recBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    color: '#111111',
  },
  recBadgeTextToggled: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  applyRecIconBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    borderRadius: 100,
  },
  applyRecIconBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111111',
    lineHeight: 14,
  },
  pulleyRatioBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    borderRadius: 100,
  },
  pulleyRatioText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 14,
  },
  exVolumeText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
  },
  swapExIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  swapExBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 6,
  },
  th: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 3,
    borderRadius: 12,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  tableRowCompleted: {
    backgroundColor: COLORS.primaryGlow,
  },
  tableRowWarmup: {
    backgroundColor: 'rgba(249, 115, 22, 0.06)',
  },
  setNumberText: {
    width: 22,
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  setNumberWarmup: {
    color: '#F97316',
    fontWeight: '900',
  },
  inputCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  setNumInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 100,
    width: '96%',
    height: 36,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  inputCompleted: {
    borderColor: '#111111',
    color: '#111111',
  },
  rirPill: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  rirPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  speedPill: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  speedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  deleteSetBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exCardFooter: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  addSetBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
  },
  bigAddExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 100,
    marginTop: 6,
    ...SHADOWS.soft,
  },
  bigAddExBtnText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 15,
  },
});
