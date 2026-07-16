'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Captures the `beforeinstallprompt` event so we can show a custom
 * "Install App" button in Settings instead of relying on the browser's
 * auto-prompt (which doesn't fire on all platforms — notably iOS Safari).
 *
 * Returns:
 *  - `canInstall`: true when the browser has stashed a deferred prompt
 *  - `installed`: true when the app is already running in standalone mode
 *  - `promptInstall()`: triggers the native install dialog
 *  - `platform`: quick check for iOS (which doesn't support beforeinstallprompt)
 */
export function usePWAInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  // Detect if already running as an installed PWA (standalone display mode).
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari uses a different media query.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  // iOS doesn't fire beforeinstallprompt — the user must use "Add to Home Screen"
  // manually from the Share sheet. We detect iOS Safari to show different UI.
  const isIOS =
    typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  useEffect(() => {
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      // Prevent the default browser prompt — we'll show our own button.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isStandalone]);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    // The prompt can only be used once; clear it either way.
    setDeferred(null);
  }, [deferred]);

  return {
    canInstall: Boolean(deferred) && !installed,
    installed,
    isIOS,
    promptInstall,
  };
}

/**
 * Minimal interface for the non-standard BeforeInstallPromptEvent.
 * Chrome/Edge support this; Firefox/Safari do not.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
