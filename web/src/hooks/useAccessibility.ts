/**
 * Accessibility management hook and initialization
 * Provides dyslexia-friendly font switching with localStorage persistence
 */

import React from 'react';

const FONT_STORAGE_KEY = 'df-font';

export type FontMode = 'normal' | 'dyslexic';

/**
 * Initialize accessibility settings before React render (plain JS)
 * Must be called synchronously to prevent flash of wrong font
 */
export function initAccessibility(): void {
  const stored = localStorage.getItem(FONT_STORAGE_KEY) as FontMode | null;
  const fontMode: FontMode = stored === 'normal' || stored === 'dyslexic' ? stored : 'normal';
  
  const html = document.documentElement;
  if (fontMode === 'dyslexic') {
    html.classList.add('dyslexic');
  } else {
    html.classList.remove('dyslexic');
  }
}

/**
 * React hook for accessibility management
 */
export function useAccessibility() {
  const [fontMode, setFontModeState] = React.useState<FontMode>(() => {
    const stored = localStorage.getItem(FONT_STORAGE_KEY) as FontMode | null;
    return stored === 'normal' || stored === 'dyslexic' ? stored : 'normal';
  });

  const applyFontMode = React.useCallback((newFontMode: FontMode) => {
    const html = document.documentElement;
    if (newFontMode === 'dyslexic') {
      html.classList.add('dyslexic');
    } else {
      html.classList.remove('dyslexic');
    }
    localStorage.setItem(FONT_STORAGE_KEY, newFontMode);
  }, []);

  React.useEffect(() => {
    // Apply font mode on mount to ensure consistency with initAccessibility
    applyFontMode(fontMode);

    // Sync with localStorage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === FONT_STORAGE_KEY && e.newValue) {
        const newFontMode = e.newValue as FontMode;
        if (newFontMode === 'normal' || newFontMode === 'dyslexic') {
          setFontModeState(newFontMode);
          applyFontMode(newFontMode);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fontMode, applyFontMode]);

  const setDyslexic = (mode: FontMode) => {
    setFontModeState(mode);
    applyFontMode(mode);
  };

  const toggleDyslexic = () => {
    const newMode: FontMode = fontMode === 'dyslexic' ? 'normal' : 'dyslexic';
    setDyslexic(newMode);
  };

  return {
    fontMode,
    setDyslexic,
    toggleDyslexic,
    isDyslexic: fontMode === 'dyslexic',
  };
}

