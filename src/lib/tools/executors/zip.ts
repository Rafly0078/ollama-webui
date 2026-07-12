import 'server-only';

import JSZip from 'jszip';
import type { ExecutorFn } from './index';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

const zipProject: ExecutorFn = async (req) => {
  const zip = new JSZip();
  const files = req.files ?? [];

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  // If no files provided, create a placeholder
  if (files.length === 0) {
    zip.file('README.md', req.content ?? '# Project\n\nEmpty project.');
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
  return {
    buffer,
    kind: 'zip',
    mime: MIME_BY_KIND.zip,
    ext: EXT_BY_KIND.zip,
  };
};

export default zipProject;
