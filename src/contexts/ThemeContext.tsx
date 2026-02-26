import React, { createContext, useContext, useState, useEffect } from 'react';
import { Theme, themes, defaultTheme } from '@/themes/themes';

interface ThemeContextType {
  theme: Theme;
  setTheme: (themeId: string) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const defaultTypography = {
  siteTitleSize: '1.25rem',
  navSize: '1rem',
  h1Size: '3rem',
  h2Size: '2.25rem',
  h3Size: '1.5rem',
  bodySize: '1.125rem',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedThemeId = localStorage.getItem('cms-theme-id');
    return themes.find(t => t.id === savedThemeId) || defaultTheme;
  });

  useEffect(() => {
    // Applica il tema al documento
    const root = document.documentElement;
    const typography = { ...defaultTypography, ...(theme.typography || {}) };
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-background', theme.colors.background);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-text-secondary', theme.colors.textSecondary);
    root.style.setProperty('--color-border', theme.colors.border);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--font-heading', theme.fonts.heading);
    root.style.setProperty('--font-body', theme.fonts.body);
    root.style.setProperty('--font-site-title', theme.fonts.heading);
    root.style.setProperty('--size-site-title', typography.siteTitleSize);
    root.style.setProperty('--font-nav', theme.fonts.body);
    root.style.setProperty('--size-nav', typography.navSize);
    root.style.setProperty('--font-h1', theme.fonts.heading);
    root.style.setProperty('--size-h1', typography.h1Size);
    root.style.setProperty('--font-h2', theme.fonts.heading);
    root.style.setProperty('--size-h2', typography.h2Size);
    root.style.setProperty('--font-h3', theme.fonts.heading);
    root.style.setProperty('--size-h3', typography.h3Size);
    root.style.setProperty('--font-body-copy', theme.fonts.body);
    root.style.setProperty('--size-body-copy', typography.bodySize);
    root.style.setProperty('--container-width', theme.spacing.container);
    root.style.setProperty('--section-spacing', theme.spacing.section);
    root.dataset.cmsDensity = theme.spacing.density || 'normal';
    root.style.setProperty('--border-radius', theme.borderRadius);
    root.style.setProperty('--logo-url', `url(${theme.logo})`);
    root.style.setProperty('--header-background', `url(${theme.headerBackground})`);
    root.style.setProperty('--footer-background', `url(${theme.footerBackground})`);
  }, [theme]);

  const setTheme = (themeId: string) => {
    const newTheme = themes.find(t => t.id === themeId);
    if (newTheme) {
      setThemeState(newTheme);
      localStorage.setItem('cms-theme-id', themeId);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes: themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve essere usato all\'interno di ThemeProvider');
  }
  return context;
}
