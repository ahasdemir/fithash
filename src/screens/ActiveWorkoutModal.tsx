import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  PanResponder,
  Animated,
  AppState,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, useTheme, subscribeTheme } from '../theme';
import { WorkoutSession, WorkoutExercise, ExerciseSet, Exercise, SessionFeedback } from '../types/fitness';
import { isIsometricExerciseName } from '../utils/exerciseHelpers';
import { RestTimerBar } from '../components/RestTimerBar';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { CustomAlertModal, CustomAlertOptions } from '../components/CustomAlertModal';
import { ExercisePRDetailModal } from '../components/ExercisePRDetailModal';
import { ExerciseSwapModal } from '../components/ExerciseSwapModal';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { DraggableList, DragGripHandle } from '../components/DraggableList';
import { getExercises, getWorkouts, getActiveRestTimerEnd, saveActiveRestTimerEnd } from '../services/storage';
import { scheduleRestTimerNotification, cancelRestTimerNotification } from '../services/notifications';
import { syncRestTimerToWearable, WearRestTimerUpdate } from '../services/wearSyncService';
import {
  calculateSmartAutoregulatedOverload,
  SmartOverloadRecommendation,
  getBiomechanicalProfile,
  calculateDynamicRestSeconds,
  predictFatigueDecayReps,
  suggestBackOffWeightDrop,
  getHypertrophyRepBracket,
  buildSetTargetPlan,
} from '../services/progressionEngine';
import { getAppSettings } from '../services/settings';


interface ActiveWorkoutModalProps {
  visible: boolean;
  activeSession: WorkoutSession | null;
  onUpdateSession: (session: WorkoutSession) => void;
  onFinishSession: (session: WorkoutSession) => void;
  onCancelSession: () => void;
  onBackgroundSession?: () => void;
  /**
   * Wear OS saatinden aynalanan son dinlenme zamanlayıcısı güncellemesi.
   * Her yeni revizyonda bir kez uygulanır; `endTimeMs === null` temizleme demektir.
   */
  remoteRestTimer?: WearRestTimerUpdate | null;
}

const formatTimer = (totalSecs: number) => {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
};

const SessionElapsedTimer: React.FC<{ startTime: number; active: boolean }> = React.memo(
  ({ startTime, active }) => {
    useTheme();
    const [elapsedSeconds, setElapsedSeconds] = useState(() =>
      Math.max(0, Math.floor((Date.now() - startTime) / 1000))
    );

    useEffect(() => {
      if (!active) return;
      const updateElapsed = () => {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
      };
      updateElapsed();
      const timer = setInterval(updateElapsed, 1000);
      const sub = AppState.addEventListener('change', nextState => {
        if (nextState === 'active') updateElapsed();
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [active, startTime]);

    return (
      <View style={styles.timerBadge}>
        <Ionicons name="time" size={12} color={COLORS.primaryText} />
        <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
      </View>
    );
  }
);

export const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({
  visible,
  activeSession,
  onUpdateSession,
  onFinishSession,
  onCancelSession,
  onBackgroundSession,
  remoteRestTimer,
}) => {
  useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;

  const [session, setSession] = useState<WorkoutSession | null>(activeSession);
  const sessionRef = useRef<WorkoutSession | null>(activeSession);
  sessionRef.current = session;

  const [pastWorkouts, setPastWorkouts] = useState<WorkoutSession[]>([]);
  const [completionDurationSeconds, setCompletionDurationSeconds] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(90);
  const [restTimerKey, setRestTimerKey] = useState(Date.now());
  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [toggledRecs, setToggledRecs] = useState<Record<string, boolean>>({});
  const [rawInputMap, setRawInputMap] = useState<Record<string, string>>({});
  const [selectedPRExercise, setSelectedPRExercise] = useState<Exercise | null>(null);
  const [swappingExercise, setSwappingExercise] = useState<{ exercise: WorkoutExercise; index: number } | null>(null);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [isDraggingExercise, setIsDraggingExercise] = useState(false);
  const lastRecTapTimeRef = useRef<Record<string, number>>({});
  const skipNextRestSyncRef = useRef(false);

  const [userSettings, setUserSettings] = useState<{
    defaultRestSeconds: number;
    autoStartRestTimer: boolean;
    defaultRir: number;
  }>({
    defaultRestSeconds: 90,
    autoStartRestTimer: true,
    defaultRir: 1,
  });

  const restoredTimerRef = useRef(false);

  useEffect(() => {
    setSession(activeSession);
  }, [activeSession]);

  useEffect(() => {
    setRawInputMap({});
  }, [activeSession?.id]);

  useEffect(() => {
    if (visible) {
      restoredTimerRef.current = false;
      getWorkouts().then(data => setPastWorkouts(data));
      getExercises().then(data => setAvailableExercises(data));
      getAppSettings().then(s => {
        setUserSettings({
          defaultRestSeconds: s.defaultRestSeconds ?? 90,
          autoStartRestTimer: s.autoStartRestTimer ?? true,
          defaultRir: s.defaultRir ?? 1,
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

  // Wear OS saatinden gelen dinlenme zamanlayıcısı güncellemesini uygula
  // (WEAR_SYNC_PROTOCOL.md §7.3). Telefon bu olayı saate geri yansıtmaz.
  useEffect(() => {
    if (!remoteRestTimer) return;
    const { endTimeMs } = remoteRestTimer;
    if (endTimeMs === null || endTimeMs <= Date.now()) {
      // Saat zamanlayıcıyı iptal etti/süresi doldu.
      saveActiveRestTimerEnd(null);
      cancelRestTimerNotification();
      setShowRestTimer(false);
      return;
    }
    const remaining = Math.max(1, Math.ceil((endTimeMs - Date.now()) / 1000));
    skipNextRestSyncRef.current = true;
    saveActiveRestTimerEnd(endTimeMs);
    scheduleRestTimerNotification(endTimeMs);
    setRestTimerSeconds(remaining);
    setRestTimerKey(Date.now());
    setShowRestTimer(true);
  }, [remoteRestTimer]);

  // Handle app coming to foreground from locked screen
  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const endTime = await getActiveRestTimerEnd();
        if (endTime !== null) {
          if (endTime > Date.now()) {
            const remaining = Math.max(1, Math.ceil((endTime - Date.now()) / 1000));
            skipNextRestSyncRef.current = true;
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
  }, [visible]);

  const restoreRestTimer = async () => {
    const endTime = await getActiveRestTimerEnd();
    if (endTime === null) return;

    if (endTime > Date.now()) {
      const remaining = Math.max(1, Math.ceil((endTime - Date.now()) / 1000));
      skipNextRestSyncRef.current = true;
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
    if (skipNextRestSyncRef.current) {
      skipNextRestSyncRef.current = false;
      return;
    }
    saveActiveRestTimerEnd(endTime);
    if (endTime !== null) {
      scheduleRestTimerNotification(endTime);
      // Set başlatma, +/-15 sn veya devam ettirme: kalan süreyi saate aynala.
      const remainingSecs = Math.max(1, Math.ceil((endTime - Date.now()) / 1000));
      syncRestTimerToWearable(endTime, Math.max(restTimerSeconds, remainingSecs));
    } else {
      cancelRestTimerNotification();
      // Duraklatma/süre dolma: saat tarafında cleared olarak yorumlanır.
      syncRestTimerToWearable(null, 0);
    }
  }, [restTimerSeconds]);

  const translateY = useRef(new Animated.Value(0)).current;

  const handleBackground = useCallback(() => {
    setShowRestTimer(false);
    onBackgroundSession?.();
    translateY.setValue(0);
  }, [onBackgroundSession, translateY]);

  const handleMinimize = useCallback(() => {
    Animated.timing(translateY, {
      toValue: windowHeightRef.current,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      handleBackground();
    });
  }, [handleBackground, translateY]);

  const handleMinimizeRef = useRef(handleMinimize);
  handleMinimizeRef.current = handleMinimize;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 4;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.35) {
          handleMinimizeRef.current();
        } else if (Math.abs(gestureState.dy) < 6 && Math.abs(gestureState.dx) < 6) {
          handleMinimizeRef.current();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      },
    })
  ).current;

  const handleReorderExercises = useCallback((nextExercises: WorkoutExercise[]) => {
    const current = sessionRef.current;
    if (!current) return;
    const updated = { ...current, exercises: nextExercises };
    setSession(updated);
    onUpdateSession(updated);
  }, [onUpdateSession]);

  // Progressive Overload weight recommendation engine (Gold-Standard Double Progression & RP Model)
  const calculateRecommendation = useCallback((
    exName: string,
    exId: string,
    equipment: string = '',
    category: string = ''
  ): SmartOverloadRecommendation | null => {
    const currentId = sessionRef.current?.id;
    const pastSessions: ExerciseSet[][] = [];
    for (const past of pastWorkouts) {
      if (past.id === currentId) continue;

      const match = past.exercises.find(e => e.exerciseId === exId || e.exerciseName.toLowerCase() === exName.toLowerCase());
      if (match) {
        const validSets = match.sets.filter(s => s.completed && !s.isWarmup && s.weight > 0);
        if (validSets.length > 0) {
          pastSessions.push(validSets);
          if (pastSessions.length >= 3) break;
        }
      }
    }

    if (pastSessions.length > 0) {
      return calculateSmartAutoregulatedOverload(exName, equipment, pastSessions, undefined, category);
    }
    return null;
  }, [pastWorkouts]);

  const exerciseSignature = useMemo(
    () => (session ? session.exercises.map(e => `${e.id}:${e.exerciseId}:${e.exerciseName}:${e.equipment || ''}:${e.category}`).join('|') : ''),
    [session]
  );

  const recommendationsByExId = useMemo(() => {
    const map: Record<string, SmartOverloadRecommendation | null> = {};
    if (!session) return map;
    for (const ex of session.exercises) {
      map[ex.id] = ex.category === 'Kardiyo'
        ? null
        : calculateRecommendation(ex.exerciseName, ex.exerciseId, ex.equipment, ex.category);
    }
    return map;
  }, [exerciseSignature, calculateRecommendation]);

  if (!session) return null;

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
        const warmups = ex.sets.filter(s => s.isWarmup);
        const working = ex.sets.filter(s => !s.isWarmup).slice(0, rec.setTargets.length);
        setsToApply = [...warmups, ...working];
      }

      const plan = buildSetTargetPlan(setsToApply, rec);
      const copySets = setsToApply.map(s => {
        const planned = plan[s.id];
        return {
          ...s,
          weight: planned ? planned.weight : s.weight,
          reps: planned ? planned.reps : s.reps,
          rir: s.isWarmup ? s.rir : planned?.rir ?? s.rir ?? userSettings.defaultRir,
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
    const isIso = isIsometricExerciseName(ex.name);

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
          rir: isCardio ? undefined : userSettings.defaultRir,
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

  const handleSetChange = (exId: string, setIdx: number, field: keyof ExerciseSet, val: any) => {
    const targetEx = session.exercises.find(e => e.id === exId);
    const targetSet = targetEx?.sets[setIdx];
    if (!targetSet) return;

    let cleanString = typeof val === 'string' ? val : (val != null ? String(val) : '');
    const isDecimalField = field === 'weight' || field === 'distanceKm';
    const rawKey = `${exId}_${targetSet.id}_${field}`;

    if (isDecimalField && typeof val === 'string') {
      // Normalize Samsung keyboard comma (,) to dot (.) and sanitize
      cleanString = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
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
        updatedSet.avgSpeedKmh = mins > 0 && dist > 0
          ? parseFloat(((dist / mins) * 60).toFixed(1))
          : undefined;
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
    let backOffUpdatedSetId: string | null = null;

    const updatedExercises = session.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      const copySets = [...ex.sets];
      const currentState = copySets[setIdx].completed;
      isNowCompleted = !currentState;
      copySets[setIdx] = {
        ...copySets[setIdx],
        completed: isNowCompleted,
      };

      // Autoregulation: If a resistance working set was completed and there is a subsequent working set,
      // evaluate intra-workout neuromuscular fatigue decay and suggest back-off weight drop if needed.
      if (
        isNowCompleted &&
        setIdx < copySets.length - 1 &&
        ex.category !== 'Kardiyo' &&
        !isIsometricExerciseName(ex.exerciseName)
      ) {
        const finishedSet = copySets[setIdx];
        const nextSet = copySets[setIdx + 1];
        if (!finishedSet.isWarmup && finishedSet.weight > 0 && !nextSet.completed && !nextSet.isWarmup) {
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
            backOffUpdatedSetId = nextSet.id;
          }
        }
      }

      completedExercise = ex;
      completedSet = copySets[setIdx];
      return { ...ex, sets: copySets };
    });

    if (backOffUpdatedSetId) {
      const prefix = `${exId}_${backOffUpdatedSetId}_`;
      setRawInputMap(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.startsWith(prefix)) delete next[k];
        });
        return next;
      });
    }

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

      // RestTimerBar mounts with the new key and invokes handleRestDeadlineChange once,
      // which persists the deadline, schedules the notification, and syncs to Wear OS.
      skipNextRestSyncRef.current = false;
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
      const isIsometric = isIsometricExerciseName(ex.exerciseName);

      const newSet: ExerciseSet = {
        id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        setNumber: 1, // aşağıda reindexedSets ile belirlenecek
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : (isIsometric ? 0 : 10),
        isWarmup: false,
        rir: isCardio ? undefined : (lastSet && !lastSet.isWarmup && lastSet.rir !== undefined ? lastSet.rir : userSettings.defaultRir),
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
    const targetEx = session.exercises.find(e => e.id === exId);
    const removedSet = targetEx?.sets[setIdx];

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

    if (removedSet && targetEx && targetEx.sets.length > 1) {
      const prefix = `${exId}_${removedSet.id}_`;
      setRawInputMap(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.startsWith(prefix)) delete next[k];
        });
        return next;
      });
    }

    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleSwapExerciseSelect = (newEx: Exercise, recommendedWeight: number) => {
    if (!swappingExercise) return;
    const { exercise: oldEx } = swappingExercise;

    setRawInputMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k.startsWith(`${oldEx.id}_`)) delete next[k];
      });
      return next;
    });

    const isCardio = newEx.category === 'Kardiyo';
    const isIso = isIsometricExerciseName(newEx.name);

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

  const handleRemoveExercise = (exId: string) => {
    const updatedExercises = session.exercises.filter(ex => ex.id !== exId);
    const updated = { ...session, exercises: updatedExercises };
    setSession(updated);
    onUpdateSession(updated);
  };

  const handleFinish = () => {
    if (!session) return;
    const completedSetsCount = session.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter(s => s.completed).length,
      0
    );

    if (completedSetsCount === 0) {
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

    // Open post-workout review modal
    setCompletionDurationSeconds(Math.max(0, Math.floor((Date.now() - (session.startTime || Date.now())) / 1000)));
    setShowCompletionModal(true);
  };

  const handleConfirmCompletion = (feedback?: SessionFeedback) => {
    if (!session) return;
    setShowCompletionModal(false);

    let totalVolume = 0;
    let totalSetsCount = 0;
    let rirSum = 0;
    let rirCount = 0;
    let totalCaloriesBurned = 0;
    let totalCardioDistance = 0;
    let totalCardioMins = 0;

    session.exercises.forEach(ex => {
      const isCardio = ex.category === 'Kardiyo';
      const isIso = isIsometricExerciseName(ex.exerciseName);

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

            const kcal = Math.round(met * 75 * (mins / 60));
            totalCaloriesBurned += kcal;
          }
        }
      });
    });

    // Optionally attach joint comfort and effort rating to exercises for backwards compatibility
    const updatedExercises: WorkoutExercise[] = session.exercises.map(ex => {
      if (!feedback) return ex;
      return {
        ...ex,
        feedback: {
          ...ex.feedback,
          sorenessRating: feedback.effortRating,
          jointAcheRating: feedback.jointComfort,
        },
      };
    });

    const now = Date.now();
    const finalSession: WorkoutSession = {
      ...session,
      exercises: updatedExercises,
      endTime: now,
      durationSeconds: Math.max(0, Math.floor((now - (session.startTime || now)) / 1000)),
      totalVolume,
      totalSets: totalSetsCount,
      avgRir: rirCount > 0 ? Math.round((rirSum / rirCount) * 10) / 10 : undefined,
      totalCaloriesBurned,
      totalCardioDistanceKm: Math.round(totalCardioDistance * 10) / 10,
      totalCardioMinutes: totalCardioMins,
      completed: true,
      sessionFeedback: feedback,
    };

    onFinishSession(finalSession);
    saveActiveRestTimerEnd(null);
    cancelRestTimerNotification();
    // Antrenman bitince saatin dinlenme zamanlayıcısı da temizlenir.
    syncRestTimerToWearable(null, 0);
  };

  const getRirColor = (rir?: number, isWarmup?: boolean) => {
    if (isWarmup) return COLORS.pastel.amber; // Warmup pastel
    if (rir === 0) return COLORS.pastel.rose; // Failure pastel
    if (rir === 1) return COLORS.pastel.amber; // High effort pastel
    if (rir === 2) return COLORS.pastel.green; // Sweet spot pastel
    if (rir === 3) return COLORS.pastel.blue; // Controlled pastel
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
        syncRestTimerToWearable(null, 0);
        onCancelSession();
      },
      onCancel: () => setCustomAlert(null),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onBackgroundSession ? handleMinimize : handleCancelSession}
    >
      <Animated.View style={[styles.container, { paddingTop: Math.max(10, insets.top), transform: [{ translateY }] }]}>
        {/* Top Sheet Drag Handle Bar for Minimizing */}
        {onBackgroundSession && (
          <View
            {...panResponder.panHandlers}
            style={styles.topDragHandleBarContainer}
            accessibilityRole="button"
            accessibilityLabel="Antrenmanı küçült"
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
            <SessionElapsedTimer
              startTime={session.startTime}
              active={visible && !session.completed}
            />
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
              onClose={() => setShowRestTimer(false)}
              onDeadlineChange={handleRestDeadlineChange}
            />
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          scrollEnabled={!isDraggingExercise}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled={true}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 70 }
          ]}
        >
          <DraggableList
            items={session.exercises}
            keyExtractor={ex => ex.id}
            onReorder={handleReorderExercises}
            onDragStateChange={setIsDraggingExercise}
            gap={14}
            renderItem={({ item: ex, index: exIndex, isDragging, dragHandleProps }) => {
            const catColor = COLORS.category[ex.category] || COLORS.textPrimary;
            const isCardio = ex.category === 'Kardiyo';
            const exVolume = ex.sets.reduce((acc, s) => s.completed ? acc + (s.weight * s.reps) : acc, 0);
            const recommendation = !isCardio ? (recommendationsByExId[ex.id] ?? null) : null;
            const setPlan = !isCardio ? buildSetTargetPlan(ex.sets, recommendation) : null;

            return (
              <View style={[styles.exCard, isDragging && styles.exCardDragging]}>
                <View style={styles.exCardHeader}>
                  {/* Top Row: Drag Handle, Exercise Name & Controls */}
                  <View style={styles.exTopRow}>
                    {session.exercises.length > 1 && (
                      <DragGripHandle
                        dragHandleProps={dragHandleProps}
                        isDragging={isDragging}
                        compact
                      />
                    )}
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
                            color={isToggled ? COLORS.textPrimary : COLORS.primaryText}
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
                ) : isIsometricExerciseName(ex.exerciseName) ? (
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
                  const isIso = isIsometricExerciseName(ex.exerciseName);
                  const isBodyweight = ex.equipment === 'Vücut Ağırlığı' && !isCardio && !isIso;
                  const workingSetIndex = ex.sets.slice(0, setIdx + 1).filter(s => !s.isWarmup).length;
                  const displaySetNumber = set.isWarmup ? 'W' : (workingSetIndex || set.setNumber);

                  if (isCardio) {
                    const mins = set.durationMinutes || 0;
                    const dist = set.distanceKm || 0;
                    const speed = mins > 0 && dist > 0 ? ((dist / mins) * 60).toFixed(1) : '-';
                    const durRawKey = `${ex.id}_${set.id}_durationMinutes`;
                    const distRawKey = `${ex.id}_${set.id}_distanceKm`;
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
                          <Ionicons name="checkmark" size={14} color={set.completed ? COLORS.primaryText : COLORS.textMuted} />
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
                    const durRawKey = `${ex.id}_${set.id}_durationSeconds`;
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
                            color={set.completed ? COLORS.primaryText : COLORS.textMuted}
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
                  const weightRawKey = `${ex.id}_${set.id}_weight`;
                  const repsRawKey = `${ex.id}_${set.id}_reps`;
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
                              : setPlan?.[set.id]
                              ? `${setPlan[set.id].weight}`
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
                            setPlan?.[set.id]
                              ? `${setPlan[set.id].reps}`
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
                          color={set.completed ? COLORS.primaryText : COLORS.textMuted}
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
                    <Ionicons name="add" size={14} color={COLORS.primaryText} />
                    <Text style={styles.addSetBtnText}>Set Ekle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          />

          <TouchableOpacity
            style={styles.bigAddExBtn}
            onPress={() => setShowExercisePicker(true)}
          >
            <Ionicons name="add-circle" size={22} color={COLORS.primaryText} />
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

        {/* Post-Workout Review & Completion Modal */}
        <WorkoutCompletionModal
          visible={showCompletionModal}
          workoutTitle={session?.name}
          muscleGroups={
            session
              ? Array.from(new Set(session.exercises.map(ex => ex.category)))
              : []
          }
          totalSets={
            session
              ? session.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0)
              : 0
          }
          totalVolume={
            session
              ? session.exercises.reduce(
                  (acc, ex) =>
                    ex.category === 'Kardiyo'
                      ? acc
                      : acc + ex.sets.filter(s => s.completed).reduce((sAcc, s) => sAcc + (s.weight > 0 ? s.weight * s.reps : 0), 0),
                  0
                )
              : 0
          }
          durationSeconds={completionDurationSeconds}
          onConfirm={handleConfirmCompletion}
          onClose={() => setShowCompletionModal(false)}
        />
      </Animated.View>
    </Modal>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingTop: 0,
  },
  topDragHandleBarContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    minHeight: 28,
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
    backgroundColor: COLORS.pastel.roseBg,
    borderRadius: 6,
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
    borderRadius: 6,
    marginTop: 2,
  },
  timerText: {
    color: COLORS.primaryText,
    fontWeight: '800',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  finishBtn: {
    flexShrink: 0,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  finishText: {
    color: COLORS.primaryText,
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
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exCardDragging: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceElevated,
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
  exCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
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
    borderRadius: 6,
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
    borderRadius: 6,
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
    color: COLORS.primaryText,
  },
  recBadgeTextToggled: {
    color: COLORS.textPrimary,
    fontWeight: '600',
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
    borderRadius: 6,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  tableRowCompleted: {
    backgroundColor: COLORS.primaryGlow,
  },
  tableRowWarmup: {
    backgroundColor: COLORS.pastel.amberBg,
  },
  setNumberText: {
    width: 22,
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  setNumberWarmup: {
    color: COLORS.pastel.amber,
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
    borderRadius: 6,
    width: '96%',
    height: 36,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  inputCompleted: {
    borderColor: COLORS.borderDark,
    color: COLORS.textPrimary,
  },
  rirPill: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 6,
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
    borderRadius: 6,
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
    borderRadius: 8,
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
    borderRadius: 6,
  },
  addSetBtnText: {
    color: COLORS.primaryText,
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
    borderRadius: 6,
    marginTop: 6,
  },
  bigAddExBtnText: {
    color: COLORS.primaryText,
    fontWeight: '800',
    fontSize: 15,
  },
});

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
