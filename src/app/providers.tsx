'use client';

import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';
import { ThemeManager } from './theme-manager';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { AuthGate } from '@/features/auth/AuthGate';

/**
 * Client providers. LazyMotion loads only the animation features we use,
 * shrinking the Framer Motion runtime for a better mobile bundle.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ThemeManager>
          <AuthProvider>
            <ToastProvider>
              <AuthGate>{children}</AuthGate>
            </ToastProvider>
          </AuthProvider>
        </ThemeManager>
      </MotionConfig>
    </LazyMotion>
  );
}
