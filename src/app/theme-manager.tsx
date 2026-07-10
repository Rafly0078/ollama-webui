'use client';

import { useEffect } from 'react';
import { ACCENT_PRESETS } from '@/lib/store/defaults';
import { useSettings } from '@/lib/store/settings-store';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { setApiOverride } from '@/lib/api/config';

/**
 * Applies theme (dark/light/system) and accent color to the document root by
 * mutating CSS variables. Also propagates the API URL override to the API layer.
 * Runs entirely on the client after hydration.
 */
export function ThemeManager({ children }: { children: React.ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);
  const apiUrlOverride = useSettings((s) => s.apiUrlOverride);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    setApiOverride(apiUrlOverride);
  }, [apiUrlOverride]);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
  }, [theme, prefersDark]);

  useEffect(() => {
    const preset = ACCENT_PRESETS.find((a) => a.value === accent) ?? ACCENT_PRESETS[0]!;
    const root = document.documentElement;
    root.style.setProperty('--accent', preset.rgb);
    root.style.setProperty('--accent-soft', preset.soft);
  }, [accent]);

  return <>{children}</>;
}
