import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../theme';
import {
  getAppSettings,
  saveAppSettings,
  exportFullDataJSON,
  exportWorkoutsCSV,
  importFullDataJSON,
  AppSettings,
} from '../services/settings';
import {
  requestHealthConnectPermissions,
  syncAllWorkoutsToHealthConnect,
  checkHealthConnectPermissions,
} from '../services/healthConnectService';
import { getWorkouts } from '../services/storage';
import { CustomAlertModal, CustomAlertOptions } from '../components/CustomAlertModal';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onDataReload: () => void;
}

const AVAILABLE_MODELS = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tag: 'Ücretsiz Tier • Hızlı & Önerilen' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', tag: 'Ücretsiz Tier • Ultra Hızlı' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Ücretsiz Tier • Kararlı Standart' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Ücretsiz Tier • Gelişmiş Mantık' },
];

const REST_TIME_OPTIONS = [30, 60, 90, 120, 180];
const RIR_OPTIONS = [0, 1, 2, 3];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onDataReload,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(90);
  const [autoStartRestTimer, setAutoStartRestTimer] = useState(true);
  const [defaultRir, setDefaultRir] = useState(1);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [healthConnectEnabled, setHealthConnectEnabled] = useState(false);
  const [isSyncingHC, setIsSyncingHC] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const loadSettings = async () => {
    const s = await getAppSettings();
    setApiKey(s.geminiApiKey || '');
    let model = s.selectedModel || 'gemini-2.0-flash';
    if (model.includes('2.5')) {
      model = 'gemini-2.0-flash';
    }
    setSelectedModel(model);
    setDefaultRestSeconds(s.defaultRestSeconds ?? 90);
    setAutoStartRestTimer(s.autoStartRestTimer ?? true);
    setDefaultRir(s.defaultRir ?? 1);
    setWeightUnit(s.weightUnit || 'kg');
    setHealthConnectEnabled(s.healthConnectEnabled ?? false);
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
      setCustomAlert({
        visible: true,
        type: 'success',
        title: 'Senkronizasyon Tamamlandı',
        message: `${res.success} antrenman ve yakılan kalori kaydı Health Connect'e başarıyla aktarıldı.`,
        onConfirm: () => setCustomAlert(null),
      });
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
      geminiApiKey: apiKey.trim(),
      selectedModel,
      defaultRestSeconds,
      autoStartRestTimer,
      defaultRir,
      weightUnit,
      healthConnectEnabled,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
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
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(exportContent);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = exportContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCustomAlert({
        visible: true,
        type: 'success',
        title: 'Kopyalandı!',
        message: `${exportType} verisi panoya kopyalandı.`,
        onConfirm: () => setCustomAlert(null),
      });
    } catch (err) {
      setCustomAlert({
        visible: true,
        type: 'info',
        title: 'Başarılı!',
        message: 'Metni aşağıdaki kutudan kopyalayabilirsiniz.',
        onConfirm: () => setCustomAlert(null),
      });
    }
  };

  const handleDownloadFile = async () => {
    try {
      const mimeType = exportType === 'JSON' ? 'application/json' : 'text/csv';
      const extension = exportType === 'JSON' ? 'json' : 'csv';
      const filename = `fithash_backup_${new Date().toISOString().split('T')[0]}.${extension}`;

      if (typeof document !== 'undefined') {
        // Web Platform Download
        const blob = new Blob([exportContent], { type: `${mimeType};charset=utf-8;` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Mobile Native (Android & iOS) Export & Sharing
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
        message: 'Antrenman geçmişi, ana sayfa programları, ek hareketler ve rekorlar geri yüklendi.',
        onConfirm: () => setCustomAlert(null),
      });
    } catch (error) {
      setCustomAlert({
        visible: true,
        type: 'danger',
        title: 'Hata',
        message: 'Yedek metni okunamadı! Geçerli bir JSON verisi yapıştırdığınızdan emin olun.',
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
            <Ionicons name="cog" size={22} color="#111111" />
            <Text style={styles.title}>Uygulama Ayarları</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* SECTION 1: WORKOUT & TIMER PREFERENCES */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="timer" size={18} color="#111111" />
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

          {/* SECTION 2: GEMINI AI API & MODEL SETTINGS */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="sparkles" size={18} color="#111111" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Gemini AI Entegrasyonu</Text>
                <Text style={styles.sectionSub}>Kişisel AI antrenörünüz için API anahtarı ve model</Text>
              </View>
            </View>

            {/* API Key Input */}
            <Text style={styles.label}>Gemini API Key</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="AIzaSy..."
                placeholderTextColor={COLORS.textMuted}
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry={false}
              />
              {apiKey ? (
                <TouchableOpacity onPress={() => setApiKey('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.hintText}>
              API anahtarınız sadece cihazınızda saklanır ve Google Gemini sunucularına doğrudan istek atmak için kullanılır.
            </Text>

            {/* Model Selector */}
            <Text style={styles.label}>AI Modeli Seçin</Text>
            <View style={styles.modelsContainer}>
              {AVAILABLE_MODELS.map(m => {
                const isSelected = selectedModel === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.modelCard,
                      isSelected && styles.modelCardSelected,
                    ]}
                    onPress={() => setSelectedModel(m.id)}
                  >
                    <View style={styles.modelCardHeader}>
                      <Text style={[styles.modelName, isSelected && styles.modelNameSelected]}>
                        {m.name}
                      </Text>
                      <View style={[styles.modelTag, isSelected && styles.modelTagSelected]}>
                        <Text style={[styles.modelTagText, isSelected && styles.modelTagTextSelected]}>
                          {m.tag}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SAVE ALL SETTINGS BUTTON */}
          <TouchableOpacity
            style={[styles.saveSettingsBtn, saveSuccess && styles.saveSettingsSuccess]}
            onPress={handleSaveAllSettings}
          >
            <Ionicons
              name={saveSuccess ? "checkmark-circle" : "save"}
              size={18}
              color="#111111"
            />
            <Text style={styles.saveSettingsBtnText}>
              {saveSuccess ? 'Ayarlar Kaydedildi!' : 'Tüm Ayarları Kaydet'}
            </Text>
          </TouchableOpacity>

          {/* SECTION: HEALTH CONNECT */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#10B981' }]}>
                <Ionicons name="fitness" size={18} color="#FFFFFF" />
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
                { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }
              ]}
              onPress={handleToggleHealthConnect}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons
                  name={healthConnectEnabled ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={healthConnectEnabled ? COLORS.primary : COLORS.textMuted}
                />
                <View>
                  <Text style={[styles.modelName, healthConnectEnabled && styles.modelNameSelected]}>
                    Health Connect {healthConnectEnabled ? 'Aktif' : 'Pasif'}
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                    {healthConnectEnabled ? 'Otomatik senkronize edilir' : 'Dokunarak izin verin'}
                  </Text>
                </View>
              </View>
              <Ionicons name="logo-android" size={22} color={healthConnectEnabled ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.importBtn, { marginTop: 12, backgroundColor: '#10B981' }]}
              onPress={handleSyncAllHealthConnect}
              disabled={isSyncingHC}
            >
              <Ionicons name="sync" size={18} color="#FFFFFF" />
              <Text style={[styles.importBtnText, { color: '#FFFFFF' }]}>
                {isSyncingHC ? 'Aktarılıyor...' : 'Tüm Geçmişi Health Connect\'e Aktar'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SECTION 3: DATA BACKUP & EXPORT / IMPORT */}
          <View style={styles.bentoSection}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#111111' }]}>
                <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
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
                <Ionicons name="document-text" size={22} color="#111111" />
                <Text style={styles.exportCardTitle}>JSON Dışa Aktar</Text>
                <Text style={styles.exportCardSub}>Tam sistem yedeği al</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportCardBtn}
                onPress={handleExportCSV}
              >
                <Ionicons name="grid-outline" size={22} color="#111111" />
                <Text style={styles.exportCardTitle}>CSV Dışa Aktar</Text>
                <Text style={styles.exportCardSub}>Excel / Tablo formatı</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => setShowImportModal(true)}
            >
              <Ionicons name="cloud-upload" size={18} color="#111111" />
              <Text style={styles.importBtnText}>Yedekten Geri Yükle (JSON İçe Aktar)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* EXPORT CONTENT DISPLAY MODAL */}
        {showExportModal && (
          <Modal visible transparent animationType="slide">
            <View style={styles.overlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{exportType} Dışa Aktarılan Veri</Text>
                  <TouchableOpacity onPress={() => setShowExportModal(false)}>
                    <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
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
                    <Ionicons name="download" size={16} color="#111111" />
                    <Text style={styles.downloadFileBtnText}>
                      Dosya Olarak İndir (.{exportType.toLowerCase()})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={handleCopyClipboard}
                  >
                    <Ionicons name="copy" size={16} color="#111111" />
                    <Text style={styles.copyBtnText}>Kopyala</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* IMPORT JSON PASTE MODAL */}
        {showImportModal && (
          <Modal visible transparent animationType="slide">
            <View style={styles.overlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>JSON Yedeği İçe Aktar</Text>
                  <TouchableOpacity onPress={() => setShowImportModal(false)}>
                    <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.importInstruction}>
                  Daha önce dışa aktardığınız JSON yedek metnini aşağıdaki alana yapıştırın:
                </Text>

                <TextInput
                  style={styles.importInput}
                  multiline
                  placeholder='{"version": "1.0.0", "workouts": [...]}'
                  placeholderTextColor={COLORS.textMuted}
                  value={importText}
                  onChangeText={setImportText}
                />

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.restoreSubmitBtn}
                    onPress={handleImportSubmit}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#111111" />
                    <Text style={styles.restoreSubmitText}>Verileri Geri Yükle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
        {customAlert && (
          <CustomAlertModal
            {...customAlert}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
    flexGrow: 1,
  },
  bentoSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.soft,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillBtn: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillBtnSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pillBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 100,
    paddingHorizontal: 16,
    height: 44,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  modelsContainer: {
    gap: 8,
  },
  modelCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modelCardSelected: {
    backgroundColor: COLORS.primaryGlow,
    borderColor: '#111111',
  },
  modelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modelNameSelected: {
    color: '#111111',
  },
  modelTag: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modelTagSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modelTagText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modelTagTextSelected: {
    color: '#111111',
    fontWeight: '800',
  },
  saveSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 100,
    marginVertical: 4,
    ...SHADOWS.soft,
  },
  saveSettingsSuccess: {
    backgroundColor: '#10B981',
  },
  saveSettingsBtnText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
  },
  exportGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  exportCardBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
    alignItems: 'flex-start',
  },
  exportCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  exportCardSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 100,
    marginTop: 4,
  },
  importBtnText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  codeScroll: {
    maxHeight: 250,
    marginVertical: 14,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  codeText: {
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 100,
  },
  downloadFileBtnText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 13,
  },
  copyBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 100,
  },
  copyBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  modalFooter: {
    paddingTop: 8,
  },
  importInstruction: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginVertical: 10,
  },
  importInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    height: 140,
    textAlignVertical: 'top',
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 14,
  },
  restoreSubmitBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 100,
  },
  restoreSubmitText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 14,
  },
});
