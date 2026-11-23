import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors, ThemeMode, ThemeProvider, setThemeMode, useTheme } from './src/theme';
import { Header } from './src/components/Header';
import { WorkoutTab } from './src/screens/WorkoutTab';
import { AnalyticsTab } from './src/screens/AnalyticsTab';
import { HistoryTab } from './src/screens/HistoryTab';
import { LibraryTab } from './src/screens/LibraryTab';
import { ActiveWorkoutModal } from './src/screens/ActiveWorkoutModal';
import { SettingsModal } from './src/screens/SettingsModal';
import { WorkoutSummaryModal } from './src/components/WorkoutSummaryModal';
import { StreakModal } from './src/components/StreakModal';
import {
  getWorkouts,
  saveWorkout,
  deleteWorkout,
  getRoutines,
  saveRoutine,
  saveRoutinesOrder,
  deleteRoutine,
  getPersonalRecords,
  calculateUserStats,
  getActiveSession,
  saveActiveSession,
  clearActiveSession,
  saveActiveRestTimerEnd,
  getLocalDateString,
  getMondayOfWeek,
} from './src/services/storage';
import { getAppSettings, saveAppSettings } from './src/services/settings';
import { syncWorkoutToHealthConnect } from './src/services/healthConnectService';
import {
  configureNotifications,
  scheduleSessionReminder,
  cancelSessionReminder,
  scheduleRestTimerNotification,
  cancelRestTimerNotification,
  triggerPRNotification,
  triggerStreakMilestoneNotification,
} from './src/services/notifications';
import {
  syncRoutinesToWearable,
  syncWorkoutsHistoryToWearable,
  syncActiveSessionToWearable,
  getPendingWearActiveSession,
  getPendingWearRestTimer,
  initWearSyncListener,
  WearRestTimerUpdate,
} from './src/services/wearSyncService';
import { Routine, WorkoutSession, PersonalRecord } from './src/types/fitness';
import { updateStreakWidget } from './src/services/widgetService';

function AppContent() {
  const { mode, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentTab, setCurrentTab] = useState<'workout' | 'analytics' | 'history' | 'library'>('workout');
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [prs, setPrs] = useState<Record<string, PersonalRecord>>({});
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [showActiveModal, setShowActiveModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [workoutDays, setWorkoutDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [weeklyTargetHistory, setWeeklyTargetHistory] = useState<Record<string, number>>({});
  const [summarySession, setSummarySession] = useState<WorkoutSession | null>(null);
  // Saatten aynalanan son dinlenme zamanlayıcısı güncellemesi (her olay yeni nesne).
  const [remoteRestTimer, setRemoteRestTimer] = useState<WearRestTimerUpdate | null>(null);
  const hasLoadedRef = useRef(false);
  const activeSessionRef = useRef<WorkoutSession | null>(null);
  activeSessionRef.current = activeSession;

  useEffect(() => {
    configureNotifications();
    loadAllData();
    restoreActiveSession().then(() => {
      reconcileWearPendingState();
    });

    const unsubscribeWear = initWearSyncListener(
      () => {
        loadAllData();
      },
      async () => {
        const rData = await getRoutines();
        const appSettings = await getAppSettings();
        syncRoutinesToWearable(rData, appSettings);
        const wData = await getWorkouts();
        syncWorkoutsHistoryToWearable(wData);
        const savedSession = await getActiveSession();
        if (savedSession && !savedSession.completed) {
          syncActiveSessionToWearable(savedSession);
        }
      },
      {
        onActiveSessionUpdated: session => {
          if (!session) {
            // Saat seansı bitirdi veya vazgeçti; telefondaki aynayı ve dinlenme sayacını temizle.
            setActiveSession(null);
            setShowActiveModal(false);
            clearActiveSession();
            cancelSessionReminder();
            saveActiveRestTimerEnd(null);
            cancelRestTimerNotification();
            return;
          }
          const isNewSession = !activeSessionRef.current || activeSessionRef.current.id !== session.id;
          setActiveSession(session);
          saveActiveSession(session);
          if (isNewSession) {
            setShowActiveModal(true);
            scheduleSessionReminder(session.name);
          }
        },
        onRestTimerUpdated: (endTimeMs, totalSeconds, revision) => {
          setRemoteRestTimer({ endTimeMs, totalSeconds, revision });
        },
      }
    );

    return () => {
      unsubscribeWear();
    };
  }, []);

  const stats = useMemo(
    () => calculateUserStats(workouts, workoutDays, weeklyTargetHistory),
    [workouts, workoutDays, weeklyTargetHistory]
  );

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const todayStr = getLocalDateString();
    const todayCompleted = workouts.some(w => w.date === todayStr && w.completed !== false);
    updateStreakWidget(stats.streakDays, todayCompleted);
  }, [workouts, stats.streakDays]);

  const restoreActiveSession = async () => {
    const saved = await getActiveSession();
    if (saved && !saved.completed) {
      setActiveSession(saved);
      setShowActiveModal(true);
      scheduleSessionReminder(saved.name);
    }
  };

  /**
   * Saat, telefon JS kapalıyken aktif seansı veya dinlenme zamanlayıcısını
   * güncellemiş olabilir. Uygulama açılışında native ayna önbelleğini okuyup
   * yerel durumla uzlaştırır (WEAR_SYNC_PROTOCOL.md §5.1: getPending*State).
   */
  const reconcileWearPendingState = async () => {
    try {
      const pendingSession = await getPendingWearActiveSession();
      if (pendingSession && pendingSession.revision > 0) {
        if (pendingSession.session) {
          setActiveSession(pendingSession.session);
          setShowActiveModal(true);
          await saveActiveSession(pendingSession.session);
          scheduleSessionReminder(pendingSession.session.name);
        } else {
          // Saat antrenmanı telefon kapalıyken bitirdi/vazgeçti; bayat yerel seansı temizle.
          setActiveSession(null);
          setShowActiveModal(false);
          await clearActiveSession();
          cancelSessionReminder();
        }
      }
    } catch (e) {
      console.warn('Wear OS aktif seans uzlaştırma hatası:', e);
    }

    try {
      const pendingRest = await getPendingWearRestTimer();
      if (pendingRest && pendingRest.revision > 0) {
        setRemoteRestTimer({
          endTimeMs: pendingRest.endTimeMs,
          totalSeconds: pendingRest.endTimeMs !== null ? Math.max(1, Math.ceil((pendingRest.endTimeMs - Date.now()) / 1000)) : 0,
          revision: pendingRest.revision,
        });
        if (pendingRest.endTimeMs !== null) {
          await saveActiveRestTimerEnd(pendingRest.endTimeMs);
          scheduleRestTimerNotification(pendingRest.endTimeMs);
        } else {
          await saveActiveRestTimerEnd(null);
          cancelRestTimerNotification();
        }
      }
    } catch (e) {
      console.warn('Wear OS dinlenme zamanlayıcısı uzlaştırma hatası:', e);
    }
  };

  const loadAllData = async () => {
    const [wData, rData, prData, appSettings] = await Promise.all([
      getWorkouts(),
      getRoutines(),
      getPersonalRecords(),
      getAppSettings(),
    ]);
    hasLoadedRef.current = true;
    const resolvedTheme: ThemeMode = appSettings.themeMode === 'light' ? 'light' : 'dark';
    setThemeMode(resolvedTheme);

    setWorkouts(wData);
    setRoutines(rData);
    setPrs(prData);
    syncRoutinesToWearable(rData, appSettings);
    syncWorkoutsHistoryToWearable(wData);
    if (appSettings.workoutDays) {
      setWorkoutDays(appSettings.workoutDays);
    }
    if (appSettings.weeklyTargetHistory) {
      setWeeklyTargetHistory(appSettings.weeklyTargetHistory);
    }
  };

  const handleToggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
    await saveAppSettings({ themeMode: nextMode });
  }, [mode]);

  const handleStartSession = (session: WorkoutSession) => {
    setActiveSession(session);
    setShowActiveModal(true);
    saveActiveSession(session);
    scheduleSessionReminder(session.name);
    syncActiveSessionToWearable(session);
  };

  const handleUpdateActiveSession = (session: WorkoutSession) => {
    setActiveSession(session);
    saveActiveSession(session);
    syncActiveSessionToWearable(session);
  };

  const handleFinishActiveSession = async (completedSession: WorkoutSession) => {
    setShowActiveModal(false);
    setActiveSession(null);
    syncActiveSessionToWearable(null);
    await clearActiveSession();
    cancelSessionReminder();

    const previousPrs = prs;
    const updated = await saveWorkout(completedSession);
    setWorkouts(updated);
    syncWorkoutsHistoryToWearable(updated);
    const updatedPrs = await getPersonalRecords();
    setPrs(updatedPrs);

    // Bildirimler: PR Kontrolü (kardiyo 0 kg hariç, egzersiz başına tek bildirim)
    const notifiedExIds = new Set<string>();
    completedSession.exercises.forEach(ex => {
      if (ex.category === 'Kardiyo' || notifiedExIds.has(ex.exerciseId)) return;
      const prevPR = previousPrs[ex.exerciseId];
      const newPR = updatedPrs[ex.exerciseId];
      if (
        newPR &&
        newPR.maxWeight > 0 &&
        (!prevPR ||
          newPR.maxWeight > prevPR.maxWeight ||
          (newPR.maxWeight === prevPR.maxWeight && newPR.maxReps > prevPR.maxReps) ||
          (newPR.maxEstimatedOneRepMax || 0) > (prevPR.maxEstimatedOneRepMax || 0))
      ) {
        notifiedExIds.add(ex.exerciseId);
        triggerPRNotification(newPR.exerciseName, newPR.maxWeight, newPR.maxReps);
      }
    });

    // Seri Bildirimi Kontrolü (yalnızca seri arttığında)
    const newStats = calculateUserStats(updated, workoutDays, weeklyTargetHistory);
    const milestones = [3, 7, 14, 21, 30, 60, 90, 100, 365];
    if (newStats.streakDays > stats.streakDays && milestones.includes(newStats.streakDays)) {
      triggerStreakMilestoneNotification(newStats.streakDays);
    }

    // Health Connect Senkronizasyonu
    try {
      const settings = await getAppSettings();
      if (settings.healthConnectEnabled) {
        await syncWorkoutToHealthConnect(completedSession);
      }
    } catch (e) {
      console.warn('Health Connect senkronizasyon hatası:', e);
    }

    setSummarySession(completedSession);
    setShowSummaryModal(true);
  };

  const handleCancelActiveSession = () => {
    setShowActiveModal(false);
    setActiveSession(null);
    syncActiveSessionToWearable(null);
    clearActiveSession();
    cancelSessionReminder();
  };

  const handleBackgroundSession = () => {
    setShowActiveModal(false);
  };

  const handleSaveRoutine = async (routine: Routine) => {
    const updated = await saveRoutine(routine);
    setRoutines(updated);
    syncRoutinesToWearable(updated, await getAppSettings());
  };

  const handleReorderRoutines = async (updatedRoutines: Routine[]) => {
    const updated = await saveRoutinesOrder(updatedRoutines);
    setRoutines(updated);
    syncRoutinesToWearable(updated, await getAppSettings());
  };

  const handleDeleteRoutine = async (id: string) => {
    const updated = await deleteRoutine(id);
    setRoutines(updated);
    syncRoutinesToWearable(updated, await getAppSettings());
  };

  const handleDeleteWorkout = async (id: string) => {
    const updated = await deleteWorkout(id);
    setWorkouts(updated);
    syncWorkoutsHistoryToWearable(updated);
    const updatedPrs = await getPersonalRecords();
    setPrs(updatedPrs);
  };

  const handleUpdateWorkout = async (updatedWorkout: WorkoutSession) => {
    const updated = await saveWorkout(updatedWorkout);
    setWorkouts(updated);
    syncWorkoutsHistoryToWearable(updated);
    const updatedPrs = await getPersonalRecords();
    setPrs(updatedPrs);
  };

  const handleReuseWorkout = (pastSession: WorkoutSession) => {
    const newSession: WorkoutSession = {
      id: `session_${Date.now()}`,
      name: `${pastSession.name} (Tekrar)`,
      date: getLocalDateString(),
      startTime: Date.now(),
      durationSeconds: 0,
      totalVolume: 0,
      totalSets: 0,
      completed: false,
      exercises: pastSession.exercises.map(ex => ({
        ...ex,
        id: `wex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        feedback: undefined,
        notes: undefined,
        sets: ex.sets.map(s => ({
          ...s,
          id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          completed: false,
          isPR: undefined,
          caloriesBurned: undefined,
        })),
      })),
    };
    handleStartSession(newSession);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['right', 'bottom', 'left']}>
        <StatusBar
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />

        {/* Top Application Header */}
        <Header
          title="FitHash"
          streakDays={stats.streakDays}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenStreak={() => setShowStreakModal(true)}
          onToggleTheme={handleToggleTheme}
        />

        {/* Tab Screen Content */}
        <View style={styles.mainContent}>
          {currentTab === 'workout' && (
            <WorkoutTab
              routines={routines}
              activeSession={activeSession}
              onStartSession={handleStartSession}
              onOpenActiveSession={() => setShowActiveModal(true)}
              onSaveRoutine={handleSaveRoutine}
              onReorderRoutines={handleReorderRoutines}
              onDeleteRoutine={handleDeleteRoutine}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsTab
              workouts={workouts}
              prs={prs}
              workoutDays={workoutDays}
              weeklyTargetHistory={weeklyTargetHistory}
            />
          )}

          {currentTab === 'history' && (
            <HistoryTab
              workouts={workouts}
              routines={routines}
              onDeleteWorkout={handleDeleteWorkout}
              onReuseWorkout={handleReuseWorkout}
              onUpdateWorkout={handleUpdateWorkout}
            />
          )}

          {currentTab === 'library' && (
            <LibraryTab workouts={workouts} prs={prs} />
          )}
        </View>

        {/* Bottom fade: masks content scrolling beneath the floating nav */}
        <LinearGradient
          colors={[`${colors.background}00`, `${colors.background}DB`, colors.background]}
          locations={[0, 0.52, 1]}
          style={[styles.bottomFade, { pointerEvents: 'none' }]}
        />

        {/* Structured 4-Column Segmented Bottom Navigation Bar */}
        <View style={styles.bottomNavContainer}>
          <View style={styles.segmentedBar}>
            <TouchableOpacity
              style={[styles.navTab, currentTab === 'workout' && styles.activeNavTab]}
              onPress={() => setCurrentTab('workout')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={currentTab === 'workout' ? 'barbell' : 'barbell-outline'}
                size={16}
                color={currentTab === 'workout' ? colors.primaryText : colors.textSecondary}
              />
              <Text
                style={[styles.navText, currentTab === 'workout' && styles.activeNavText]}
                numberOfLines={1}
              >
                Antrenman
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, currentTab === 'analytics' && styles.activeNavTab]}
              onPress={() => setCurrentTab('analytics')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={currentTab === 'analytics' ? 'stats-chart' : 'stats-chart-outline'}
                size={16}
                color={currentTab === 'analytics' ? colors.primaryText : colors.textSecondary}
              />
              <Text
                style={[styles.navText, currentTab === 'analytics' && styles.activeNavText]}
                numberOfLines={1}
              >
                Analiz
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, currentTab === 'history' && styles.activeNavTab]}
              onPress={() => setCurrentTab('history')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={currentTab === 'history' ? 'time' : 'time-outline'}
                size={16}
                color={currentTab === 'history' ? colors.primaryText : colors.textSecondary}
              />
              <Text
                style={[styles.navText, currentTab === 'history' && styles.activeNavText]}
                numberOfLines={1}
              >
                Geçmiş
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, currentTab === 'library' && styles.activeNavTab]}
              onPress={() => setCurrentTab('library')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={currentTab === 'library' ? 'book' : 'book-outline'}
                size={16}
                color={currentTab === 'library' ? colors.primaryText : colors.textSecondary}
              />
              <Text
                style={[styles.navText, currentTab === 'library' && styles.activeNavText]}
                numberOfLines={1}
              >
                Kütüphane
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Workout Session Tracker Modal */}
        <ActiveWorkoutModal
          visible={showActiveModal}
          activeSession={activeSession}
          onUpdateSession={handleUpdateActiveSession}
          onFinishSession={handleFinishActiveSession}
          onCancelSession={handleCancelActiveSession}
          onBackgroundSession={handleBackgroundSession}
          remoteRestTimer={remoteRestTimer}
        />

        {/* Settings Modal */}
        <SettingsModal
          visible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onDataReload={loadAllData}
        />

        {/* Streak & Workout Days Modal */}
        <StreakModal
          visible={showStreakModal}
          onClose={() => setShowStreakModal(false)}
          workouts={workouts}
          workoutDays={workoutDays}
          weeklyTargetHistory={weeklyTargetHistory}
          onUpdateWorkoutDays={async (newDays) => {
            const newTarget = newDays.length;
            const currentMondayStr = getLocalDateString(getMondayOfWeek(new Date()));
            const updatedHistory = { ...(weeklyTargetHistory || {}) };

            // If history is currently empty, backfill previous weeks with oldTarget so past weeks retain their goal
            if (Object.keys(updatedHistory).length === 0) {
              const oldTarget = workoutDays.length;
              for (let w = 24; w >= 1; w--) {
                const pastMon = new Date();
                pastMon.setDate(pastMon.getDate() - w * 7);
                const pastMonStr = getLocalDateString(getMondayOfWeek(pastMon));
                updatedHistory[pastMonStr] = oldTarget;
              }
            }
            updatedHistory[currentMondayStr] = newTarget;

            setWorkoutDays(newDays);
            setWeeklyTargetHistory(updatedHistory);
            await saveAppSettings({
              workoutDays: newDays,
              weeklyTargetHistory: updatedHistory,
            });
          }}
        />

        {/* Workout Summary Celebration Modal */}
        <WorkoutSummaryModal
          visible={showSummaryModal}
          session={summarySession}
          onClose={() => setShowSummaryModal(false)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mainContent: {
      flex: 1,
    },
    bottomFade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 132,
    },
    bottomNavContainer: {
      position: 'absolute',
      bottom: 14,
      left: 16,
      right: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    navTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 38,
      paddingHorizontal: 6,
      borderRadius: 6,
    },
    activeNavTab: {
      backgroundColor: colors.primary,
    },
    navText: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 11,
      letterSpacing: -0.2,
    },
    activeNavText: {
      color: colors.primaryText,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: -0.2,
    },
  });
