import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useConversations } from '../../context/ConversationsContext';

interface ConversationListProps {
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
}

export default function ConversationList({ onNewConversation, onSelectConversation }: ConversationListProps) {
  const { chats, activeChatId, email } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-border">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="New conversation"
        >
          <FiPlus className="w-5 h-5" aria-hidden="true" />
          New Conversation
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-border">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400"
          aria-label="Search conversations"
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="p-2">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectConversation(chat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  activeChatId === chat.id
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
                aria-label={`Select conversation: ${chat.title}`}
              >
                <div className="font-medium text-sm truncate">{chat.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {new Date(chat.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
            {email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {email || 'User'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

