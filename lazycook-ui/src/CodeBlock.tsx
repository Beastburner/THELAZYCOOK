import { useState, useRef, useEffect } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export default function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousCodeRef = useRef<string>(code);

  // Update edited code when code prop changes (new code from AI)
  useEffect(() => {
    // Only reset if the code prop has actually changed (new code from AI)
    if (code !== previousCodeRef.current) {
      setEditedCode(code);
      setSavedCode(null); // Clear saved edits when new code arrives
      previousCodeRef.current = code;
    }
  }, [code]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleCopy = async () => {
    const textToCopy = isEditing ? editedCode : (savedCode || code);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  const handleDownload = () => {
    const textToDownload = isEditing ? editedCode : (savedCode || code);
    try {
      const extension = getFileExtension(language || 'txt');
      const filename = `generated_code.${extension}`;
      
      const blob = new Blob([textToDownload], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback: show error or suggest manual copy
      alert('Download failed. Please copy the code manually.');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setSavedCode(editedCode); // Save the edited code
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCode(savedCode || code); // Revert to saved code or original
    setIsEditing(false);
  };

  const isProgrammingLanguage = (lang?: string): boolean => {
    if (!lang) return false;
    const programmingLanguages = [
      'python', 'py',
      'javascript', 'js',
      'typescript', 'ts',
      'jsx', 'tsx',
      'java',
      'cpp', 'c', 'cxx', 'cc',
      'cs', 'csharp',
      'php',
      'ruby', 'rb',
      'go', 'golang',
      'rust', 'rs',
      'swift',
      'kotlin', 'kt',
      'scala',
      'dart',
      'r',
      'matlab',
      'perl', 'pl',
      'lua',
      'bash', 'sh', 'shell', 'zsh',
      'powershell', 'ps1',
      'sql',
      'r', 'rscript',
    ];
    return programmingLanguages.includes(lang.toLowerCase());
  };

  const getFileExtension = (lang: string): string => {
    const extensionMap: Record<string, string> = {
      'python': 'py',
      'py': 'py',
      'javascript': 'js',
      'js': 'js',
      'typescript': 'ts',
      'ts': 'ts',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'xml': 'xml',
      'yaml': 'yml',
      'yml': 'yml',
      'markdown': 'md',
      'md': 'md',
      'bash': 'sh',
      'sh': 'sh',
      'shell': 'sh',
      'sql': 'sql',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'cs',
      'php': 'php',
      'ruby': 'rb',
      'go': 'go',
      'rust': 'rs',
      'swift': 'swift',
      'kotlin': 'kt',
      'dockerfile': 'dockerfile',
      'docker': 'dockerfile',
    };
    return extensionMap[lang.toLowerCase()] || 'txt';
  };

  const showDownloadEdit = isProgrammingLanguage(language);

  // Use saved code if available, otherwise use original code
  const displayCode = isEditing ? editedCode : (savedCode || code);

  return (
    <div className="lc-code-block-wrapper">
      <div className="lc-code-block-header">
        {language && (
          <span className="lc-code-block-language">{language}</span>
        )}
        <div className="lc-code-block-actions">
          <button
            className={`lc-code-block-btn lc-code-block-btn-copy ${copyStatus === 'copied' ? 'is-copied' : copyStatus === 'error' ? 'is-error' : ''}`}
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
            tabIndex={0}
            title={copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Copy failed' : 'Copy code'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-copy-icon">
              <path d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.5 2H12.5C13.3284 2 14 2.67157 14 3.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.5 2C5.5 1.72386 5.72386 1.5 6 1.5H12.5C12.7761 1.5 13 1.72386 13 2V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Copy code</span>
          </button>
          {showDownloadEdit && (
            <>
              <button
                className="lc-code-block-btn lc-code-block-btn-download"
                onClick={handleDownload}
                aria-label="Download code as file"
                tabIndex={0}
                title="Download"
              >
                ⬇ Download
              </button>
              {!isEditing ? (
                <button
                  className="lc-code-block-btn lc-code-block-btn-edit"
                  onClick={handleEdit}
                  aria-label="Edit code block"
                  tabIndex={0}
                  title="Edit"
                >
                  ✏ Edit
                </button>
              ) : (
                <>
                  <button
                    className="lc-code-block-btn lc-code-block-btn-save"
                    onClick={handleSave}
                    aria-label="Save edits"
                    tabIndex={0}
                    title="Save"
                  >
                    ✓ Save
                  </button>
                  <button
                    className="lc-code-block-btn lc-code-block-btn-cancel"
                    onClick={handleCancel}
                    aria-label="Cancel editing"
                    tabIndex={0}
                    title="Cancel"
                  >
                    ✗ Cancel
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="lc-code-block-editable"
          value={editedCode}
          onChange={(e) => setEditedCode(e.target.value)}
          aria-label="Editable code block"
          role="textbox"
          spellCheck={false}
          tabIndex={0}
        />
      ) : (
        <pre className="lc-md-pre">
          <code className={`lc-md-code-block ${className || ''}`}>
            {displayCode}
          </code>
        </pre>
      )}
      {copyStatus === 'error' && (
        <div className="lc-code-block-error" role="alert">
          Copy failed. Please copy manually or try again.
        </div>
      )}
    </div>
  );
}

