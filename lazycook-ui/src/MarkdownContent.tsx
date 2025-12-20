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
   Convert plain URLs to markdown links
   Production-safe: protects existing links, handles edge cases
───────────────────────────── */
function convertUrlsToLinks(text: string): string {
  // Step 1: Protect existing markdown links [text](url)
  const protectedLinks: string[] = [];
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match) => {
    protectedLinks.push(match);
    return `@@PROTECTED_LINK_${protectedLinks.length - 1}@@`;
  });

  // Step 2: Protect URLs already in angle brackets <url>
  const protectedAngles: string[] = [];
  text = text.replace(/<([^>]+)>/g, (match, url) => {
    // Only protect if it looks like a URL
    if (/^https?:\/\//i.test(url) || /^www\./i.test(url)) {
      protectedAngles.push(match);
      return `@@PROTECTED_ANGLE_${protectedAngles.length - 1}@@`;
    }
    return match;
  });

  // Step 3: Convert plain URLs to markdown links
  // Matches: http://..., https://..., www.example.com
  // Excludes: trailing punctuation (handled separately)
  const urlRegex = /\b(https?:\/\/[^\s<>"{}|\\^`\[\]()]+(?:\/[^\s<>"{}|\\^`\[\]()]*)?|www\.[^\s<>"{}|\\^`\[\]()]+(?:\/[^\s<>"{}|\\^`\[\]()]*)?)/gi;
  
  text = text.replace(urlRegex, (url) => {
    // Remove trailing punctuation that shouldn't be part of URL
    const trailingPunct = /[.,;:!?]+$/;
    let cleanUrl = url;
    let trailing = '';
    const punctMatch = url.match(trailingPunct);
    if (punctMatch && !url.endsWith('/')) {
      cleanUrl = url.slice(0, -punctMatch[0].length);
      trailing = punctMatch[0];
    }
    
    const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
    return `[${cleanUrl}](${fullUrl})${trailing}`;
  });

  // Step 4: Restore protected angle brackets
  protectedAngles.forEach((angle, i) => {
    text = text.replace(`@@PROTECTED_ANGLE_${i}@@`, angle);
  });

  // Step 5: Restore protected markdown links
  protectedLinks.forEach((link, i) => {
    text = text.replace(`@@PROTECTED_LINK_${i}@@`, link);
  });

  return text;
}

/* ─────────────────────────────
   SAFE LazyCook branding (keeps links alive)
   Recursively processes nodes while preserving React elements
───────────────────────────── */
function processLazyCookNodes(children: any): any {
  // Handle strings: apply branding
  if (typeof children === 'string') {
    return children.split(/(LazyCook)/gi).map((part, i) =>
      part.toLowerCase() === 'lazycook' ? (
        <span key={i}>
          La<span className="lc-red-z">z</span>yCook
        </span>
      ) : (
        part
      )
    );
  }

  // Handle numbers: convert to string and process
  if (typeof children === 'number') {
    return String(children);
  }

  // Handle arrays: recursively process each child
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      // Preserve keys if child is a React element
      if (React.isValidElement(child)) {
        const props = child.props as { children?: any };
        return React.cloneElement(child as React.ReactElement<any>, {
          children: processLazyCookNodes(props.children),
        } as any);
      }
      return (
        <React.Fragment key={i}>
          {processLazyCookNodes(child)}
        </React.Fragment>
      );
    });
  }

  // Handle React elements: preserve element, process children recursively
  if (React.isValidElement(children)) {
    // 🔥 CRITICAL: Preserve <a>, <strong>, <em> etc. but process their text content
    const props = children.props as { children?: any };
    return React.cloneElement(children as React.ReactElement<any>, {
      children: processLazyCookNodes(props.children),
    } as any);
  }

  // Handle null/undefined
  if (children == null) {
    return children;
  }

  // Fallback: return as-is (shouldn't happen in normal flow)
  return children;
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
        // Convert plain URLs to markdown links before rendering
        const processedValue = convertUrlsToLinks(seg.value);
        
        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <p className="lc-md-p">
                  {processLazyCookNodes(children)}
                </p>
              ),
              h1: ({ children }) => (
                <h1 className="lc-md-h1">
                  {processLazyCookNodes(children)}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="lc-md-h2">
                  {processLazyCookNodes(children)}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="lc-md-h3">
                  {processLazyCookNodes(children)}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="lc-md-h4">
                  {processLazyCookNodes(children)}
                </h4>
              ),
              h5: ({ children }) => (
                <h5 className="lc-md-h5">
                  {processLazyCookNodes(children)}
                </h5>
              ),
              h6: ({ children }) => (
                <h6 className="lc-md-h6">
                  {processLazyCookNodes(children)}
                </h6>
              ),
              strong: ({ children }) => (
                <strong className="lc-md-strong">
                  {processLazyCookNodes(children)}
                </strong>
              ),
              em: ({ children }) => (
                <em className="lc-md-em">
                  {processLazyCookNodes(children)}
                </em>
              ),
              code: ({ children }) => {
                const text = childrenToString(children);
                return (
                  <code className="lc-md-code-inline">{text}</code>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className="lc-md-blockquote">
                  {processLazyCookNodes(children)}
                </blockquote>
              ),
              li: ({ children }) => (
                <li className="lc-md-li">
                  {processLazyCookNodes(children)}
                </li>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lc-md-a"
                >
                  {children}
                </a>
              ),
            }}
          >
            {processedValue}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
