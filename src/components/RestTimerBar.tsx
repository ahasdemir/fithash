import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

interface RestTimerProps {
  initialSeconds?: number;
  onFinish?: () => void;
  onClose?: () => void;
  /** Reports the absolute deadline (ms) when the timer is active, or null when paused/dismissed. */
  onDeadlineChange?: (endTime: number | null) => void;
}

export const RestTimerBar: React.FC<RestTimerProps> = ({
  initialSeconds = 90,
  onFinish,
  onClose,
  onDeadlineChange,
}) => {
  const [targetEndTime, setTargetEndTime] = useState<number>(() => Date.now() + initialSeconds * 1000);
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [isActive, setIsActive] = useState<boolean>(true);

  const onDeadlineChangeRef = useRef(onDeadlineChange);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onDeadlineChangeRef.current = onDeadlineChange;
    onFinishRef.current = onFinish;
  });

  // Reset timer whenever initialSeconds prop changes or component remounts
  useEffect(() => {
    const end = Date.now() + initialSeconds * 1000;
    setTargetEndTime(end);
    setSecondsLeft(initialSeconds);
    setIsActive(true);
    onDeadlineChangeRef.current?.(end);
  }, [initialSeconds]);

  // Handle app coming to foreground from locked screen or background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && isActive) {
        const remaining = Math.ceil((targetEndTime - Date.now()) / 1000);
        if (remaining <= 0) {
          setSecondsLeft(0);
          setIsActive(false);
          onDeadlineChangeRef.current?.(null);
          Vibration.vibrate([0, 600, 200, 600, 200, 600]);
          if (onFinishRef.current) onFinishRef.current();
        } else {
          setSecondsLeft(remaining);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isActive, targetEndTime]);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      const updateTimer = () => {
        const remaining = Math.ceil((targetEndTime - Date.now()) / 1000);
        if (remaining <= 0) {
          setSecondsLeft(0);
          setIsActive(false);
          onDeadlineChangeRef.current?.(null);
          Vibration.vibrate([0, 600, 200, 600, 200, 600]);
          if (onFinishRef.current) onFinishRef.current();
        } else {
          setSecondsLeft(remaining);
        }
      };

      updateTimer();
      interval = setInterval(updateTimer, 500);
    }
    return () => clearInterval(interval);
  }, [isActive, targetEndTime]);

  const addTime = (secs: number) => {
    const newTarget = targetEndTime + secs * 1000;
    const remaining = Math.max(0, Math.ceil((newTarget - Date.now()) / 1000));
    setTargetEndTime(newTarget);
    setSecondsLeft(remaining);
    onDeadlineChange?.(isActive && remaining > 0 ? newTarget : null);
  };

  const toggleTimer = () => {
    const nextActive = !isActive;
    setIsActive(nextActive);
    if (nextActive) {
      const newTarget = Date.now() + secondsLeft * 1000;
      setTargetEndTime(newTarget);
      onDeadlineChange?.(newTarget);
    } else {
      onDeadlineChange?.(null);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const progress = initialSeconds > 0 ? Math.min(1, secondsLeft / initialSeconds) : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      <View style={styles.content}>
        <View style={styles.leftInfo}>
          <Ionicons name="timer-outline" size={16} color="#111111" />
          <Text style={styles.label} numberOfLines={1}>Dinlenme:</Text>
          <Text style={styles.timeText}>{formatTime(secondsLeft)}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnSmall} onPress={() => addTime(-15)}>
            <Text style={styles.btnSmallText}>-15s</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.btnPlay} onPress={toggleTimer}>
            <Ionicons name={isActive ? "pause" : "play"} size={14} color="#111111" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSmall} onPress={() => addTime(15)}>
            <Text style={styles.btnSmallText}>+15s</Text>
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity style={styles.btnClose} onPress={onClose}>
              <Ionicons name="close" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBar: {
    height: 3,
    backgroundColor: COLORS.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 15,
    color: '#111111',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnSmall: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnSmallText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  btnPlay: {
    backgroundColor: COLORS.primary,
    padding: 6,
    borderRadius: 100,
  },
  btnClose: {
    padding: 4,
    marginLeft: 2,
  },
});
