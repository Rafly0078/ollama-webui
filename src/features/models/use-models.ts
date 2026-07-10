'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ModelInfo } from '@/types';
import { fetchModels } from '@/lib/api/client';
import { ApiError, apiConfigured } from '@/lib/api/config';

interface ModelsState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Module-level cache so switching routes doesn't refetch every mount.
let cache: ModelInfo[] | null = null;

export function useModels(): ModelsState {
  const [models, setModels] = useState<ModelInfo[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!apiConfigured()) {
      setError('Set NEXT_PUBLIC_API_URL to a reachable API (not localhost) to load models.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchModels(signal);
      cache = list;
      setModels(list);
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'aborted') return;
      setError(err instanceof ApiError ? err.userMessage : 'Failed to load models.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    if (!cache) void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const reload = useCallback(() => {
    cache = null;
    void load();
  }, [load]);

  return { models, loading, error, reload };
}
