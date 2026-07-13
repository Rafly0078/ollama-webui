'use client';

// Heavy markdown pipeline. This whole module (react-markdown + remark/rehype +
// KaTeX + highlight.js, and their CSS) is code-split behind a next/dynamic
// boundary in ./Markdown, so none of it touches the initial bundle or FCP.
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import { Mermaid } from './Mermaid';

/** Minimal structural type for a hast node — avoids a hard dep on `hast` types. */
interface HastNode {
  type: string;
  value?: string;
  children?: HastNode[];
}

/** Recursively extract raw text from a hast node (for the copy button + mermaid). */
function nodeToString(node?: HastNode): string {
  if (!node) return '';
  let out = '';
  for (const child of node.children ?? []) {
    if (child.type === 'text') out += child.value ?? '';
    else if (child.type === 'element') out += nodeToString(child);
  }
  return out;
}

const components: Components = {
  // Let our CodeBlock own the <pre>; unwrap the default one.
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children, node, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '');
    const raw = nodeToString(node as HastNode);
    const isBlock = Boolean(match) || raw.includes('\n');

    if (!isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    const lang = match?.[1];
    if (lang === 'mermaid') {
      return <Mermaid code={raw} />;
    }

    return (
      <CodeBlock language={lang} raw={raw}>
        <code className={className}>{children}</code>
      </CodeBlock>
    );
  },
  a({ children, href, ...props }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="table-wrap">
        <table>{children}</table>
      </div>
    );
  },
};

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;
