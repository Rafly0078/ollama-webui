'use client';

import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';
import { ThemeManager } from './theme-manager';
import { ToastProvider } from '@/components/ui/toast';

/**
 * Client providers. LazyMotion loads only the animation features we use,
 * shrinking the Framer Motion runtime for a better mobile bundle.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ThemeManager>
          <ToastProvider>{children}</ToastProvider>
        </ThemeManager>
      </MotionConfig>
    </LazyMotion>
  );
}
