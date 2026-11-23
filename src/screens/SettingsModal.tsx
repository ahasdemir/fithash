import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors, ThemeMode, setThemeMode, useTheme } from '../theme';
import {
  getAppSettings,
  saveAppSettings,
  exportFullDataJSON,
  exportWorkoutsCSV,
  importFullDataJSON,
} from '../services/settings';
import {
  requestHealthConnectPermissions,
  syncAllWorkoutsToHealthConnect,
  checkHealthConnectPermissions,
} from '../services/healthConnectService';
import { getWorkouts, getRoutines, clearCachedAIAnalysis, getLocalDateString } from '../services/storage';
import { syncRoutinesToWearable } from '../services/wearSyncService';
import { CustomAlertModal, CustomAlertOptions } from '../components/CustomAlertModal';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onDataReload: () => void;
}

const REST_TIME_OPTIONS = [30, 60, 90, 120, 180];
const RIR_OPTIONS = [0, 1, 2, 3];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onDataReload,
}) => {
  const insets = useSafeAreaInsets();
  const { mode, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(90);
  const [autoStartRestTimer, setAutoStartRestTimer] = useState(true);
  const [defaultRir, setDefaultRir] = useState(1);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [healthConnectEnabled, setHealthConnectEnabled] = useState(false);
  const [isSyncingHC, setIsSyncingHC] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Export / Import Modals State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'JSON' | 'CSV'>('JSON');
  const [exportContent, setExportContent] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const loadSettings = async () => {
    const s = await getAppSettings();
    setDefaultRestSeconds(s.defaultRestSeconds ?? 90);
    setAutoStartRestTimer(s.autoStartRestTimer ?? true);
    setDefaultRir(s.defaultRir ?? 1);
    setWeightUnit(s.weightUnit || 'kg');
    setHealthConnectEnabled(s.healthConnectEnabled ?? false);
  };

  const handleSelectThemeMode = async (nextMode: ThemeMode) => {
    setThemeMode(nextMode);
    await saveAppSettings({ themeMode: nextMode });
  };

  const handleToggleHealthConnect = async () => {
    if (!healthConnectEnabled) {
      const granted = await requestHealthConnectPermissions();
      if (granted) {
        setHealthConnectEnabled(true);
        await saveAppSettings({ healthConnectEnabled: true });
        setCustomAlert({
          visible: true,
          type: 'success',
          title: 'Başarılı',
          message: 'Health Connect entegrasyonu aktif edildi.',
          onConfirm: () => setCustomAlert(null),
        });
      } else {
        setCustomAlert({
          visible: true,
          type: 'warning',
          title: 'İzin Verilmedi',
          message: 'Health Connect entegrasyonu için gerekli izinler onaylanmadı.',
          onConfirm: () => setCustomAlert(null),
        });
      }
    } else {
      setHealthConnectEnabled(false);
      await saveAppSettings({ healthConnectEnabled: false });
    }
  };

  const handleSyncAllHealthConnect = async () => {
    const hasPerm = await checkHealthConnectPermissions();
    if (!hasPerm) {
      const granted = await requestHealthConnectPermissions();
      if (!granted) {
        setCustomAlert({
          visible: true,
          type: 'danger',
          title: 'Hata',
          message: 'Health Connect izinleri onaylanmadı.',
          onConfirm: () => setCustomAlert(null),
        });
        return;
      }
    }

    setIsSyncingHC(true);
    try {
      const workouts = await getWorkouts();
      const res = await syncAllWorkoutsToHealthConnect(workouts);
      if (res.success === 0 && res.failed > 0) {
        setCustomAlert({
          visible: true,
          type: 'danger',
          title: 'Aktarım Başarısız',
          message: `${res.failed} antrenman Health Connect'e aktarılamadı.`,
          onConfirm: () => setCustomAlert(null),
        });
      } else if (res.failed > 0) {
        setCustomAlert({
          visible: true,
          type: 'warning',
          title: 'Kısmi Senkronizasyon',
          message: `${res.success} antrenman aktarıldı, ${res.failed} antrenman aktarılamadı.`,
          onConfirm: () => setCustomAlert(null),
        });
      } else {
        setCustomAlert({
          visible: true,
          type: 'success',
          title: 'Senkronizasyon Tamamlandı',
          message: `${res.success} antrenman ve yakılan kalori kaydı Health Connect'e başarıyla aktarıldı.`,
          onConfirm: () => setCustomAlert(null),
        });
      }
    } catch (e) {
      setCustomAlert({
        visible: true,
        type: 'danger',
        title: 'Hata',
        message: 'Senkronizasyon sırasında bir hata oluştu.',
        onConfirm: () => setCustomAlert(null),
      });
    } finally {
      setIsSyncingHC(false);
    }
  };

  const handleSaveAllSettings = async () => {
    await saveAppSettings({
      themeMode: mode,
      defaultRestSeconds,
      autoStartRestTimer,
      defaultRir,
      weightUnit,
      healthConnectEnabled,
    });
    await clearCachedAIAnalysis();
    onDataReload();
    setSaveSuccess(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleExportJSON = async () => {
    const data = await exportFullDataJSON();
    setExportContent(data);
    setExportType('JSON');
    setShowExportModal(true);
  };

  const handleExportCSV = async () => {
    const data = await exportWorkoutsCSV();
    setExportContent(data);
    setExportType('CSV');
    setShowExportModal(true);
  };

  const handleCopyClipboard = async () => {
    try {
      let copied = false;
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(exportContent);
        copied = true;
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = exportContent;
        document.body.appendChild(textArea);
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      if (copied) {
        setCustomAlert({
          visible: true,
          type: 'success',
          title: 'Kopyalandı!',
          message: `${exportType} verisi panoya kopyalandı.`,
          onConfirm: () => setCustomAlert(null),
        });
      } else {
        setCustomAlert({
          visible: true,
          type: 'info',
          title: 'Bilgi',
          message: 'Metni aşağıdaki kutudan seçip kopyalayabilirsiniz.',
          onConfirm: () => setCustomAlert(null),
        });
      }
    } catch {
      setCustomAlert({
        visible: true,
        type: 'info',
        title: 'Bilgi',
        message: 'Metni aşağıdaki kutudan seçip kopyalayabilirsiniz.',
        onConfirm: () => setCustomAlert(null),
      });
    }
  };

  const handleDownloadFile = async () => {
    try {
      const mimeType = exportType === 'JSON' ? 'application/json' : 'text/csv';
      const extension = exportType === 'JSON' ? 'json' : 'csv';
      const filename = `fithash_backup_${getLocalDateString()}.${extension}`;

      if (typeof document !== 'undefined') {
        const blob = new Blob([exportContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.document, filename);
        if (!file.exists) {
          file.create();
        }
        file.write(exportContent);
        const fileUri = file.uri;

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType,
            dialogTitle: `${exportType} Yedeğini Kaydet veya Paylaş`,
            UTI: exportType === 'JSON' ? 'public.json' : 'public.comma-separated-values-text',
          });
        } else {
          setCustomAlert({
            visible: true,
            type: 'success',
            title: 'Dosya Kaydedildi',
            message: `Yedek dosyası cihaza kaydedildi:\n${fileUri}`,
            onConfirm: () => setCustomAlert(null),
          });
        }
      }
    } catch (error) {
      console.error('Download/Share error:', error);
      setCustomAlert({
        visible: true,
        type: 'danger',
        title: 'Hata',
        message: 'Yedek dosyası indirilirken bir sorun oluştu.',
        onConfirm: () => setCustomAlert(null),
      });
    }
  };

  const handlePickBackupFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileAsset = result.assets[0];
      const text = typeof document !== 'undefined'
        ? await (await fetch(fileAsset.uri)).text()
        : await new File(fileAsset.uri).text();

      if (!text || !text.trim()) {
        throw new Error('Seçilen dosya boş veya okunamadı.');
      }

      await importFullDataJSON(text.trim());
      setShowImportModal(false);
      setImportText('');
      onDataReload();
      setCustomAlert({
        visible: true,
        type: 'success',
        title: 'Başarılı!',
        message: 'Antrenman geçmişi, programlar, egzersizler ve rekorlar seçilen dosyadan başarıyla geri yüklendi.',
        onConfirm: () => setCustomAlert(null),
      });
    } catch (error) {
      setCustomAlert({
        visible: true,
        type: 'danger',
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Yedek dosyası okunurken veya geri yüklenirken bir hata oluştu.',
        onConfirm: () => setCustomAlert(null),
      });
    }
  };

  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    try {
      await importFullDataJSON(importText.trim());
      setShowImportModal(false);
      setImportText('');
      onDataReload();
      setCustomAlert({
        visible: true,
        type: 'success',
        title: 'Başarılı!',
        message: 'Antrenman geçmişi, programlar, egzersizler, rekorlar ve uygulama ayarları başarıyla geri yüklendi.',
        onConfirm: () => setCustomAlert(null),
      });
    } catch (error) {
      setCustomAlert({
        visible: true,
        type: 'danger',
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Yedek dosyası içe aktarılırken bir hata oluştu.',
        onConfirm: () => setCustomAlert(null),
      });
    }
  };

  const handleSyncWearable = async () => {
    try {
      const routines = await getRoutines();
      const settings = await getAppSettings();
      await syncRoutinesToWearable(routines, settings);
      setCustomAlert({
        visible: true,
        type: 'success',
        title: 'Akıllı Saat Eşitlemesi',
        message: `${routines.length} antrenman rutini ve ayarlarınız akıllı saatinize aktarıldı.`,
        onConfirm: () => setCustomAlert(null),
      });
    } catch (error) {
      setCustomAlert({
        visible: true,
        type: 'danger',
        title: 'Eşitleme Hatası',
        message: 'Saatle bağlantı kurulamadı. Saatinizin Bluetooth ile bağlı olduğunu kontrol edin.',
        onConfirm: () => setCustomAlert(null),
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.title}>Uygulama Ayarları</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* SECTION 0: APPEARANCE & THEME SYSTEM */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={mode === 'dark' ? 'moon-outline' : 'sunny-outline'}
                  size={16}
                  color={colors.primaryText}
                />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Görünüm & Tema Sistemi</Text>
                <Text style={styles.sectionSub}>Shadcn Koyu veya Swiss Açık arayüz modu</Text>
              </View>
            </View>

            <View style={styles.pillsRow}>
              <TouchableOpacity
                style={[styles.themeBtn, mode === 'dark' && styles.pillBtnSelected]}
                onPress={() => handleSelectThemeMode('dark')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="moon-outline"
                  size={15}
                  color={mode === 'dark' ? colors.primaryText : colors.textSecondary}
                />
                <Text style={[styles.pillBtnText, mode === 'dark' && styles.pillBtnTextSelected]}>
                  Koyu (Shadcn Zinc)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.themeBtn, mode === 'light' && styles.pillBtnSelected]}
                onPress={() => handleSelectThemeMode('light')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="sunny-outline"
                  size={15}
                  color={mode === 'light' ? colors.primaryText : colors.textSecondary}
                />
                <Text style={[styles.pillBtnText, mode === 'light' && styles.pillBtnTextSelected]}>
                  Açık (Swiss Paper)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 1: WORKOUT & TIMER PREFERENCES */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="timer-outline" size={16} color={colors.primaryText} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Antrenman & Dinlenme Ayarları</Text>
                <Text style={styles.sectionSub}>Sayaç ve set varsayılan tercihleri</Text>
              </View>
            </View>

            {/* Default Rest Duration */}
            <Text style={styles.label}>Varsayılan Dinlenme Süresi (Saniye)</Text>
            <View style={styles.pillsRow}>
              {REST_TIME_OPTIONS.map(sec => {
                const isSelected = defaultRestSeconds === sec;
                return (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.pillBtn, isSelected && styles.pillBtnSelected]}
                    onPress={() => setDefaultRestSeconds(sec)}
                  >
                    <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextSelected]}>
                      {sec} sn
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Auto Start Rest Timer */}
            <Text style={styles.label}>Set Onayında Otomatik Dinlenme Sayacı</Text>
            <View style={styles.pillsRow}>
              <TouchableOpacity
                style={[styles.pillBtn, autoStartRestTimer && styles.pillBtnSelected]}
                onPress={() => setAutoStartRestTimer(true)}
              >
                <Text style={[styles.pillBtnText, autoStartRestTimer && styles.pillBtnTextSelected]}>
                  Açık (Önerilen)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pillBtn, !autoStartRestTimer && styles.pillBtnSelected]}
                onPress={() => setAutoStartRestTimer(false)}
              >
                <Text style={[styles.pillBtnText, !autoStartRestTimer && styles.pillBtnTextSelected]}>
                  Kapalı
                </Text>
              </TouchableOpacity>
            </View>

            {/* Default RIR */}
            <Text style={styles.label}>Varsayılan Hedef RIR (Tükeniş Mesafesi)</Text>
            <View style={styles.pillsRow}>
              {RIR_OPTIONS.map(rir => {
                const isSelected = defaultRir === rir;
                return (
                  <TouchableOpacity
                    key={rir}
                    style={[styles.pillBtn, isSelected && styles.pillBtnSelected]}
                    onPress={() => setDefaultRir(rir)}
                  >
                    <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextSelected]}>
                      RIR {rir}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Weight Unit */}
            <Text style={styles.label}>Ağırlık Birimi</Text>
            <View style={styles.pillsRow}>
              <TouchableOpacity
                style={[styles.pillBtn, weightUnit === 'kg' && styles.pillBtnSelected]}
                onPress={() => setWeightUnit('kg')}
              >
                <Text style={[styles.pillBtnText, weightUnit === 'kg' && styles.pillBtnTextSelected]}>
                  Kilogram (KG)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pillBtn, weightUnit === 'lbs' && styles.pillBtnSelected]}
                onPress={() => setWeightUnit('lbs')}
              >
                <Text style={[styles.pillBtnText, weightUnit === 'lbs' && styles.pillBtnTextSelected]}>
                  Pound (LBS)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SAVE ALL SETTINGS BUTTON */}
          <TouchableOpacity
            style={[styles.saveSettingsBtn, saveSuccess && styles.saveSettingsSuccess]}
            onPress={handleSaveAllSettings}
          >
            <Ionicons
              name={saveSuccess ? 'checkmark-circle' : 'save-outline'}
              size={18}
              color={colors.primaryText}
            />
            <Text style={styles.saveSettingsBtnText}>
              {saveSuccess ? 'Ayarlar Kaydedildi!' : 'Tüm Ayarları Kaydet'}
            </Text>
          </TouchableOpacity>

          {/* SECTION: HEALTH CONNECT */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.iconCircle, { backgroundColor: colors.success }]}>
                <Ionicons name="fitness-outline" size={16} color={colors.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Health Connect Entegrasyonu</Text>
                <Text style={styles.sectionSub}>Yakılan kalori ve antrenman geçmişini senkronize et</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.modelCard,
                healthConnectEnabled && styles.modelCardSelected,
                { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
              ]}
              onPress={handleToggleHealthConnect}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons
                  name={healthConnectEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={healthConnectEnabled ? colors.primary : colors.textMuted}
                />
                <View>
                  <Text style={[styles.modelName, healthConnectEnabled && styles.modelNameSelected]}>
                    Health Connect {healthConnectEnabled ? 'Aktif' : 'Pasif'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {healthConnectEnabled ? 'Otomatik senkronize edilir' : 'Dokunarak izin verin'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="logo-android"
                size={20}
                color={healthConnectEnabled ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.importBtn, { marginTop: 12, backgroundColor: colors.success }]}
              onPress={handleSyncAllHealthConnect}
              disabled={isSyncingHC}
            >
              <Ionicons name="sync" size={16} color={colors.primaryText} />
              <Text style={styles.importBtnText}>
                {isSyncingHC ? 'Aktarılıyor...' : "Tüm Geçmişi Health Connect'e Aktar"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SECTION: WEAR OS WATCH SYNC */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="watch-outline" size={16} color={colors.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Wear OS Akıllı Saat Senkronizasyonu</Text>
                <Text style={styles.sectionSub}>Rutinlerinizi ve sayaç ayarlarınızı saatinize aktarın</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.importBtn, { marginTop: 12 }]}
              onPress={handleSyncWearable}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color={colors.primaryText} />
              <Text style={styles.importBtnText}>
                Rutinleri Saate Şimdi Eşitle
              </Text>
            </TouchableOpacity>
          </View>

          {/* SECTION 3: DATA BACKUP & EXPORT / IMPORT */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="swap-horizontal" size={16} color={colors.primaryText} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Veri Yedekleme & Aktarım</Text>
                <Text style={styles.sectionSub}>Antrenman geçmişinizi dışa aktarın veya geri yükleyin</Text>
              </View>
            </View>

            {/* Action Buttons Grid */}
            <View style={styles.exportGrid}>
              <TouchableOpacity
                style={styles.exportCardBtn}
                onPress={handleExportJSON}
              >
                <Ionicons name="document-text-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.exportCardTitle}>JSON Dışa Aktar</Text>
                <Text style={styles.exportCardSub}>Tam sistem yedeği al</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportCardBtn}
                onPress={handleExportCSV}
              >
                <Ionicons name="grid-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.exportCardTitle}>CSV Dışa Aktar</Text>
                <Text style={styles.exportCardSub}>Excel / Tablo formatı</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => setShowImportModal(true)}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={colors.primaryText} />
              <Text style={styles.importBtnText}>Yedekten Geri Yükle (JSON İçe Aktar)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* EXPORT CONTENT DISPLAY MODAL */}
        {showExportModal && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
            <View style={styles.overlay}>
              <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{exportType} Dışa Aktarılan Veri</Text>
                  <TouchableOpacity onPress={() => setShowExportModal(false)} style={styles.closeBtn}>
                    <Ionicons name="close" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.codeScroll}>
                  <TextInput
                    style={styles.codeText}
                    multiline
                    selectTextOnFocus
                    value={exportContent}
                    onChangeText={() => {}}
                  />
                </ScrollView>

                <View style={styles.modalFooterRow}>
                  <TouchableOpacity
                    style={styles.downloadFileBtn}
                    onPress={handleDownloadFile}
                  >
                    <Ionicons name="download-outline" size={16} color={colors.primaryText} />
                    <Text style={styles.downloadFileBtnText}>
                      Dosya Olarak İndir (.{exportType.toLowerCase()})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={handleCopyClipboard}
                  >
                    <Ionicons name="copy-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.copyBtnText}>Kopyala</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* IMPORT JSON PASTE MODAL */}
        {showImportModal && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
            <View style={styles.overlay}>
              <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>JSON Yedeği İçe Aktar</Text>
                  <TouchableOpacity onPress={() => setShowImportModal(false)} style={styles.closeBtn}>
                    <Ionicons name="close" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.importInstruction}>
                  Daha önce dışa aktardığınız JSON yedek metnini aşağıdaki alana yapıştırın:
                </Text>

                <View style={{ gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    style={styles.pickFileBtn}
                    onPress={handlePickBackupFile}
                  >
                    <Ionicons name="folder-open-outline" size={16} color={colors.primaryText} />
                    <Text style={styles.pickFileBtnText}>Dosyadan Seç (.json)</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>VEYA METİN YAPIŞTIR</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  </View>
                </View>

                <TextInput
                  style={styles.importInput}
                  multiline
                  placeholder='{"version": "1.0.0", "workouts": [...]}'
                  placeholderTextColor={colors.textMuted}
                  value={importText}
                  onChangeText={setImportText}
                />

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.restoreSubmitBtn}
                    onPress={handleImportSubmit}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryText} />
                    <Text style={styles.restoreSubmitText}>Verileri Geri Yükle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
        {customAlert && <CustomAlertModal {...customAlert} />}
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 60,
      gap: 14,
      flexGrow: 1,
    },
    bentoSection: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconCircle: {
      width: 34,
      height: 34,
      borderRadius: 6,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    sectionSub: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4,
    },
    pillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    themeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillBtn: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillBtnSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    pillBtnTextSelected: {
      color: colors.primaryText,
      fontWeight: '700',
    },
    modelCard: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modelCardSelected: {
      backgroundColor: colors.primaryGlow,
      borderColor: colors.borderDark,
    },
    modelName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modelNameSelected: {
      color: colors.textPrimary,
    },
    saveSettingsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 6,
      marginVertical: 2,
    },
    saveSettingsSuccess: {
      backgroundColor: colors.success,
    },
    saveSettingsBtnText: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: '800',
    },
    exportGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    exportCardBtn: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 8,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
      alignItems: 'flex-start',
    },
    exportCardTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4,
    },
    exportCardSub: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    importBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 6,
      marginTop: 4,
    },
    importBtnText: {
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: '800',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      maxHeight: '80%',
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    codeScroll: {
      maxHeight: 250,
      marginVertical: 14,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    codeText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: 'monospace',
    },
    modalFooterRow: {
      flexDirection: 'row',
      gap: 10,
      paddingTop: 8,
    },
    downloadFileBtn: {
      flex: 2,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 6,
    },
    downloadFileBtnText: {
      color: colors.primaryText,
      fontWeight: '800',
      fontSize: 13,
    },
    copyBtn: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 6,
    },
    copyBtnText: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 13,
    },
    modalFooter: {
      paddingTop: 8,
    },
    importInstruction: {
      fontSize: 13,
      color: colors.textSecondary,
      marginVertical: 10,
    },
    pickFileBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 6,
    },
    pickFileBtnText: {
      color: colors.primaryText,
      fontWeight: '800',
      fontSize: 13,
    },
    importInput: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      height: 140,
      textAlignVertical: 'top',
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: 'monospace',
      marginBottom: 14,
    },
    restoreSubmitBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 6,
    },
    restoreSubmitText: {
      color: colors.primaryText,
      fontWeight: '800',
      fontSize: 14,
    },
  });
