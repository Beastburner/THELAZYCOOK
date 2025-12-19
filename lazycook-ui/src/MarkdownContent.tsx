import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

interface MarkdownContentProps {
  content: string;
}

// Function to replace LazyCook with styled version in text
function processLazyCookText(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  const regex = /LazyCook/gi;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Add styled LazyCook
    parts.push(
      <span key={`lazycook-${key++}`}>
        La<span className="lc-red-z">z</span>yCook
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <h1 className="lc-md-h1" {...props}>{processedChildren}</h1>;
        },
        h2: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <h2 className="lc-md-h2" {...props}>{processedChildren}</h2>;
        },
        h3: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <h3 className="lc-md-h3" {...props}>{processedChildren}</h3>;
        },
        h4: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <h4 className="lc-md-h4" {...props}>{processedChildren}</h4>;
        },
        h5: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <h5 className="lc-md-h5" {...props}>{processedChildren}</h5>;
        },
        h6: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <h6 className="lc-md-h6" {...props}>{processedChildren}</h6>;
        },
        
        // Paragraphs
        p: ({ node, children, ...props }: any) => {
          // Process children to replace LazyCook
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <p className="lc-md-p" {...props}>{processedChildren}</p>;
        },
        
        // Lists
        ul: ({ node, ...props }) => <ul className="lc-md-ul" {...props} />,
        ol: ({ node, ...props }) => <ol className="lc-md-ol" {...props} />,
        li: ({ node, children, ...props }: any) => {
          // Process children to replace LazyCook
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <li className="lc-md-li" {...props}>{processedChildren}</li>;
        },
        
        // Code blocks
        code: ({ node, inline, className, children, ...props }: any) => {
          if (inline) {
            return (
              <code className="lc-md-code-inline" {...props}>
                {children}
              </code>
            );
          }
          // For code blocks (not inline), extract language and content
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : undefined;
          // Extract code string, handling both string and array children
          const codeString = Array.isArray(children)
            ? children.map((c: any) => (typeof c === 'string' ? c : String(c))).join('')
            : String(children).replace(/\n$/, '');
          
          // Determine if this should be a full code block or just inline code
          // Only show full code block for substantial code:
          const trimmedCode = codeString.trim();
          const lines = trimmedCode.split('\n').filter(line => line.trim().length > 0);
          const hasMultipleLines = lines.length > 1;
          
          // Check for simple patterns that should NOT be code blocks (render as inline):
          // - Single variable assignment: "n=0", "x=1", "count = 5", etc.
          // - Single function call: "fib(3)", "func()", "method(arg)", etc.
          // - Simple comparison: "n > 1", "x < 5", "y >= 10", etc.
          // - Single identifier: "RecursionError", "Error", "MyClass", etc.
          // - Simple expressions: "n-1", "n-2", "x+1", etc.
          const isSimpleAssignment = /^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^=].*$/.test(trimmedCode) && trimmedCode.length < 30;
          const isSimpleFunctionCall = /^[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*$/.test(trimmedCode) && trimmedCode.length < 50;
          const isSimpleComparison = /^[a-zA-Z_][a-zA-Z0-9_]*\s*[<>!=]+\s*[^<>=].*$/.test(trimmedCode) && trimmedCode.length < 30;
          const isSimpleIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*\s*$/.test(trimmedCode) && trimmedCode.length < 50;
          const isSimpleExpression = /^[a-zA-Z_][a-zA-Z0-9_]*\s*[+\-*/]\s*[0-9a-zA-Z_].*$/.test(trimmedCode) && trimmedCode.length < 30;
          
          const isSimplePattern = isSimpleAssignment || isSimpleFunctionCall || isSimpleComparison || isSimpleIdentifier || isSimpleExpression;
          
          // Check for actual code patterns (function definitions, imports, control structures, etc.)
          const hasRealCodePatterns = /^(def |function |class |import |from |const |let |var |return |if |for |while |async |await |export |public |private |protected |@|#include|#define|package |namespace |try |catch |finally |switch |case |default )|=>|->|::|=>\s*\{|function\s*\(|=>\s*\(/.test(trimmedCode);
          
          // Check for code structure (indentation, multiple statements, etc.)
          const hasCodeStructure = lines.some(line => /^\s{2,}/.test(line)) || // Has indentation
                                   (trimmedCode.includes(';') && lines.length > 1) || // Multiple statements
                                   (/\{[\s\S]{10,}\}|\[[\s\S]{10,}\]/.test(trimmedCode)); // Has substantial code blocks/arrays
          
          // Only show full code block for substantial code:
          // - Has multiple lines (2+) AND is not a simple pattern, OR
          // - Is long enough (100+ chars) AND not a simple pattern, OR
          // - Has real code patterns (definitions, imports, etc.) AND not a simple pattern, OR
          // - Has code structure (indentation, multiple statements)
          const isSubstantialCode = !isSimplePattern && (
            (hasMultipleLines && trimmedCode.length > 20) ||
            trimmedCode.length > 100 ||
            (hasRealCodePatterns && trimmedCode.length > 30) ||
            hasCodeStructure
          );
          
          // If it's not substantial code, render as inline code instead
          if (!isSubstantialCode) {
            return (
              <code className="lc-md-code-inline" {...props}>
                {trimmedCode}
              </code>
            );
          }
          
          return (
            <CodeBlock
              code={codeString}
              language={language}
              className={className}
            />
          );
        },
        pre: ({ node, children, ...props }: any) => {
          // Pre blocks are handled by the code component
          // This should not be reached for code blocks, but handle it gracefully
          return <pre className="lc-md-pre" {...props}>{children}</pre>;
        },
        
        // Text formatting
        strong: ({ node, ...props }) => <strong className="lc-md-strong" {...props} />,
        em: ({ node, ...props }) => <em className="lc-md-em" {...props} />,
        
        // Links
        a: ({ node, ...props }) => <a className="lc-md-a" target="_blank" rel="noopener noreferrer" {...props} />,
        
        // Tables
        table: ({ node, ...props }) => (
          <div className="lc-md-table-wrapper">
            <table className="lc-md-table" {...props} />
          </div>
        ),
        thead: ({ node, ...props }) => <thead className="lc-md-thead" {...props} />,
        tbody: ({ node, ...props }) => <tbody className="lc-md-tbody" {...props} />,
        tr: ({ node, ...props }) => <tr className="lc-md-tr" {...props} />,
        th: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <th className="lc-md-th" {...props}>{processedChildren}</th>;
        },
        td: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <td className="lc-md-td" {...props}>{processedChildren}</td>;
        },
        
        // Blockquote
        blockquote: ({ node, children, ...props }: any) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              const parts = processLazyCookText(child);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
            }
            return child;
          });
          return <blockquote className="lc-md-blockquote" {...props}>{processedChildren}</blockquote>;
        },
        
        // Horizontal rule
        hr: ({ node, ...props }) => <hr className="lc-md-hr" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

