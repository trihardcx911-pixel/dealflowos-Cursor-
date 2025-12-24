/**
 * Theme management hook and initialization
 * Provides theme switching with localStorage persistence
 */

import React from 'react';

const THEME_STORAGE_KEY = 'df-theme';

export type Theme = 'light' | 'dark';

/**
 * Initialize theme before React render (plain JS)
 * Must be called synchronously to prevent flash of wrong theme
 */
export function initTheme(): void {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  const theme: Theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
  
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

/**
 * React hook for theme management
 */
export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });

  React.useEffect(() => {
    // Sync with localStorage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const newTheme = e.newValue as Theme;
        if (newTheme === 'light' || newTheme === 'dark') {
          setThemeState(newTheme);
          applyTheme(newTheme);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const html = document.documentElement;
    if (newTheme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}

