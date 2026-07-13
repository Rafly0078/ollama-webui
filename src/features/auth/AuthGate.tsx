'use client';

import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { AuthDialog } from './AuthDialog';

/**
 * App-wide login wall. Renders the app underneath as usual, but pops a
 * mandatory sign-in dialog on top whenever Supabase is configured and there
 * is no authenticated user — guest sessions included, since the whole point
 * is that every real visitor has to sign in. The dialog can't be dismissed;
 * it disappears on its own the moment `isAuthenticated` flips true.
 *
 * No-ops entirely when Supabase isn't configured (`auth.enabled === false`),
 * so local/dev deployments without env vars keep working guest-only.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  // First session check on load — avoid flashing the sign-in popup (or the
  // app) before we actually know whether there's a valid session.
  if (auth.enabled && auth.loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-surface">
        <Loader2 className="h-6 w-6 animate-spin text-content-subtle" aria-label="Checking session" />
      </div>
    );
  }

  const requireSignIn = auth.enabled && !auth.isAuthenticated;

  return (
    <>
      {children}
      <AuthDialog open={requireSignIn} onClose={() => {}} mandatory />
    </>
  );
}
