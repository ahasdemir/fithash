import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface PastelTokens {
  green: string;
  greenBg: string;
  amber: string;
  amberBg: string;
  rose: string;
  roseBg: string;
  blue: string;
  blueBg: string;
  lavender: string;
  lavenderBg: string;
  cyan: string;
  cyanBg: string;
}

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
  pastel: PastelTokens;
  category: Record<string, string>;
}

/**
 * Scheme 1: Shadcn Zinc Monochrome + Soft Pastel Accents (Dark Mode - Default)
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

  secondary: '#93C5FD',       // Soft Pastel Sky
  accent: '#A1A1AA',          // Zinc-400

  textPrimary: '#FAFAFA',     // Zinc-50
  textSecondary: '#A1A1AA',   // Zinc-400
  textMuted: '#71717A',       // Zinc-500

  border: '#27272A',          // Crisp 1px Hairline Border Zinc-800
  borderDark: '#3F3F46',      // Active / Hover Border Zinc-700

  success: '#86EFAC',         // Soft Pastel Mint / Sage
  warning: '#FCD34D',         // Soft Pastel Butter Amber
  danger: '#FCA5A5',          // Soft Pastel Coral Rose

  pastel: {
    green: '#86EFAC',
    greenBg: 'rgba(134, 239, 172, 0.13)',
    amber: '#FCD34D',
    amberBg: 'rgba(252, 211, 77, 0.13)',
    rose: '#FCA5A5',
    roseBg: 'rgba(252, 165, 165, 0.13)',
    blue: '#93C5FD',
    blueBg: 'rgba(147, 197, 253, 0.13)',
    lavender: '#C4B5FD',
    lavenderBg: 'rgba(196, 181, 253, 0.13)',
    cyan: '#A5F3FC',
    cyanBg: 'rgba(165, 243, 252, 0.13)',
  },

  category: {
    'Göğüs': '#E4E4E7',
    'Sırt': '#93C5FD',
    'Bacak': '#86EFAC',
    'Omuz': '#FCD34D',
    'Kol': '#C4B5FD',
    'Ön Kol': '#99F6E4',
    'Arka Kol': '#D8B4FE',
    'Karın': '#F9A8D4',
    'Kardiyo': '#A5F3FC',
    'Tüm Vücut': '#D4D4D8',
  },
};

/**
 * Scheme 2: Swiss Daylight / Editorial Paper + Soft Pastel Accents (Light Mode)
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

  secondary: '#4E79A7',       // Dusty Pastel Slate Blue
  accent: '#575754',          // Warm Graphite

  textPrimary: '#111110',     // Deep Carbon Ink
  textSecondary: '#575754',   // Warm Graphite
  textMuted: '#8E8E8A',       // Neutral Warm Grey

  border: '#E4E4E0',          // Exposed 1px Architectural Hairline Grid
  borderDark: '#C8C8C2',      // Stronger Structural Border

  success: '#3F7D58',         // Soft Sage Forest (legible pastel ink on paper)
  warning: '#A16E22',         // Soft Warm Ochre
  danger: '#B85454',          // Dusty Rose Coral

  pastel: {
    green: '#3F7D58',
    greenBg: '#E6F4EA',
    amber: '#9A6B20',
    amberBg: '#FEF3DC',
    rose: '#B55353',
    roseBg: '#FCE8E8',
    blue: '#4B729E',
    blueBg: '#E8F0FA',
    lavender: '#76619E',
    lavenderBg: '#F1ECFA',
    cyan: '#3B7D86',
    cyanBg: '#E5F4F6',
  },

  category: {
    'Göğüs': '#52525B',
    'Sırt': '#4B729E',
    'Bacak': '#3F7D58',
    'Omuz': '#9A6B20',
    'Kol': '#76619E',
    'Ön Kol': '#3B7D86',
    'Arka Kol': '#8565A3',
    'Karın': '#A85C7B',
    'Kardiyo': '#3B7D86',
    'Tüm Vücut': '#6B6B68',
  },
};

let currentThemeMode: ThemeMode = 'dark';

// Mutable COLORS object so all existing `COLORS.*` imports reflect the active theme in real time
export const COLORS: ThemeColors = {
  ...DARK_COLORS,
  pastel: { ...DARK_COLORS.pastel },
  category: { ...DARK_COLORS.category },
};

type ThemeListener = (mode: ThemeMode) => void;
const listeners = new Set<ThemeListener>();

export const getThemeMode = (): ThemeMode => currentThemeMode;

export const setThemeMode = (mode: ThemeMode): void => {
  const nextPalette = mode === 'light' ? LIGHT_COLORS : DARK_COLORS;
  currentThemeMode = mode;
  Object.assign(COLORS, nextPalette, {
    pastel: { ...nextPalette.pastel },
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
  const [mode, setModeState] = useState<ThemeMode>(currentThemeMode);

  useEffect(() => {
    if (initialMode !== currentThemeMode) {
      setThemeMode(initialMode);
    }
    setModeState(currentThemeMode);
    return subscribeTheme(newMode => {
      setModeState(newMode);
    });
  }, [initialMode]);

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
    if (mode !== currentThemeMode) {
      setModeState(currentThemeMode);
    }
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

