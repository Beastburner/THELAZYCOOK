import { useState } from 'react';
import MarkdownContent from '../../MarkdownContent';

interface MessageBubbleProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
  };
  onRegenerate?: () => void;
  onEdit?: () => void;
}

export default function MessageBubble({ message, onRegenerate, onEdit }: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div
      className={`group flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex gap-3 max-w-[85%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {isUser ? 'U' : 'LC'}
        </div>

        {/* Message Content */}
        <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`relative rounded-2xl px-4 py-3 shadow-sm ${
              isUser
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-200 dark:border-gray-700'
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownContent content={message.content} />
              </div>
            )}
          </div>

          {/* Actions (only for assistant, shown on hover) */}
          {!isUser && isHovered && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Regenerate response"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Edit message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

