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
    // Sidebar
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

    // Topbar & Navigation
    topbarBg: string;
    topbarBorder: string;
    topbarCtaBg: string;
    topbarCtaText: string;
    topbarActiveNavBg: string;
    topbarActiveNavText: string;

    // Global Action Buttons & Banners
    primaryBtnBg: string;
    primaryBtnHover: string;
    primaryBtnText: string;
    bannerGradient: string;
    bannerBtnBg: string;
    bannerBtnText: string;
    bannerSecondaryBtnBg: string;
    bannerSecondaryBtnText: string;
    activeFilterBg: string;
    activeFilterText: string;

    // Canvas & Cards
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
      sidebarText: 'text-[#e4f3e6]',
      sidebarTextMuted: 'text-[#a6cca9]',
      sidebarCategoryText: 'text-gold-400',
      sidebarHoverBg: 'hover:bg-[#1c331e] hover:text-white',
      sidebarActiveBg: 'bg-brand-700/90',
      sidebarActiveText: 'text-white',
      sidebarActiveRing: 'ring-gold-400/40',
      sidebarCtaBg: 'bg-brand-600 hover:bg-brand-500',
      sidebarCtaText: 'text-white',

      topbarBg: 'bg-white/95',
      topbarBorder: 'border-cream-300',
      topbarCtaBg: 'bg-brand-700 hover:bg-brand-600 border border-brand-500/40 shadow-xs',
      topbarCtaText: 'text-white font-bold',
      topbarActiveNavBg: 'bg-brand-800 border-brand-900 shadow-xs',
      topbarActiveNavText: 'text-white',

      primaryBtnBg: 'bg-brand-800 hover:bg-brand-900',
      primaryBtnHover: 'hover:bg-brand-900',
      primaryBtnText: 'text-white',
      bannerGradient: 'bg-gradient-to-r from-brand-900 to-emerald-950 border border-brand-800 text-white',
      bannerBtnBg: 'bg-gold-500 hover:bg-gold-400',
      bannerBtnText: 'text-gold-950 font-black',
      bannerSecondaryBtnBg: 'bg-brand-800/90 hover:bg-brand-700 text-white border border-brand-600',
      bannerSecondaryBtnText: 'text-white',
      activeFilterBg: 'bg-brand-800 text-white shadow-2xs',
      activeFilterText: 'text-white',

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
      sidebarText: 'text-[#122214]',
      sidebarTextMuted: 'text-[#4d6650]',
      sidebarCategoryText: 'text-[#18331a]',
      sidebarHoverBg: 'hover:bg-cream-200 hover:text-brand-950',
      sidebarActiveBg: 'bg-brand-800',
      sidebarActiveText: 'text-white',
      sidebarActiveRing: 'ring-brand-900/30',
      sidebarCtaBg: 'bg-brand-800 hover:bg-brand-900',
      sidebarCtaText: 'text-white',

      topbarBg: 'bg-[#ffffff]/95',
      topbarBorder: 'border-cream-300',
      topbarCtaBg: 'bg-brand-800 hover:bg-brand-900 border border-brand-950/20 shadow-xs',
      topbarCtaText: 'text-white font-bold',
      topbarActiveNavBg: 'bg-brand-800 border-brand-950 shadow-xs',
      topbarActiveNavText: 'text-white',

      primaryBtnBg: 'bg-brand-800 hover:bg-brand-900',
      primaryBtnHover: 'hover:bg-brand-900',
      primaryBtnText: 'text-white',
      bannerGradient: 'bg-gradient-to-r from-[#28482a] to-[#1c321d] border border-brand-700 text-white',
      bannerBtnBg: 'bg-white hover:bg-cream-100',
      bannerBtnText: 'text-brand-950 font-black',
      bannerSecondaryBtnBg: 'bg-brand-900/70 hover:bg-brand-900 text-white border border-brand-600',
      bannerSecondaryBtnText: 'text-white',
      activeFilterBg: 'bg-brand-800 text-white shadow-2xs',
      activeFilterText: 'text-white',

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
      sidebarText: 'text-[#e0f2e2]',
      sidebarTextMuted: 'text-[#a1cba3]',
      sidebarCategoryText: 'text-gold-400',
      sidebarHoverBg: 'hover:bg-[#122414] hover:text-white',
      sidebarActiveBg: 'bg-[#1e3d21]',
      sidebarActiveText: 'text-white',
      sidebarActiveRing: 'ring-gold-400/40',
      sidebarCtaBg: 'bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500',
      sidebarCtaText: 'text-gold-950',

      topbarBg: 'bg-white/95',
      topbarBorder: 'border-cream-300',
      topbarCtaBg: 'bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 border border-gold-500 shadow-xs',
      topbarCtaText: 'text-gold-950 font-black',
      topbarActiveNavBg: 'bg-[#081209] border-black shadow-xs',
      topbarActiveNavText: 'text-gold-300',

      primaryBtnBg: 'bg-[#081209] hover:bg-[#122414]',
      primaryBtnHover: 'hover:bg-[#122414]',
      primaryBtnText: 'text-white',
      bannerGradient: 'bg-gradient-to-r from-[#081209] to-[#122414] border border-[#1e3d21] text-white',
      bannerBtnBg: 'bg-gold-400 hover:bg-gold-300',
      bannerBtnText: 'text-gold-950 font-black',
      bannerSecondaryBtnBg: 'bg-[#122414] hover:bg-[#1e3d21] text-gold-200 border border-gold-600/40',
      bannerSecondaryBtnText: 'text-gold-200',
      activeFilterBg: 'bg-[#081209] text-gold-300 shadow-2xs border border-gold-500/30',
      activeFilterText: 'text-gold-300',

      canvasBg: 'bg-[#f8f6f0]',
      cardBg: 'bg-white',
      cardBorder: 'border-cream-300',
      primaryBrand: '#081209',
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
      sidebarText: 'text-[#f5ebe6]',
      sidebarTextMuted: 'text-[#caa999]',
      sidebarCategoryText: 'text-amber-300',
      sidebarHoverBg: 'hover:bg-[#2c201a] hover:text-white',
      sidebarActiveBg: 'bg-amber-700',
      sidebarActiveText: 'text-white',
      sidebarActiveRing: 'ring-amber-400/40',
      sidebarCtaBg: 'bg-amber-600 hover:bg-amber-500',
      sidebarCtaText: 'text-white',

      topbarBg: 'bg-white/95',
      topbarBorder: 'border-amber-100',
      topbarCtaBg: 'bg-amber-700 hover:bg-amber-600 border border-amber-600/40 shadow-xs',
      topbarCtaText: 'text-white font-bold',
      topbarActiveNavBg: 'bg-amber-800 border-amber-900 shadow-xs',
      topbarActiveNavText: 'text-white',

      primaryBtnBg: 'bg-amber-700 hover:bg-amber-800',
      primaryBtnHover: 'hover:bg-amber-800',
      primaryBtnText: 'text-white',
      bannerGradient: 'bg-gradient-to-r from-amber-900 to-[#1a1411] border border-amber-700 text-white',
      bannerBtnBg: 'bg-amber-500 hover:bg-amber-400',
      bannerBtnText: 'text-white font-black',
      bannerSecondaryBtnBg: 'bg-amber-950/70 hover:bg-amber-900 text-amber-100 border border-amber-600',
      bannerSecondaryBtnText: 'text-amber-100',
      activeFilterBg: 'bg-amber-700 text-white shadow-2xs',
      activeFilterText: 'text-white',

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
    document.documentElement.style.setProperty('--theme-primary-brand', currentTheme.colors.primaryBrand);
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
