import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type Plan = "GO" | "PRO" | "ULTRA";
export type Model = "gemini" | "grok" | "mixed";
export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
};

export type Chat = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

interface ConversationsContextType {
  chats: Chat[];
  activeChatId: string | null;
  setChats: (chats: Chat[] | ((prev: Chat[]) => Chat[])) => void;
  setActiveChatId: (id: string | null) => void;
  email: string;
  plan: Plan | null;
  token: string | null;
  model: Model;
  setModel: (model: Model) => void;
}

export const ConversationsContext = createContext<ConversationsContextType | null>(null);

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (!context) {
    throw new Error('useConversations must be used within ConversationsProvider');
  }
  return context;
}

interface ConversationsProviderProps {
  children: ReactNode;
  value: ConversationsContextType;
}

export function ConversationsProvider({ children, value }: ConversationsProviderProps) {
  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

