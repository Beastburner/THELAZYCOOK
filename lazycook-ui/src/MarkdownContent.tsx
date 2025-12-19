import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

interface MarkdownContentProps {
  content: string;
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ node, ...props }) => <h1 className="lc-md-h1" {...props} />,
        h2: ({ node, ...props }) => <h2 className="lc-md-h2" {...props} />,
        h3: ({ node, ...props }) => <h3 className="lc-md-h3" {...props} />,
        h4: ({ node, ...props }) => <h4 className="lc-md-h4" {...props} />,
        h5: ({ node, ...props }) => <h5 className="lc-md-h5" {...props} />,
        h6: ({ node, ...props }) => <h6 className="lc-md-h6" {...props} />,
        
        // Paragraphs
        p: ({ node, ...props }) => <p className="lc-md-p" {...props} />,
        
        // Lists
        ul: ({ node, ...props }) => <ul className="lc-md-ul" {...props} />,
        ol: ({ node, ...props }) => <ol className="lc-md-ol" {...props} />,
        li: ({ node, ...props }) => <li className="lc-md-li" {...props} />,
        
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
        th: ({ node, ...props }) => <th className="lc-md-th" {...props} />,
        td: ({ node, ...props }) => <td className="lc-md-td" {...props} />,
        
        // Blockquote
        blockquote: ({ node, ...props }) => <blockquote className="lc-md-blockquote" {...props} />,
        
        // Horizontal rule
        hr: ({ node, ...props }) => <hr className="lc-md-hr" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

