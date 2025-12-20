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
// Counter for generating unique keys across all calls
let globalKeyCounter = 0;

function processLazyCookNodes(children: any, parentKey?: string): any {
  // Handle strings: apply branding
  if (typeof children === 'string') {
    const baseKey = parentKey || `str-${++globalKeyCounter}`;
    return children.split(/(LazyCook)/gi).map((part, i) => {
      const uniqueKey = `${baseKey}-${i}`;
      return part.toLowerCase() === 'lazycook' ? (
        <span key={`lazycook-${uniqueKey}`}>
          La<span className="lc-red-z">z</span>yCook
        </span>
      ) : (
        <React.Fragment key={`text-${uniqueKey}`}>{part}</React.Fragment>
      );
    });
  }

  // Handle numbers: convert to string and process
  if (typeof children === 'number') {
    return String(children);
  }

  // Handle arrays: recursively process each child and flatten results
  if (Array.isArray(children)) {
    const result: React.ReactNode[] = [];
    children.forEach((child, i) => {
      const childKey = parentKey ? `${parentKey}-${i}` : `arr-${++globalKeyCounter}-${i}`;
      // Preserve keys if child is a React element
      if (React.isValidElement(child)) {
        const existingKey = (child as React.ReactElement).key;
        const props = child.props as { children?: any };
        result.push(
          React.cloneElement(child as React.ReactElement<any>, {
            key: existingKey || `element-${childKey}`,
            children: processLazyCookNodes(props.children, childKey),
          } as any)
        );
      } else {
        const processed = processLazyCookNodes(child, childKey);
        // If processed result is an array, flatten it with keys
        if (Array.isArray(processed)) {
          processed.forEach((item, j) => {
            const itemKey = `${childKey}-${j}`;
            if (React.isValidElement(item)) {
              result.push(
                React.cloneElement(item, {
                  key: item.key || `array-${itemKey}`,
                } as any)
              );
            } else {
              result.push(
                <React.Fragment key={`array-${itemKey}`}>{item}</React.Fragment>
              );
            }
          });
        } else {
          result.push(
            <React.Fragment key={`item-${childKey}`}>{processed}</React.Fragment>
          );
        }
      }
    });
    return result;
  }

  // Handle React elements: preserve element, process children recursively
  if (React.isValidElement(children)) {
    // 🔥 CRITICAL: Preserve <a>, <strong>, <em> etc. but process their text content
    const existingKey = (children as React.ReactElement).key;
    const elementKey = existingKey || parentKey || `elem-${++globalKeyCounter}`;
    const props = children.props as { children?: any };
    return React.cloneElement(children as React.ReactElement<any>, {
      key: existingKey || elementKey,
      children: processLazyCookNodes(props.children, elementKey),
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
              h1: ({ children, ...props }) => (
                <h1 className="lc-md-h1" {...props}>
                  {processLazyCookNodes(children)}
                </h1>
              ),
              h2: ({ children, ...props }) => (
                <h2 className="lc-md-h2" {...props}>
                  {processLazyCookNodes(children)}
                </h2>
              ),
              h3: ({ children, ...props }) => {
                const processed = processLazyCookNodes(children);
                // If processed is an array, ensure all elements have keys
                if (Array.isArray(processed)) {
                  return (
                    <h3 className="lc-md-h3" {...props}>
                      {processed.map((item, idx) => {
                        if (React.isValidElement(item)) {
                          // Preserve existing key or add one
                          return React.cloneElement(item, {
                            key: item.key || `h3-child-${idx}`,
                          } as any);
                        }
                        return <React.Fragment key={`h3-frag-${idx}`}>{item}</React.Fragment>;
                      })}
                    </h3>
                  );
                }
                return (
                  <h3 className="lc-md-h3" {...props}>
                    {processed}
                  </h3>
                );
              },
              h4: ({ children, ...props }) => (
                <h4 className="lc-md-h4" {...props}>
                  {processLazyCookNodes(children)}
                </h4>
              ),
              h5: ({ children, ...props }) => (
                <h5 className="lc-md-h5" {...props}>
                  {processLazyCookNodes(children)}
                </h5>
              ),
              h6: ({ children, ...props }) => (
                <h6 className="lc-md-h6" {...props}>
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
