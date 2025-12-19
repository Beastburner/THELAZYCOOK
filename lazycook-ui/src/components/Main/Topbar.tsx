import { useState } from 'react';
import { useConversations } from '../../context/ConversationsContext';

interface TopbarProps {
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onExport?: () => void;
}

export default function Topbar({ onRename, onDelete, onExport }: TopbarProps) {
  const { chats, activeChatId, model, setModel } = useConversations();
  const activeChat = chats.find((c) => c.id === activeChatId);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(activeChat?.title || '');

  const handleRename = () => {
    if (onRename && newTitle.trim()) {
      onRename(newTitle.trim());
      setIsRenaming(false);
    }
  };

  const handleExport = () => {
    if (!activeChat) return;
    onExport?.();
  };

  return (
    <div className="h-14 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface flex items-center justify-between px-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {isRenaming ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setIsRenaming(false);
                  setNewTitle(activeChat?.title || '');
                }
              }}
              className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-dark-text"
              autoFocus
              aria-label="Rename conversation"
            />
          </div>
        ) : (
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {activeChat?.title || 'New Conversation'}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Model Selector */}
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as any)}
          className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-dark-text"
          aria-label="Select model"
        >
          <option value="gemini">Gemini</option>
          <option value="grok">Grok</option>
          <option value="mixed">Mixed</option>
        </select>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Conversation menu"
            aria-expanded={isMenuOpen}
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-20">
                {onRename && (
                  <button
                    onClick={() => {
                      setIsRenaming(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Rename conversation"
                  >
                    Rename
                  </button>
                )}
                {onExport && (
                  <button
                    onClick={() => {
                      handleExport();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Export conversation"
                  >
                    Export
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      onDelete();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Delete conversation"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

