import { useState, useRef, useEffect } from 'react';
import Prism from 'prismjs';

// Import base/core languages first (no dependencies)
import 'prismjs/components/prism-markup'; // Base for HTML/XML
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike'; // Base for C, C++, Java, etc.
import 'prismjs/components/prism-javascript';

// Languages that extend clike
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';

// Languages that extend javascript
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

// Standalone languages
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-solidity';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-perl';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-clojure';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-haskell';
import 'prismjs/components/prism-ocaml';
import 'prismjs/components/prism-fsharp';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-latex';
import 'prismjs/components/prism-makefile';
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-properties';

// Note: Removed prism-vbnet and prism-xml-doc as they may cause dependency issues

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
     Syntax highlighting with Prism
  ───────────────────────────── */
  const getHighlightedCode = () => {
    if (isEditing) return null;
    
    const lang = language?.toLowerCase() || '';
    const prismLang = mapLanguageToPrism(lang);
    
    if (prismLang && Prism.languages[prismLang]) {
      try {
        const highlighted = Prism.highlight(
          displayCode,
          Prism.languages[prismLang],
          prismLang
        );
        return { __html: highlighted };
      } catch (err) {
        console.warn('Prism highlighting failed:', err);
      }
    }
    
    return null;
  };

  const mapLanguageToPrism = (lang: string): string => {
    const langMap: Record<string, string> = {
      js: 'javascript',
      javascript: 'javascript',
      ts: 'typescript',
      typescript: 'typescript',
      jsx: 'jsx',
      tsx: 'tsx',
      py: 'python',
      python: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      'c++': 'cpp',
      cs: 'csharp',
      csharp: 'csharp',
      php: 'php',
      go: 'go',
      rust: 'rust',
      swift: 'swift',
      kt: 'kotlin',
      kotlin: 'kotlin',
      sh: 'bash',
      bash: 'bash',
      shell: 'bash',
      ps1: 'powershell',
      powershell: 'powershell',
      json: 'json',
      yml: 'yaml',
      yaml: 'yaml',
      html: 'markup',
      xml: 'markup', // Use markup instead of xml-doc
      css: 'css',
      dockerfile: 'docker',
      sol: 'solidity',
      solidity: 'solidity',
      rb: 'ruby',
      ruby: 'ruby',
      pl: 'perl',
      perl: 'perl',
      r: 'r',
      scala: 'scala',
      clj: 'clojure',
      clojure: 'clojure',
      lua: 'lua',
      dart: 'dart',
      hs: 'haskell',
      haskell: 'haskell',
      ml: 'ocaml',
      ocaml: 'ocaml',
      fs: 'fsharp',
      fsharp: 'fsharp',
      vb: 'csharp', // Map VB.NET to C# as fallback (similar syntax)
      vbnet: 'csharp', // Map VB.NET to C# as fallback
      md: 'markdown',
      markdown: 'markdown',
      tex: 'latex',
      latex: 'latex',
      make: 'makefile',
      makefile: 'makefile',
      cmake: 'makefile',
      ini: 'ini',
      toml: 'toml',
      properties: 'properties',
      env: 'properties',
      config: 'properties',
      conf: 'properties',
    };
    
    return langMap[lang] || '';
  };

  const highlightedHtml = getHighlightedCode();

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
        <pre className="lc-md-pre lc-vscode-theme">
          <code 
            className={`lc-md-code-block language-${mapLanguageToPrism(language?.toLowerCase() || '') || 'text'} ${className || ''}`}
            dangerouslySetInnerHTML={highlightedHtml || undefined}
          >
            {!highlightedHtml && displayCode}
          </code>
        </pre>
      )}
    </div>
  );
}
