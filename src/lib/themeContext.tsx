import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeId = 'tarbiyah-classic' | 'modern-clean' | 'midnight-forest' | 'warm-terracotta';
export type SidebarStyle = 'dark' | 'light';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  description: string;
  sidebarStyle: SidebarStyle;
  colors: {
    sidebarBg: string;
    sidebarHeaderBg: string;
    sidebarBorder: string;
    sidebarText: string;
    sidebarTextMuted: string;
    sidebarCategoryText: string;
    sidebarHoverBg: string;
    sidebarActiveBg: string;
    sidebarActiveText: string;
    sidebarActiveRing: string;
    sidebarCtaBg: string;
    sidebarCtaText: string;
    canvasBg: string;
    cardBg: string;
    cardBorder: string;
    primaryBrand: string;
    accentGold: string;
    accentAmber: string;
  };
  swatches: string[];
}

export const THEME_PRESETS: Record<ThemeId, ThemeConfig> = {
  'tarbiyah-classic': {
    id: 'tarbiyah-classic',
    name: 'Tarbiyah Sunnah Klasik (Resmi)',
    subtitle: 'Identitas Resmi Yayasan',
    description: 'Palet asli hasil ekstraksi logo resmi: Hijau Hutan Teduh, Emas Sunnah, dan Warm Ivory Canvas.',
    sidebarStyle: 'dark',
    colors: {
      sidebarBg: 'bg-[#122214]',
      sidebarHeaderBg: 'bg-[#0c180e]',
      sidebarBorder: 'border-[#1f3622]',
      sidebarText: 'text-[#bfd9c1]',
      sidebarTextMuted: 'text-[#93ba97]',
      sidebarCategoryText: 'text-[#8fad92]',
      sidebarHoverBg: 'hover:bg-[#1c331e] hover:text-white',
      sidebarActiveBg: 'bg-brand-700/80',
      sidebarActiveText: 'text-white',
      sidebarActiveRing: 'ring-brand-400/50',
      sidebarCtaBg: 'bg-brand-600 hover:bg-brand-500',
      sidebarCtaText: 'text-white',
      canvasBg: 'bg-[#fbfaf6]',
      cardBg: 'bg-white',
      cardBorder: 'border-cream-300',
      primaryBrand: '#447346',
      accentGold: '#efa914',
      accentAmber: '#d87114',
    },
    swatches: ['#122214', '#447346', '#efa914', '#d87114', '#fbfaf6'],
  },
  'modern-clean': {
    id: 'modern-clean',
    name: 'Modern Clean Ivory (Sidebar Terang)',
    subtitle: 'Minimalis & Terang',
    description: 'Sidebar terang krem/putih dengan border tipis dan tipografi hijau pekat modern.',
    sidebarStyle: 'light',
    colors: {
      sidebarBg: 'bg-[#f7f5ed]',
      sidebarHeaderBg: 'bg-[#ebe8dc]',
      sidebarBorder: 'border-cream-300',
      sidebarText: 'text-brand-950',
      sidebarTextMuted: 'text-surface-500',
      sidebarCategoryText: 'text-brand-800',
      sidebarHoverBg: 'hover:bg-cream-200 hover:text-brand-950',
      sidebarActiveBg: 'bg-brand-800',
      sidebarActiveText: 'text-white',
      sidebarActiveRing: 'ring-brand-900/30',
      sidebarCtaBg: 'bg-brand-800 hover:bg-brand-900',
      sidebarCtaText: 'text-white',
      canvasBg: 'bg-[#fbfaf6]',
      cardBg: 'bg-white',
      cardBorder: 'border-cream-300',
      primaryBrand: '#28482a',
      accentGold: '#efa914',
      accentAmber: '#d87114',
    },
    swatches: ['#f7f5ed', '#28482a', '#efa914', '#ffffff', '#e8e4d3'],
  },
  'midnight-forest': {
    id: 'midnight-forest',
    name: 'Deep Midnight Forest (Kontras Teduh)',
    subtitle: 'Gelap Pekat & Aksen Emas',
    description: 'Latar sidebar hitam hijau pekat dengan aksen emas cerah, sangat nyaman untuk penggunaan intensif.',
    sidebarStyle: 'dark',
    colors: {
      sidebarBg: 'bg-[#081209]',
      sidebarHeaderBg: 'bg-[#040a05]',
      sidebarBorder: 'border-[#122414]',
      sidebarText: 'text-[#a3c4a6]',
      sidebarTextMuted: 'text-[#729c76]',
      sidebarCategoryText: 'text-gold-400',
      sidebarHoverBg: 'hover:bg-[#122414] hover:text-white',
      sidebarActiveBg: 'bg-[#1e3d21]',
      sidebarActiveText: 'text-white',
      sidebarActiveRing: 'ring-gold-400/40',
      sidebarCtaBg: 'bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500',
      sidebarCtaText: 'text-gold-950',
      canvasBg: 'bg-[#f8f6f0]',
      cardBg: 'bg-white',
      cardBorder: 'border-cream-300',
      primaryBrand: '#1e3d21',
      accentGold: '#f7c244',
      accentAmber: '#d87114',
    },
    swatches: ['#081209', '#1e3d21', '#f7c244', '#ffffff', '#f8f6f0'],
  },
  'warm-terracotta': {
    id: 'warm-terracotta',
    name: 'Ukhuwah & Wakaf Terracotta (Aksen Hangat)',
    subtitle: 'Nuansa Hangat & Ramah',
    description: 'Sentuhan warna terakota dan kayu markaz yang ramah, hangat, dan mencerminkan semangat wakaf.',
    sidebarStyle: 'dark',
    colors: {
      sidebarBg: 'bg-[#1a1411]',
      sidebarHeaderBg: 'bg-[#120d0b]',
      sidebarBorder: 'border-[#2c201a]',
      sidebarText: 'text-[#dccbc2]',
      sidebarTextMuted: 'text-[#b89f92]',
      sidebarCategoryText: 'text-amber-400',
      sidebarHoverBg: 'hover:bg-[#2c201a] hover:text-white',
      sidebarActiveBg: 'bg-amber-700',
      sidebarActiveText: 'text-white',
      sidebarActiveRing: 'ring-amber-400/40',
      sidebarCtaBg: 'bg-amber-600 hover:bg-amber-500',
      sidebarCtaText: 'text-white',
      canvasBg: 'bg-[#faf8f5]',
      cardBg: 'bg-white',
      cardBorder: 'border-amber-100',
      primaryBrand: '#c05c0f',
      accentGold: '#efa914',
      accentAmber: '#d87114',
    },
    swatches: ['#1a1411', '#c05c0f', '#d87114', '#efa914', '#faf8f5'],
  },
};

interface ThemeContextType {
  currentTheme: ThemeConfig;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'crm_yts_theme_preset';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY) as ThemeId;
      if (saved && THEME_PRESETS[saved]) {
        return saved;
      }
    } catch {}
    return 'tarbiyah-classic';
  });

  const setThemeId = (id: ThemeId) => {
    if (THEME_PRESETS[id]) {
      setThemeIdState(id);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, id);
      } catch {}
    }
  };

  const resetToDefault = () => {
    setThemeId('tarbiyah-classic');
  };

  const currentTheme = THEME_PRESETS[themeId] || THEME_PRESETS['tarbiyah-classic'];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    document.documentElement.setAttribute('data-sidebar-style', currentTheme.sidebarStyle);
  }, [themeId, currentTheme]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themeId,
        setThemeId,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
