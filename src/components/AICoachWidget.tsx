import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession, PersonalRecord } from '../types/fitness';
import { generateLocalCoachAnalysis, CoachAnalysisResult } from '../services/progressionEngine';
import { getCachedAIAnalysis, saveCachedAIAnalysis } from '../services/storage';

interface AICoachWidgetProps {
  workouts: WorkoutSession[];
  prs: Record<string, PersonalRecord>;
}

export const AICoachWidget: React.FC<AICoachWidgetProps> = ({ workouts, prs }) => {
  const [analysis, setAnalysis] = useState<CoachAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  useEffect(() => {
    initAnalysis();
  }, [workouts, prs]);

  const initAnalysis = async () => {
    const cached = await getCachedAIAnalysis();
    if (cached) {
      setAnalysis(cached);
    } else {
      runAnalysis(false);
    }
  };

  const runAnalysis = async (isManualRefresh: boolean = true) => {
    setLoading(true);
    setJustRefreshed(false);

    const minDelay = isManualRefresh ? new Promise(resolve => setTimeout(resolve, 300)) : Promise.resolve();

    try {
      const [result] = await Promise.all([
        Promise.resolve(generateLocalCoachAnalysis(workouts, prs)),
        minDelay,
      ]);

      setAnalysis(result);
      await saveCachedAIAnalysis(result);

      if (isManualRefresh) {
        setJustRefreshed(true);
        setTimeout(() => setJustRefreshed(false), 2500);
      }
    } catch (error) {
      console.error('Error running coach analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.bentoCard}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View style={styles.aiBadgeIcon}>
            <Ionicons name="sparkles" size={16} color="#111111" />
          </View>
          <View>
            <Text style={styles.cardTitle}>FitHash Akıllı Antrenör</Text>
            <Text style={styles.cardSubtitle}>
              Bilimsel Hipertrofi & Antrenman Analizi
            </Text>
          </View>
        </View>

        {analysis && (
          <View style={styles.scorePill}>
            <Text style={styles.scorePillLabel}>Puan:</Text>
            <Text style={styles.scorePillVal}>{analysis.score}/100</Text>
          </View>
        )}
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#111111" />
          <Text style={styles.loadingText}>Antrenman verileriniz yenileniyor...</Text>
        </View>
      ) : analysis ? (
        <View style={styles.analysisContent}>
          {/* Timestamp Badge */}
          {analysis.timestamp && (
            <View style={styles.timestampRow}>
              <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.timestampText}>Son Güncelleme: {analysis.timestamp}</Text>
            </View>
          )}

          {/* Summary */}
          <Text style={styles.summaryText}>{analysis.summary}</Text>

          {/* Overload Tip Box */}
          <View style={styles.tipBox}>
            <View style={styles.tipTitleRow}>
              <Ionicons name="trending-up" size={14} color="#111111" />
              <Text style={styles.tipTitle}>Progressive Overload İpucu</Text>
            </View>
            <Text style={styles.tipBody}>{analysis.overloadTip}</Text>
          </View>

          {/* Recommendations List */}
          <View style={styles.recsBox}>
            <Text style={styles.recsTitle}>Tavsiyeler:</Text>
            {analysis.recommendations.map((rec, idx) => (
              <View key={idx} style={styles.recRow}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>

          {/* Refresh Button */}
          <TouchableOpacity
            style={[styles.refreshBtn, justRefreshed && styles.refreshBtnSuccess]}
            onPress={() => runAnalysis(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={justRefreshed ? "checkmark-circle" : "refresh"}
              size={14}
              color="#111111"
            />
            <Text style={styles.refreshBtnText}>
              {justRefreshed ? 'Analiz Güncellendi! ✨' : 'Analizi Yenile'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  scorePillLabel: {
    fontSize: 11,
    color: '#111111',
    fontWeight: '600',
  },
  scorePillVal: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '800',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  analysisContent: {
    gap: 12,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestampText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  liveErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 10,
  },
  liveErrorText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 17,
  },
  tipBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  tipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tipBody: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  recsBox: {
    gap: 6,
  },
  recsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  recText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  refreshBtnSuccess: {
    backgroundColor: COLORS.primaryGlow,
    borderColor: COLORS.primary,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
