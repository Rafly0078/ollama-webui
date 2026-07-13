import 'server-only';

import JSZip from 'jszip';
import type { ExecutorFn } from './index';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

const zipProject: ExecutorFn = async (req) => {
  const zip = new JSZip();
  const files = req.files ?? [];

  for (const file of files) {
    // Normalize paths: strip leading slashes and collapse .. so a stray path
    // can't try to escape the archive root.
    const path = file.path.replace(/^[/\\]+/, '').replace(/\.\.[/\\]/g, '');
    if (path) zip.file(path, file.content ?? '');
  }

  if (files.length === 0) {
    zip.file('README.md', req.content ?? '# Project\n\nEmpty project.');
  }

  // DEFLATE compression — the previous default stored files uncompressed, so a
  // text-heavy bundle was needlessly large.
  const buffer = Buffer.from(
    await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
  );
  return { buffer, kind: 'zip', mime: MIME_BY_KIND.zip, ext: EXT_BY_KIND.zip };
};

export default zipProject;
