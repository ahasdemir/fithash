import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  // Reset timer whenever initialSeconds prop changes or component remounts
  useEffect(() => {
    setSecondsLeft(initialSeconds);
    setIsActive(true);
    if (initialSeconds > 0) {
      onDeadlineChange?.(Date.now() + initialSeconds * 1000);
    }
  }, [initialSeconds]);

  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(prev => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      onDeadlineChange?.(null);
      if (onFinish) onFinish();
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft, onFinish, onDeadlineChange]);

  const addTime = (secs: number) => {
    const next = Math.max(0, secondsLeft + secs);
    setSecondsLeft(next);
    onDeadlineChange?.(isActive && next > 0 ? Date.now() + next * 1000 : null);
  };

  const toggleTimer = () => {
    const nextActive = !isActive;
    setIsActive(nextActive);
    onDeadlineChange?.(nextActive && secondsLeft > 0 ? Date.now() + secondsLeft * 1000 : null);
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
          <Ionicons name="timer-outline" size={18} color="#111111" />
          <Text style={styles.label}>Dinlenme Süresi:</Text>
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
