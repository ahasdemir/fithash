import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession } from '../types/fitness';

interface WorkoutSummaryModalProps {
  visible: boolean;
  session: WorkoutSession | null;
  onClose: () => void;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  visible,
  session,
  onClose,
}) => {
  if (!session) return null;

  const durationMins = Math.max(1, Math.round((session.durationSeconds || 60) / 60));
  const calories = session.totalCaloriesBurned || 0;
  const volume = session.totalVolume || 0;
  const sets = session.totalSets || 0;
  const avgRir = session.avgRir !== undefined ? session.avgRir : '-';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalCard}>
            {/* Header Badge */}
            <View style={styles.badgeWrapper}>
              <View style={styles.badgeIconCircle}>
                <Ionicons name="trophy" size={28} color="#111111" />
              </View>
              <Text style={styles.congratsText}>TEBRİKLER!</Text>
              <Text style={styles.sessionTitle}>{session.name || 'Antrenman'}</Text>
              <Text style={styles.subTitle}>Antrenman başarıyla kaydedildi ve senkronize edildi.</Text>
            </View>

            {/* Stats Bento Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                <Text style={styles.statVal}>{durationMins} dk</Text>
                <Text style={styles.statLabel}>Süre</Text>
              </View>

              <View style={styles.statBox}>
                <Ionicons name="flame-outline" size={18} color="#EF4444" />
                <Text style={styles.statVal}>~{calories}</Text>
                <Text style={styles.statLabel}>Yakılan kcal</Text>
              </View>

              <View style={styles.statBox}>
                <Ionicons name="barbell-outline" size={18} color="#3B82F6" />
                <Text style={styles.statVal}>{volume.toLocaleString('tr-TR')} kg</Text>
                <Text style={styles.statLabel}>Hacim</Text>
              </View>

              <View style={styles.statBox}>
                <Ionicons name="checkmark-done-circle-outline" size={18} color="#10B981" />
                <Text style={styles.statVal}>{sets} Set</Text>
                <Text style={styles.statLabel}>Tamamlanan</Text>
              </View>
            </View>

            {/* RIR Info Banner if available */}
            {session.avgRir !== undefined && (
              <View style={styles.rirBanner}>
                <Ionicons name="speedometer-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.rirBannerText}>Ortalama RIR (Tükeniş Mesafesi): <Text style={styles.rirVal}>{avgRir}</Text></Text>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity style={styles.actionBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.actionBtnText}>Harika! Ana Sayfaya Dön</Text>
              <Ionicons name="arrow-forward" size={18} color="#111111" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  safeArea: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 20,
    ...SHADOWS.soft,
  },
  badgeWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  badgeIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  congratsText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  sessionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-start',
    gap: 4,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  rirBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
  },
  rirBannerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  rirVal: {
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    paddingVertical: 16,
    width: '100%',
    marginTop: 6,
  },
  actionBtnText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '800',
  },
});
