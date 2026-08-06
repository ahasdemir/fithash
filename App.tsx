import React, { useState, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from './src/theme';
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
} from './src/services/storage';
import { getAppSettings, saveAppSettings } from './src/services/settings';
import { syncWorkoutToHealthConnect } from './src/services/healthConnectService';
import {
  configureNotifications,
  scheduleSessionReminder,
  cancelSessionReminder,
} from './src/services/notifications';
import { Routine, WorkoutSession, PersonalRecord } from './src/types/fitness';

export default function App() {
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
  const [summarySession, setSummarySession] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    loadAllData();
    restoreActiveSession();
  }, []);

  const restoreActiveSession = async () => {
    configureNotifications();
    const saved = await getActiveSession();
    if (saved && !saved.completed) {
      setActiveSession(saved);
      setShowActiveModal(true);
      scheduleSessionReminder(saved.name);
    }
  };

  const loadAllData = async () => {
    const wData = await getWorkouts();
    const rData = await getRoutines();
    const prData = await getPersonalRecords();
    const appSettings = await getAppSettings();
    setWorkouts(wData);
    setRoutines(rData);
    setPrs(prData);
    if (appSettings.workoutDays) {
      setWorkoutDays(appSettings.workoutDays);
    }
  };

  const handleStartSession = (session: WorkoutSession) => {
    setActiveSession(session);
    setShowActiveModal(true);
    saveActiveSession(session);
    scheduleSessionReminder(session.name);
  };

  const handleUpdateActiveSession = (session: WorkoutSession) => {
    setActiveSession(session);
    saveActiveSession(session);
  };

  const handleFinishActiveSession = async (completedSession: WorkoutSession) => {
    setShowActiveModal(false);
    setActiveSession(null);
    await clearActiveSession();
    cancelSessionReminder();
    const updated = await saveWorkout(completedSession);
    setWorkouts(updated);
    const updatedPrs = await getPersonalRecords();
    setPrs(updatedPrs);

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
    clearActiveSession();
    cancelSessionReminder();
  };

  const handleBackgroundSession = () => {
    setShowActiveModal(false);
  };

  const handleSaveRoutine = async (routine: Routine) => {
    const updated = await saveRoutine(routine);
    setRoutines(updated);
  };

  const handleReorderRoutines = async (updatedRoutines: Routine[]) => {
    const updated = await saveRoutinesOrder(updatedRoutines);
    setRoutines(updated);
  };

  const handleDeleteRoutine = async (id: string) => {
    const updated = await deleteRoutine(id);
    setRoutines(updated);
  };

  const handleDeleteWorkout = async (id: string) => {
    const updated = await deleteWorkout(id);
    setWorkouts(updated);
    const updatedPrs = await getPersonalRecords();
    setPrs(updatedPrs);
  };

  const handleReuseWorkout = (pastSession: WorkoutSession) => {
    const newSession: WorkoutSession = {
      id: `session_${Date.now()}`,
      name: `${pastSession.name} (Tekrar)`,
      date: new Date().toISOString().split('T')[0],
      startTime: Date.now(),
      durationSeconds: 0,
      totalVolume: 0,
      totalSets: 0,
      completed: false,
      exercises: pastSession.exercises.map(ex => ({
        ...ex,
        id: `wex_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sets: ex.sets.map(s => ({
          ...s,
          id: `set_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          completed: false,
        })),
      })),
    };
    handleStartSession(newSession);
  };

  const stats = calculateUserStats(workouts, workoutDays);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['right', 'bottom', 'left']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

      {/* Top Application Header */}
      <Header
        title="FitHash"
        streakDays={stats.streakDays}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenStreak={() => setShowStreakModal(true)}
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
          <AnalyticsTab workouts={workouts} prs={prs} />
        )}

        {currentTab === 'history' && (
          <HistoryTab
            workouts={workouts}
            routines={routines}
            onDeleteWorkout={handleDeleteWorkout}
            onReuseWorkout={handleReuseWorkout}
          />
        )}

        {currentTab === 'library' && <LibraryTab />}
      </View>

      {/* Floating Capsule Bottom Navigation Bar */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.capsuleBar}>
          <TouchableOpacity
            style={[styles.navTab, currentTab === 'workout' && styles.activeNavTab]}
            onPress={() => setCurrentTab('workout')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={currentTab === 'workout' ? 'barbell' : 'barbell-outline'}
              size={20}
              color={currentTab === 'workout' ? COLORS.primary : COLORS.textMuted}
            />
            {currentTab === 'workout' && <Text style={styles.activeNavText}>Antrenman</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, currentTab === 'analytics' && styles.activeNavTab]}
            onPress={() => setCurrentTab('analytics')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={currentTab === 'analytics' ? 'stats-chart' : 'stats-chart-outline'}
              size={20}
              color={currentTab === 'analytics' ? COLORS.primary : COLORS.textMuted}
            />
            {currentTab === 'analytics' && <Text style={styles.activeNavText}>Analiz</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, currentTab === 'history' && styles.activeNavTab]}
            onPress={() => setCurrentTab('history')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={currentTab === 'history' ? 'time' : 'time-outline'}
              size={20}
              color={currentTab === 'history' ? COLORS.primary : COLORS.textMuted}
            />
            {currentTab === 'history' && <Text style={styles.activeNavText}>Geçmiş</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, currentTab === 'library' && styles.activeNavTab]}
            onPress={() => setCurrentTab('library')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={currentTab === 'library' ? 'book' : 'book-outline'}
              size={20}
              color={currentTab === 'library' ? COLORS.primary : COLORS.textMuted}
            />
            {currentTab === 'library' && <Text style={styles.activeNavText}>Kütüphane</Text>}
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
        onUpdateWorkoutDays={async (newDays) => {
          setWorkoutDays(newDays);
          await saveAppSettings({ workoutDays: newDays });
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainContent: {
    flex: 1,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    ...SHADOWS.medium,
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
  },
  activeNavTab: {
    backgroundColor: '#111111',
  },
  activeNavText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
