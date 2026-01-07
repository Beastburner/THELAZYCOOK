import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

/* ─────────────────────────────
   Types
───────────────────────────── */
type Highlight = {
  id: string;
  text: string;
  color: "yellow" | "blue" | "green" | "pink" | "purple";
  note?: string;
  createdAt: number;
  instanceIndex?: number; // Which occurrence of this text (0-based)
};

interface MarkdownContentProps {
  content: string;
  highlights?: Highlight[];
  onHighlightClick?: (text: string, event: React.MouseEvent) => void;
}

type Segment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language?: string };

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
        type: "text",
        value: input.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: "code",
      language: match[1],
      value: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({
      type: "text",
      value: input.slice(lastIndex),
    });
  }

  return segments;
}

/* ─────────────────────────────
   Helper: Convert children to string
───────────────────────────── */
function childrenToString(children: any): string {
  if (typeof children === "string") {
    return children;
  }
  if (typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map((child) => childrenToString(child)).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    // React element - extract children recursively
    return childrenToString(children.props?.children || "");
  }
  if (children && typeof children === "object" && "toString" in children) {
    return children.toString();
  }
  // Fallback: try to convert to string
  try {
    return String(children);
  } catch {
    return "";
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
  const urlRegex =
    /\b(https?:\/\/[^\s<>"{}|\\^`\[\]()]+(?:\/[^\s<>"{}|\\^`\[\]()]*)?|www\.[^\s<>"{}|\\^`\[\]()]+(?:\/[^\s<>"{}|\\^`\[\]()]*)?)/gi;

  text = text.replace(urlRegex, (url) => {
    // Remove trailing punctuation that shouldn't be part of URL
    const trailingPunct = /[.,;:!?]+$/;
    let cleanUrl = url;
    let trailing = "";
    const punctMatch = url.match(trailingPunct);
    if (punctMatch && !url.endsWith("/")) {
      cleanUrl = url.slice(0, -punctMatch[0].length);
      trailing = punctMatch[0];
    }

    const fullUrl = cleanUrl.startsWith("http")
      ? cleanUrl
      : `https://${cleanUrl}`;
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
   Extract all text content from an element (ignoring formatting tags)
   This helps find selections that span across bold, italic, etc.
───────────────────────────── */
function extractTextFromChildren(children: any): string {
  if (typeof children === "string") {
    return children;
  }
  if (typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map((child) => extractTextFromChildren(child)).join("");
  }
  if (React.isValidElement(children)) {
    return extractTextFromChildren(
      (children as React.ReactElement<{ children?: React.ReactNode }>).props
        ?.children
    );
  }
  return "";
}

/* ─────────────────────────────
   Process text nodes to apply highlights
   Returns React nodes with highlighted text wrapped in <mark> elements
   OPTIMIZED: Uses single-pass algorithm with early match detection
   IMPROVED: Handles text that might be split across formatting (bold, italic, etc.)
───────────────────────────── */
function processTextWithHighlights(
  text: string,
  highlights: Highlight[] = [],
  onHighlightClick?: (text: string, event: React.MouseEvent) => void
): React.ReactNode {
  if (!highlights || highlights.length === 0) {
    return text;
  }

  // Sort highlights by length (longest first) for proper handling of overlapping text
  const sortedHighlights = [...highlights].sort(
    (a, b) => b.text.length - a.text.length
  );

  // Build a lookup map with normalized (trimmed) keys and track instance counts
  const highlightLookup = new Map<string, Highlight[]>();
  const instanceCounters = new Map<string, number>(); // Track which instance we're on

  sortedHighlights.forEach((h) => {
    // Normalize highlight text: lowercase and collapse whitespace
    const key = h.text.toLowerCase().trim();
    if (!highlightLookup.has(key)) {
      highlightLookup.set(key, []);
      instanceCounters.set(key, 0);
    }
    highlightLookup.get(key)!.push(h);
  });

  const result: React.ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;

  // OPTIMIZED: Single-pass algorithm with early termination
  while (remaining.length > 0) {
    let earliestMatch: {
      idx: number;
      length: number;
      highlights: Highlight[];
      original: string;
      key: string;
    } | null = null;

    // Find the earliest match among all highlights in the remaining text
    for (const [key, hls] of highlightLookup) {
      // Simple case-insensitive matching without word boundaries
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escapedKey})`, "i");
      const match = remaining.match(regex);

      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.idx) {
          earliestMatch = {
            idx: match.index,
            length: match[0].length,
            highlights: hls,
            original: match[0],
            key,
          };
        }
      }
    }

    if (earliestMatch) {
      // Add text before the match
      if (earliestMatch.idx > 0) {
        result.push(remaining.substring(0, earliestMatch.idx));
      }

      // Increment instance counter for this key
      const currentInstance = instanceCounters.get(earliestMatch.key) || 0;
      instanceCounters.set(earliestMatch.key, currentInstance + 1);

      // Check each highlight to see if it matches this instance
      let hasMatchingHighlight = false;
      earliestMatch.highlights.forEach((highlight: Highlight) => {
        // Check if this highlight should be applied to this instance
        const shouldHighlight =
          highlight.instanceIndex === undefined || // Old highlights without instanceIndex (highlight all)
          highlight.instanceIndex === currentInstance; // New highlights with specific instance

        if (shouldHighlight) {
          hasMatchingHighlight = true;
          result.push(
            <mark
              key={`highlight-${keyCounter++}`}
              className={`lc-highlight lc-highlight-${highlight.color} ${
                highlight.note ? "has-note" : ""
              }`}
              data-highlight-text={highlight.text}
              data-highlight-id={highlight.id}
              data-highlight-note={highlight.note || ""}
              title={highlight.note || ""}
              style={{ userSelect: "text", WebkitUserSelect: "text" }}
            >
              {earliestMatch.original}
            </mark>
          );
        }
      });

      // If no matching highlight, just add the text
      if (!hasMatchingHighlight) {
        result.push(earliestMatch.original);
      }

      // Move to next portion of text
      remaining = remaining.substring(earliestMatch.idx + earliestMatch.length);
    } else {
      // No more matches found, add remaining text
      if (remaining.length > 0) {
        result.push(remaining);
      }
      break;
    }
  }

  // Return optimized result
  if (result.length === 0) {
    return null;
  }
  if (result.length === 1) {
    return result[0];
  }

  // Ensure all React elements have proper keys
  return result.map((node, idx) => {
    if (React.isValidElement(node) && node.key != null) {
      return node;
    }
    if (typeof node === "string") {
      return node;
    }
    if (React.isValidElement(node)) {
      return React.cloneElement(node, { key: `hl-${idx}` } as any);
    }
    return <React.Fragment key={`frag-${idx}`}>{node}</React.Fragment>;
  });
}

/* ─────────────────────────────
   Process React children to apply highlights to text nodes
   IMPROVED: Handles nested formatting elements (bold, italic, etc.)
───────────────────────────── */
function processChildrenWithHighlights(
  children: any,
  highlights: Highlight[] = [],
  onHighlightClick?: (text: string, event: React.MouseEvent) => void
): React.ReactNode {
  if (!highlights || highlights.length === 0) {
    return processLazyCookNodes(children);
  }

  // Process children recursively
  if (typeof children === "string") {
    return processTextWithHighlights(children, highlights, onHighlightClick);
  }

  if (Array.isArray(children)) {
    const processed = children.map((child, i) => {
      if (typeof child === "string") {
        const highlighted = processTextWithHighlights(
          child,
          highlights,
          onHighlightClick
        );
        // If it's already a fragment or element, return as-is, otherwise wrap
        if (
          React.isValidElement(highlighted) ||
          (highlighted &&
            typeof highlighted === "object" &&
            "type" in highlighted)
        ) {
          return highlighted;
        }
        return <React.Fragment key={`text-${i}`}>{highlighted}</React.Fragment>;
      }
      if (React.isValidElement(child)) {
        // For React elements (like <strong>, <em>, etc.), process their children
        const props = child.props as { children?: any };
        const processedChildren = processChildrenWithHighlights(
          props.children,
          highlights,
          onHighlightClick
        );

        // Preserve all original props while updating children
        return React.cloneElement(child, {
          key: child.key || `elem-${i}`,
          children: processedChildren,
        } as any);
      }
      return <React.Fragment key={`other-${i}`}>{child}</React.Fragment>;
    });
    return processed;
  }

  if (React.isValidElement(children)) {
    const props = children.props as { children?: any };
    const processedChildren = processChildrenWithHighlights(
      props.children,
      highlights,
      onHighlightClick
    );

    // Preserve all original props and element structure
    return React.cloneElement(children, {
      children: processedChildren,
    } as any);
  }

  return processLazyCookNodes(children);
}

/* ─────────────────────────────
   SAFE LazyCook branding (keeps links alive)
   Recursively processes nodes while preserving React elements
───────────────────────────── */
// Counter for generating unique keys across all calls
let globalKeyCounter = 0;

function processLazyCookNodes(children: any, parentKey?: string): any {
  // Handle strings: apply branding
  if (typeof children === "string") {
    const baseKey = parentKey || `str-${++globalKeyCounter}`;
    return children.split(/(LazyCook)/gi).map((part, i) => {
      const uniqueKey = `${baseKey}-${i}`;
      return part.toLowerCase() === "lazycook" ? (
        <span key={`lazycook-${uniqueKey}`}>
          La<span className="lc-red-z">z</span>yCook
        </span>
      ) : (
        <React.Fragment key={`text-${uniqueKey}`}>{part}</React.Fragment>
      );
    });
  }

  // Handle numbers: convert to string and process
  if (typeof children === "number") {
    return String(children);
  }

  // Handle arrays: recursively process each child and flatten results
  if (Array.isArray(children)) {
    const result: React.ReactNode[] = [];
    children.forEach((child, i) => {
      const childKey = parentKey
        ? `${parentKey}-${i}`
        : `arr-${++globalKeyCounter}-${i}`;
      // Preserve keys if child is a React element
      if (React.isValidElement(child)) {
        const existingKey = (child as React.ReactElement).key;
        const props = child.props as { children?: any };
        result.push(
          React.cloneElement(
            child as React.ReactElement<any>,
            {
              key: existingKey || `element-${childKey}`,
              children: processLazyCookNodes(props.children, childKey),
            } as any
          )
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
            <React.Fragment key={`item-${childKey}`}>
              {processed}
            </React.Fragment>
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
    return React.cloneElement(
      children as React.ReactElement<any>,
      {
        key: existingKey || elementKey,
        children: processLazyCookNodes(props.children, elementKey),
      } as any
    );
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
  highlights = [],
  onHighlightClick,
}: MarkdownContentProps) {
  const segments = splitContentIntoSegments(content);

  return (
    <div className="lc-response">
      {segments.map((seg, index) => {
        /* ───────── CODE ───────── */
        if (seg.type === "code") {
          return (
            <CodeBlock key={index} code={seg.value} language={seg.language} />
          );
        }

        /* ─────── RESEARCH ─────── */
        // Convert plain URLs to markdown links
        const processedValue = convertUrlsToLinks(seg.value);

        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children, ...props }) => {
                // Process children to apply highlights to text nodes
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return (
                  <p className="lc-md-p" {...props}>
                    {processed}
                  </p>
                );
              },
              mark: ({ children, className, ...props }) => {
                // Preserve highlight marks and add click handler if it's a highlight
                if (className?.includes("lc-highlight")) {
                  // Get highlight text and note from data attributes or children
                  const highlightText =
                    (props as any)["data-highlight-text"] ||
                    childrenToString(children);
                  const highlightNote =
                    (props as any)["data-highlight-note"] || "";
                  const hasNote =
                    highlightNote && highlightNote.trim().length > 0;
                  return (
                    <mark
                      className={`${className} ${hasNote ? "has-note" : ""}`}
                      {...(props as any)}
                      data-highlight-text={highlightText}
                      data-highlight-note={highlightNote}
                      title={hasNote ? highlightNote : ""}
                      style={{
                        cursor: "pointer",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                        ...((props as any).style || {}),
                      }}
                    >
                      {children}
                    </mark>
                  );
                }
                return <mark {...props}>{children}</mark>;
              },
              h1: ({ children, ...props }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return (
                  <h1 className="lc-md-h1" {...props}>
                    {processed}
                  </h1>
                );
              },
              h2: ({ children, ...props }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return (
                  <h2 className="lc-md-h2" {...props}>
                    {processed}
                  </h2>
                );
              },
              h3: ({ children, ...props }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
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
                        return (
                          <React.Fragment key={`h3-frag-${idx}`}>
                            {item}
                          </React.Fragment>
                        );
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
              h4: ({ children, ...props }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return (
                  <h4 className="lc-md-h4" {...props}>
                    {processed}
                  </h4>
                );
              },
              h5: ({ children, ...props }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return (
                  <h5 className="lc-md-h5" {...props}>
                    {processed}
                  </h5>
                );
              },
              h6: ({ children, ...props }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return (
                  <h6 className="lc-md-h6" {...props}>
                    {processed}
                  </h6>
                );
              },
              strong: ({ children }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return <strong className="lc-md-strong">{processed}</strong>;
              },
              em: ({ children }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return <em className="lc-md-em">{processed}</em>;
              },
              code: ({ children }) => {
                const text = childrenToString(children);
                return <code className="lc-md-code-inline">{text}</code>;
              },
              blockquote: ({ children }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return (
                  <blockquote className="lc-md-blockquote">
                    {processed}
                  </blockquote>
                );
              },
              li: ({ children }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return <li className="lc-md-li">{processed}</li>;
              },
              a: ({ href, children }) => {
                const processed = processChildrenWithHighlights(
                  children,
                  highlights,
                  onHighlightClick
                );
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lc-md-a"
                  >
                    {processed}
                  </a>
                );
              },
            }}
          >
            {processedValue}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
