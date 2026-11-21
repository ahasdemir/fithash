import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  inputBg: string;
  primary: string;
  primaryDark: string;
  primaryDarker: string;
  primaryLight: string;
  primaryGlow: string;
  primaryText: string;
  textInverted: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderDark: string;
  success: string;
  warning: string;
  danger: string;
  category: Record<string, string>;
}

/**
 * Scheme 1: Shadcn Zinc Monochrome (Dark Mode - Default)
 */
export const DARK_COLORS: ThemeColors = {
  background: '#09090B',      // Deep Obsidian Zinc-950
  surface: '#111113',         // Card Surface Zinc-900+
  surfaceElevated: '#18181B', // Elevated Surface / Input Zinc-900
  surfaceSubtle: '#1F1F23',   // Muted Chip / Secondary Surface Zinc-800/850
  inputBg: '#18181B',

  primary: '#FAFAFA',         // Crisp Monochrome White Primary CTA
  primaryDark: '#E4E4E7',     // Zinc-200 Pressed State
  primaryDarker: '#09090B',   // High-contrast foreground on primary
  primaryLight: '#27272A',    // Subtle active tint
  primaryGlow: 'rgba(250, 250, 250, 0.08)',
  primaryText: '#09090B',     // Dark text on light primary button
  textInverted: '#09090B',

  secondary: '#3B82F6',       // Clinical Cobalt Blue
  accent: '#A1A1AA',          // Zinc-400

  textPrimary: '#FAFAFA',     // Zinc-50
  textSecondary: '#A1A1AA',   // Zinc-400
  textMuted: '#71717A',       // Zinc-500

  border: '#27272A',          // Crisp 1px Hairline Border Zinc-800
  borderDark: '#3F3F46',      // Active / Hover Border Zinc-700

  success: '#10B981',         // Emerald-500
  warning: '#F59E0B',         // Amber-500
  danger: '#EF4444',          // Red-500

  category: {
    'Göğüs': '#FAFAFA',
    'Sırt': '#3B82F6',
    'Bacak': '#10B981',
    'Omuz': '#F59E0B',
    'Kol': '#A855F7',
    'Ön Kol': '#10B981',
    'Arka Kol': '#A855F7',
    'Karın': '#EC4899',
    'Kardiyo': '#06B6D4',
    'Tüm Vücut': '#E4E4E7',
  },
};

/**
 * Scheme 2: Swiss Daylight / Editorial Paper (Light Mode)
 */
export const LIGHT_COLORS: ThemeColors = {
  background: '#F7F7F5',      // Warm Alabaster Paper
  surface: '#FFFFFF',         // Pure Crisp White Card
  surfaceElevated: '#FFFFFF', // Pure White Elevated Surface
  surfaceSubtle: '#EFEFEC',   // Warm Stone Input / Chip Surface
  inputBg: '#EFEFEC',

  primary: '#111110',         // Carbon Ink Primary CTA
  primaryDark: '#27272A',     // Zinc-800 Pressed State
  primaryDarker: '#FFFFFF',   // High-contrast foreground on primary
  primaryLight: '#E4E4E0',    // Subtle active tint
  primaryGlow: 'rgba(17, 17, 16, 0.06)',
  primaryText: '#FFFFFF',     // White text on carbon ink button
  textInverted: '#FFFFFF',

  secondary: '#2563EB',       // International Klein / Swiss Blue
  accent: '#575754',          // Warm Graphite

  textPrimary: '#111110',     // Deep Carbon Ink
  textSecondary: '#575754',   // Warm Graphite
  textMuted: '#8E8E8A',       // Neutral Warm Grey

  border: '#E4E4E0',          // Exposed 1px Architectural Hairline Grid
  borderDark: '#C8C8C2',      // Stronger Structural Border

  success: '#16A34A',         // Swiss Signal Green
  warning: '#D97706',         // Industrial Amber
  danger: '#DC2626',          // Swiss Signal Red

  category: {
    'Göğüs': '#111110',
    'Sırt': '#2563EB',
    'Bacak': '#16A34A',
    'Omuz': '#D97706',
    'Kol': '#7C3AED',
    'Ön Kol': '#16A34A',
    'Arka Kol': '#7C3AED',
    'Karın': '#DB2777',
    'Kardiyo': '#0891B2',
    'Tüm Vücut': '#575754',
  },
};

let currentThemeMode: ThemeMode = 'dark';

// Mutable COLORS object so all existing `COLORS.*` imports reflect the active theme in real time
export const COLORS: ThemeColors = {
  ...DARK_COLORS,
  category: { ...DARK_COLORS.category },
};

type ThemeListener = (mode: ThemeMode) => void;
const listeners = new Set<ThemeListener>();

export const getThemeMode = (): ThemeMode => currentThemeMode;

export const setThemeMode = (mode: ThemeMode): void => {
  const nextPalette = mode === 'light' ? LIGHT_COLORS : DARK_COLORS;
  currentThemeMode = mode;
  Object.assign(COLORS, nextPalette, {
    category: { ...nextPalette.category },
  });
  listeners.forEach(listener => listener(mode));
};

export const subscribeTheme = (listener: ThemeListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{
  initialMode?: ThemeMode;
  onModeChange?: (mode: ThemeMode) => void;
  children: React.ReactNode;
}> = ({ initialMode = 'dark', onModeChange, children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (initialMode !== currentThemeMode) {
      setThemeMode(initialMode);
    }
    return currentThemeMode;
  });

  useEffect(() => {
    return subscribeTheme(newMode => {
      setModeState(newMode);
    });
  }, []);

  const handleSetMode = useCallback(
    (nextMode: ThemeMode) => {
      setThemeMode(nextMode);
      if (onModeChange) {
        onModeChange(nextMode);
      }
    },
    [onModeChange]
  );

  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = currentThemeMode === 'dark' ? 'light' : 'dark';
    handleSetMode(nextMode);
  }, [handleSetMode]);

  const colors = mode === 'light' ? LIGHT_COLORS : DARK_COLORS;

  return React.createElement(
    ThemeContext.Provider,
    {
      value: {
        mode,
        colors,
        setMode: handleSetMode,
        toggleTheme,
      },
    },
    children
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  const [mode, setModeState] = useState<ThemeMode>(currentThemeMode);

  useEffect(() => {
    if (ctx) return;
    return subscribeTheme(newMode => {
      setModeState(newMode);
    });
  }, [ctx]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setThemeMode(nextMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(currentThemeMode === 'dark' ? 'light' : 'dark');
  }, []);

  if (ctx) {
    return ctx;
  }

  return {
    mode,
    colors: mode === 'light' ? LIGHT_COLORS : DARK_COLORS,
    setMode,
    toggleTheme,
  };
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
};

const ZERO_SHADOW = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

/**
 * Flat zero-elevation shadows — depth is achieved strictly via 1px hairline borders
 * and surface color contrast.
 */
export const SHADOWS = {
  soft: ZERO_SHADOW,
  medium: ZERO_SHADOW,
  floatingTab: ZERO_SHADOW,
  lime: ZERO_SHADOW,
  floating: ZERO_SHADOW,
};
