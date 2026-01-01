import { useState } from 'react';
import { FiMoreVertical } from 'react-icons/fi';
import { useConversations } from '../../context/ConversationsContext';
import logoTextImg from "../../assets/logo-text.png";


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
      <div className="flex items-center gap-3">
        {/* Logo-text - Orange area */}
        <img
          src={logoTextImg}
          alt="Lazycook"
          className="lc-topbar-logo-text"
        />

        {/* Model Selector - Desktop - Red area */}
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as any)}
          className="lc-model-selector-desktop px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-dark-text"
          aria-label="Select model"
        >
          <option value="gemini">Gemini</option>
          <option value="grok">Grok</option>
          <option value="mixed">Mixed</option>
        </select>

        {/* Model Pill - Mobile - Red area */}
        <div className="lc-model-mobile">
          {model === "gemini" ? "Gemini" : model === "grok" ? "Grok" : "Mixed"}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Existing title / rename logic */}
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
          <h1 className="lc-topbar-title-mobile-hide text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {activeChat?.title || 'New Conversation'}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Actions Menu - Green area (3 dots) */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Conversation menu"
            aria-expanded={isMenuOpen}
          >
            <FiMoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
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