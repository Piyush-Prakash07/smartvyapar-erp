import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'emerald' | 'sapphire';

export interface ThemeConfig {
  id: ThemeMode;
  name: string;
  description: string;
  iconName: 'Sun' | 'Moon' | 'Sparkles' | 'Gem';
  previewBg: string;
  previewAccent: string;
}

export const THEME_OPTIONS: ThemeConfig[] = [
  {
    id: 'light',
    name: 'Executive Light',
    description: 'Crisp & clean daylight view for daytime operations',
    iconName: 'Sun',
    previewBg: '#f8fafc',
    previewAccent: '#004870',
  },
  {
    id: 'dark',
    name: 'Midnight Dark',
    description: 'Deep charcoal slate, reduces eye strain for night entry',
    iconName: 'Moon',
    previewBg: '#0b1120',
    previewAccent: '#38bdf8',
  },
  {
    id: 'emerald',
    name: 'Emerald Vyapar',
    description: 'Traditional merchant green & gold prosperity aesthetic',
    iconName: 'Sparkles',
    previewBg: '#061e16',
    previewAccent: '#10b981',
  },
  {
    id: 'sapphire',
    name: 'Royal Sapphire',
    description: 'Rich corporate indigo & cosmic blue modern ERP aesthetic',
    iconName: 'Gem',
    previewBg: '#090e1a',
    previewAccent: '#6366f1',
  },
];

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  cycleNextTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'smartvyapar_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved && (saved === 'light' || saved === 'dark' || saved === 'emerald' || saved === 'sapphire')) {
      return saved;
    }
    // Check system preference if no saved preference
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark' || theme === 'emerald' || theme === 'sapphire') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const cycleNextTheme = () => {
    const currentIndex = THEME_OPTIONS.findIndex((t) => t.id === theme);
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    setThemeState(THEME_OPTIONS[nextIndex].id);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleNextTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
