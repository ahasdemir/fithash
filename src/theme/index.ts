export const COLORS = {
  background: '#F4F5F7',
  backgroundPure: '#FFFFFF',
  
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSubtle: '#F8F9FA',
  
  // Neon / Lime Accent
  primary: '#C6F035',       // High-visibility Neon Lime
  primaryDark: '#A8D220',
  primaryDarker: '#111111',
  primaryGlow: 'rgba(198, 240, 53, 0.25)',
  primaryText: '#111111',

  accent: '#111111',       // Dark Charcoal / Off-Black
  accentBlue: '#3B82F6',

  textPrimary: '#111111',
  textSecondary: '#555555',
  textMuted: '#8E8E93',
  textInverted: '#FFFFFF',

  border: '#E8EAEF',
  borderDark: '#D1D5DB',
  inputBg: '#F8F9FA',
  
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
  } as Record<string, string>
};

export const SHADOWS = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  floatingTab: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 10,
  }
};
