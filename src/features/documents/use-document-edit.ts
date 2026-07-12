'use client';

import { useCallback, useState } from 'react';
import type { Artifact, GenerateRequest } from '@/lib/tools/types';
import { useChatStore } from '@/lib/store/chat-store';

export interface DocumentEditState {
  /** The original uploaded file */
  originalFile: File | null;
  /** Extracted text content from the file */
  extractedContent: string;
  /** AI-improved content */
  improvedContent: string;
  /** Generated artifact from the improved content */
  generatedArtifact: Artifact | null;
  /** Current step in the flow */
  step: 'idle' | 'extracting' | 'extracted' | 'improving' | 'improved' | 'generating' | 'done' | 'error';
  /** Error message if something failed */
  error: string | null;
}

export function useDocumentEdit(conversationId: string | null) {
  const [state, setState] = useState<DocumentEditState>({
    originalFile: null,
    extractedContent: '',
    improvedContent: '',
    generatedArtifact: null,
    step: 'idle',
    error: null,
  });

  const extractContent = useCallback(async (file: File) => {
    setState((s) => ({ ...s, originalFile: file, step: 'extracting', error: null }));

    try {
      const text = await extractFileContent(file);
      if (!text.trim()) {
        throw new Error(`Could not extract text from "${file.name}". The file may be empty or unsupported.`);
      }
      setState((s) => ({ ...s, extractedContent: text, step: 'extracted' }));
    } catch (err) {
      setState((s) => ({
        ...s,
        step: 'error',
        error: err instanceof Error ? err.message : 'Failed to extract file content',
      }));
    }
  }, []);

  const improveContent = useCallback(async (systemPrompt?: string) => {
    if (!conversationId || !state.extractedContent) return;

    setState((s) => ({ ...s, step: 'improving', error: null }));

    try {
      const prompt = systemPrompt
        ? `${systemPrompt}\n\nImprove and refine the following document content. Maintain the original structure and meaning while improving clarity, grammar, and formatting:\n\n${state.extractedContent}`
        : `Improve and refine the following document content. Maintain the original structure and meaning while improving clarity, grammar, and formatting:\n\n${state.extractedContent}`;

      const res = await fetch('/api/bridge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: useChatStore.getState().conversations.find((c) => c.id === conversationId)?.model ?? '',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
      });

      if (!res.ok) throw new Error('Failed to get AI improvement');

      const data = await res.json() as { message?: { content?: string }; response?: string };
      const improved = data.message?.content ?? data.response ?? '';
      if (!improved) throw new Error('AI returned empty response');

      setState((s) => ({ ...s, improvedContent: improved, step: 'improved' }));
    } catch (err) {
      setState((s) => ({
        ...s,
        step: 'error',
        error: err instanceof Error ? err.message : 'Failed to improve content',
      }));
    }
  }, [conversationId, state.extractedContent]);

  const generateDocument = useCallback(async (opts: {
    tool: GenerateRequest['tool'];
    name?: string;
    title?: string;
  }) => {
    setState((s) => ({ ...s, step: 'generating', error: null }));

    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: opts.tool,
          name: opts.name,
          title: opts.title,
          content: state.improvedContent || state.extractedContent,
          conversationId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(body.error ?? 'Document generation failed');
      }

      const { artifact } = (await res.json()) as { artifact: Artifact };
      setState((s) => ({ ...s, generatedArtifact: artifact, step: 'done' }));
    } catch (err) {
      setState((s) => ({
        ...s,
        step: 'error',
        error: err instanceof Error ? err.message : 'Failed to generate document',
      }));
    }
  }, [state.improvedContent, state.extractedContent, conversationId]);

  const reset = useCallback(() => {
    setState({
      originalFile: null,
      extractedContent: '',
      improvedContent: '',
      generatedArtifact: null,
      step: 'idle',
      error: null,
    });
  }, []);

  return { ...state, extractContent, improveContent, generateDocument, reset };
}

/** Extract text content from a file using the browser. */
async function extractFileContent(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  // Plain text / code / markdown
  if (['txt', 'md', 'csv', 'json', 'log', 'xml', 'yaml', 'yml', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'sh', 'html', 'css'].includes(ext) || file.type.startsWith('text/')) {
    return file.text();
  }

  // PDF
  if (ext === 'pdf' || file.type === 'application/pdf') {
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      let out = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        out += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n\n';
      }
      return out.trim();
    } catch {
      return `[PDF "${file.name}" — could not extract text]`;
    }
  }

  // DOCX — extract raw XML and pull text from <w:t> tags
  if (ext === 'docx') {
    try {
      const JSZip = (await import('jszip')).default;
      const buf = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const xmlFile = zip.file('word/document.xml');
      if (!xmlFile) return '[DOCX: could not read document.xml]';
      const xml = await xmlFile.async('text');
      // Extract text between <w:t> tags
      const texts: string[] = [];
      const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        if (match[1]) texts.push(match[1]);
      }
      return texts.join(' ').trim() || '[DOCX: no text content found]';
    } catch {
      return `[DOCX "${file.name}" — could not extract text]`;
    }
  }

  // XLSX — extract cell values
  if (ext === 'xlsx') {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const lines: string[] = [];
      wb.eachSheet((ws) => {
        ws.eachRow((row) => {
          const vals = row.values as unknown[];
          const cells: string[] = [];
          for (let i = 1; i < vals.length; i++) {
            cells.push(vals[i] == null ? '' : String(vals[i]));
          }
          const line = cells.join(', ');
          if (line.trim()) lines.push(line);
        });
      });
      return lines.join('\n').trim() || '[XLSX: no data found]';
    } catch {
      return `[XLSX "${file.name}" — could not extract data]`;
    }
  }

  // PPTX — extract text from slide XML
  if (ext === 'pptx') {
    try {
      const JSZip = (await import('jszip')).default;
      const buf = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const texts: string[] = [];
      const slideFiles = Object.keys(zip.files).filter((f) => f.match(/^ppt\/slides\/slide\d+\.xml$/));
      for (const slideFile of slideFiles) {
        const file = zip.file(slideFile);
        if (file) {
          const xml = await file.async('text');
          const regex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
          let match;
          while ((match = regex.exec(xml)) !== null) {
            if (match[1]) texts.push(match[1]);
          }
          texts.push('---'); // slide separator
        }
      }
      return texts.join('\n').trim() || '[PPTX: no text content found]';
    } catch {
      return `[PPTX "${file.name}" — could not extract text]`;
    }
  }

  // CSV
  if (ext === 'csv') {
    return file.text();
  }

  // Fallback: try reading as text
  return file.text().catch(() => `[${ext.toUpperCase()}: could not read file content]`);
}
