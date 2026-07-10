'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Renders a Mermaid diagram from source. Mermaid is loaded lazily (dynamic
 * import) so it never touches the initial bundle — it only downloads when a
 * diagram actually appears in a message.
 */
export function Mermaid({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily: 'var(--font-sans)',
        });
        const { svg } = await mermaid.render(`mermaid-${id}`, code.trim());
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to render diagram');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="my-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Couldn&apos;t render Mermaid diagram</p>
          <pre className="mt-1 overflow-x-auto text-xs text-warning/70">{code}</pre>
        </div>
      </div>
    );
  }

  if (!svg) {
    return <div className="my-4 h-32 animate-pulse rounded-xl border border-border bg-border/5" />;
  }

  return (
    <div
      ref={ref}
      className="my-4 flex justify-center overflow-x-auto rounded-xl border border-border bg-border/[0.02] p-4"
      // Mermaid output is sanitized (securityLevel: 'strict').
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
