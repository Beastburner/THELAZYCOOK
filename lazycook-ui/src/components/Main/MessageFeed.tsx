import { useConversations } from '../../context/ConversationsContext';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import MessageBubble from '../UI/MessageBubble';

interface MessageFeedProps {
  loading?: boolean;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
}

export default function MessageFeed({ loading, onRegenerate, onEdit }: MessageFeedProps) {
  const { chats, activeChatId } = useConversations();
  const activeChat = chats.find((c) => c.id === activeChatId);
  const messagesEndRef = useAutoScroll([activeChat?.messages.length, loading]);

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Start a new conversation
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Ask anything to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-6xl mx-auto w-full">
        {activeChat.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Ask anything
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Start a conversation with LazyCook
              </p>
            </div>
          </div>
        ) : (
          <>
            {activeChat.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
                onEdit={onEdit ? () => onEdit(message.id) : undefined}
              />
            ))}
            {loading && (
              <div className="flex justify-start mb-6">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold">
                    LC
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3 border border-gray-200 dark:border-gray-700">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  );
}

