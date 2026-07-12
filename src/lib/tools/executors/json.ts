import 'server-only';

import type { ExecutorFn } from './index';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

const createJson: ExecutorFn = async (req) => {
  let data = req.data ?? req.content ?? '';

  // If content is a string, try to parse it as JSON
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      // Keep as string
    }
  }

  const json = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(json, 'utf-8');
  return {
    buffer,
    kind: 'json',
    mime: MIME_BY_KIND.json,
    ext: EXT_BY_KIND.json,
  };
};

export default createJson;
