import { useState, useRef, useEffect } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export default function CodeBlock({
  code,
  language,
  className,
}: CodeBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle'
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousCodeRef = useRef<string>(code);

  /* ─────────────────────────────
     Sync when new AI code arrives
  ───────────────────────────── */
  useEffect(() => {
    if (code !== previousCodeRef.current) {
      setEditedCode(code);
      setSavedCode(null);
      setIsEditing(false);
      previousCodeRef.current = code;
    }
  }, [code]);

  /* ─────────────────────────────
     Focus textarea on edit
  ───────────────────────────── */
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  /* ─────────────────────────────
     Helpers
  ───────────────────────────── */
  const getFileExtension = (lang?: string) => {
    const map: Record<string, string> = {
      js: 'js',
      javascript: 'js',
      ts: 'ts',
      typescript: 'ts',
      jsx: 'jsx',
      tsx: 'tsx',
      python: 'py',
      py: 'py',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cs: 'cs',
      php: 'php',
      go: 'go',
      rust: 'rs',
      swift: 'swift',
      kotlin: 'kt',
      bash: 'sh',
      sh: 'sh',
      shell: 'sh',
      powershell: 'ps1',
      ps1: 'ps1',
      json: 'json',
      yaml: 'yml',
      yml: 'yml',
      html: 'html',
      css: 'css',
      dockerfile: 'dockerfile',
      solidity: 'sol',
      sol: 'sol',
      ruby: 'rb',
      rb: 'rb',
      perl: 'pl',
      pl: 'pl',
      r: 'r',
      scala: 'scala',
      clojure: 'clj',
      clj: 'clj',
      lua: 'lua',
      dart: 'dart',
      elm: 'elm',
      haskell: 'hs',
      hs: 'hs',
      ocaml: 'ml',
      fsharp: 'fs',
      fs: 'fs',
      vb: 'vb',
      vbnet: 'vb',
      xml: 'xml',
      markdown: 'md',
      md: 'md',
      tex: 'tex',
      latex: 'tex',
      makefile: 'make',
      cmake: 'cmake',
      ini: 'ini',
      toml: 'toml',
      properties: 'properties',
      env: 'env',
      config: 'config',
      conf: 'conf',
    };
    return map[lang?.toLowerCase() || ''] || 'txt';
  };

  /* ─────────────────────────────
     Derived state
  ───────────────────────────── */
  const displayCode = isEditing
    ? editedCode
    : savedCode ?? code;

  // Enable download and edit for all code blocks
  const allowActions = true;

  /* ─────────────────────────────
     Actions
  ───────────────────────────── */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  const handleDownload = () => {
    try {
      const ext = getFileExtension(language);
      const blob = new Blob([displayCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `generated_code.${ext}`;
      a.style.display = 'none';
      
      // Append to DOM first (required for some browsers)
      document.body.appendChild(a);
      
      // Trigger download
      a.click();
      
      // Cleanup after download starts
      setTimeout(() => {
        if (a.parentElement) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error('Code download failed:', err);
      alert('Download failed. Please copy manually.');
    }
  };

  const handleEdit = () => {
    setEditedCode(savedCode ?? code);
    setIsEditing(true);
  };

  const handleSave = () => {
    setSavedCode(editedCode);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCode(savedCode ?? code);
    setIsEditing(false);
  };

  /* ─────────────────────────────
     Render
  ───────────────────────────── */
  return (
    <div className="lc-code-block-wrapper">
      <div className="lc-code-block-header">
        {language && (
          <span className="lc-code-block-language">{language}</span>
        )}

        <div className="lc-code-block-actions">
          <button
            onClick={handleCopy}
            className={`lc-code-block-btn ${
              copyStatus === 'copied'
                ? 'is-copied'
                : copyStatus === 'error'
                ? 'is-error'
                : ''
            }`}
          >
            {copyStatus === 'copied' ? 'Copied' : 'Copy'}
          </button>

          {allowActions && (
            <>
              <button
                className="lc-code-block-btn"
                onClick={handleDownload}
              >
                Download
              </button>

              {!isEditing ? (
                <button
                  className="lc-code-block-btn"
                  onClick={handleEdit}
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    className="lc-code-block-btn"
                    onClick={handleSave}
                  >
                    Save
                  </button>
                  <button
                    className="lc-code-block-btn"
                    onClick={handleCancel}
                  >
                    Cancel
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
          value={editedCode}
          onChange={(e) => setEditedCode(e.target.value)}
          spellCheck={false}
          className="lc-code-block-editable"
        />
      ) : (
        <pre className="lc-md-pre">
          <code className={`lc-md-code-block ${className || ''}`}>
            {displayCode}
          </code>
        </pre>
      )}
    </div>
  );
}
