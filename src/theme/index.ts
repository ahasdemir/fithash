export const COLORS = {
  background: '#0B0F14',
  backgroundPure: '#070A0E',

  surface: '#11161D',
  surfaceElevated: '#161D26',
  surfaceSubtle: '#0E1319',

  // Ice Blue Cockpit Accent
  primary: '#4CC2FF',
  primaryDark: '#2E9FE0',
  primaryDarker: '#06121C',
  primaryGlow: 'rgba(76, 194, 255, 0.25)',
  primaryText: '#06121C',

  accent: '#1E2836',
  accentBlue: '#4CC2FF',

  textPrimary: '#F2F6FA',
  textSecondary: '#98A2B3',
  textMuted: '#5D6B7E',
  textInverted: '#06121C',

  border: '#1E2836',
  borderDark: '#2A3849',
  inputBg: '#131A22',

  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',

  // Category Colors
  category: {
    'Göğüs': '#EF4444',
    'Sırt': '#0EA5E9',
    'Bacak': '#8B5CF6',
    'Omuz': '#F59E0B',
    'Ön Kol': '#10B981',
    'Arka Kol': '#3B82F6',
    'Karın': '#EC4899',
    'Kardiyo': '#F97316',
  } as Record<string, string>,
};

export const COLORS_LIGHT: typeof COLORS = {
  background: '#F3F6FA',
  backgroundPure: '#FFFFFF',

  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSubtle: '#EDF2F7',

  // Light Mode High-Contrast Cockpit Blue
  primary: '#2E9FE0',
  primaryDark: '#1F7FB8',
  primaryDarker: '#06121C',
  primaryGlow: 'rgba(46, 159, 224, 0.20)',
  primaryText: '#06121C',

  accent: '#101828',
  accentBlue: '#2E9FE0',

  textPrimary: '#101828',
  textSecondary: '#475467',
  textMuted: '#667085',
  textInverted: '#FFFFFF',

  border: '#DCE3EC',
  borderDark: '#C3CEDB',
  inputBg: '#F8FAFC',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',

  // Category Colors
  category: {
    'Göğüs': '#EF4444',
    'Sırt': '#0EA5E9',
    'Bacak': '#8B5CF6',
    'Omuz': '#F59E0B',
    'Ön Kol': '#10B981',
    'Arka Kol': '#3B82F6',
    'Karın': '#EC4899',
    'Kardiyo': '#F97316',
  } as Record<string, string>,
};

export const SHADOWS = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  floatingTab: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 2,
  },
};
