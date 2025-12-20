import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

/* ─────────────────────────────
   Types
───────────────────────────── */
interface MarkdownContentProps {
  content: string;
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string; language?: string };

/* ─────────────────────────────
   Segment classifier
   (THIS is the core fix)
───────────────────────────── */
function splitContentIntoSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: input.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: 'code',
      language: match[1],
      value: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({
      type: 'text',
      value: input.slice(lastIndex),
    });
  }

  return segments;
}

/* ─────────────────────────────
   Helper: Convert children to string
───────────────────────────── */
function childrenToString(children: any): string {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(child => childrenToString(child)).join('');
  }
  if (children && typeof children === 'object' && 'props' in children) {
    // React element - extract children recursively
    return childrenToString(children.props?.children || '');
  }
  if (children && typeof children === 'object' && 'toString' in children) {
    return children.toString();
  }
  // Fallback: try to convert to string
  try {
    return String(children);
  } catch {
    return '';
  }
}

/* ─────────────────────────────
   LazyCook branding
───────────────────────────── */
function processLazyCookText(text: string) {
  return text.split(/(LazyCook)/gi).map((part, i) =>
    part.toLowerCase() === 'lazycook' ? (
      <span key={i}>
        La<span className="lc-red-z">z</span>yCook
      </span>
    ) : (
      part
    )
  );
}

/* ─────────────────────────────
   Component
───────────────────────────── */
export default function MarkdownContent({
  content,
}: MarkdownContentProps) {
  const segments = splitContentIntoSegments(content);

  return (
    <div className="lc-response">
      {segments.map((seg, index) => {
        /* ───────── CODE ───────── */
        if (seg.type === 'code') {
          return (
            <CodeBlock
              key={index}
              code={seg.value}
              language={seg.language}
            />
          );
        }

        /* ─────── RESEARCH ─────── */
        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <p className="lc-md-p">
                    {processLazyCookText(text)}
                  </p>
                );
              },
              h1: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <h1 className="lc-md-h1">
                    {processLazyCookText(text)}
                  </h1>
                );
              },
              h2: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <h2 className="lc-md-h2">
                    {processLazyCookText(text)}
                  </h2>
                );
              },
              h3: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <h3 className="lc-md-h3">
                    {processLazyCookText(text)}
                  </h3>
                );
              },
              h4: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <h4 className="lc-md-h4">
                    {processLazyCookText(text)}
                  </h4>
                );
              },
              h5: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <h5 className="lc-md-h5">
                    {processLazyCookText(text)}
                  </h5>
                );
              },
              h6: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <h6 className="lc-md-h6">
                    {processLazyCookText(text)}
                  </h6>
                );
              },
              strong: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <strong className="lc-md-strong">
                    {processLazyCookText(text)}
                  </strong>
                );
              },
              em: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <em className="lc-md-em">
                    {processLazyCookText(text)}
                  </em>
                );
              },
              code: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <code className="lc-md-code-inline">{text}</code>
                );
              },
              blockquote: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <blockquote className="lc-md-blockquote">
                    {processLazyCookText(text)}
                  </blockquote>
                );
              },
              li: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <li className="lc-md-li">
                    {processLazyCookText(text)}
                  </li>
                );
              },
            }}
          >
            {seg.value}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
