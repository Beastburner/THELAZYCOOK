import { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

interface CopyButtonProps {
  text: string;
  className?: string;
  ariaLabel?: string;
}

export default function CopyButton({ text, className = '', ariaLabel = 'Copy to clipboard' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
        copied
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      } ${className}`}
      aria-label={ariaLabel}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? (
        <>
          <FiCheck className="w-3.5 h-3.5" aria-hidden="true" />
          Copied
        </>
      ) : (
        <>
          <FiCopy className="w-3.5 h-3.5" aria-hidden="true" />
          Copy
        </>
      )}
    </button>
  );
}

