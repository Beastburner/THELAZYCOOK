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
              p: ({ children }) => (
                <p className="lc-md-p">
                  {processLazyCookText(String(children))}
                </p>
              ),
              h1: ({ children }) => (
                <h1 className="lc-md-h1">
                  {processLazyCookText(String(children))}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="lc-md-h2">
                  {processLazyCookText(String(children))}
                </h2>
              ),
              strong: ({ children }) => (
                <strong className="lc-md-strong">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="lc-md-em">{children}</em>
              ),
              code: ({ children }) => (
                <code className="lc-md-code-inline">{children}</code>
              ),
              blockquote: ({ children }) => (
                <blockquote className="lc-md-blockquote">
                  {children}
                </blockquote>
              ),
            }}
          >
            {seg.value}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
