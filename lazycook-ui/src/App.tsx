import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MarkdownContent from "./MarkdownContent";
import jsPDF from "jspdf";

type Plan = "GO" | "PRO" | "ULTRA";
type Model = "gemini" | "grok" | "mixed";
type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type Chat = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

// Strict mapping (backend is source of truth)
const PLAN_MODELS: Record<Plan, Model[]> = {
  GO: ["gemini"],
  PRO: ["grok"],
  ULTRA: ["mixed"],
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function titleFromPrompt(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "New chat";
  return t.length > 28 ? `${t.slice(0, 28)}…` : t;
}

function analyzeSentiment(text: string): { sentiment: 'positive' | 'neutral' | 'negative' | 'question' | 'excited'; score: number } {
  const lowerText = text.toLowerCase();
  
  // Positive sentiment indicators
  const positiveWords = ['great', 'excellent', 'wonderful', 'amazing', 'perfect', 'awesome', 'fantastic', 'brilliant', 'outstanding', 'superb', 'delighted', 'pleased', 'happy', 'glad', 'success', 'solved', 'fixed', 'working', 'good', 'nice', 'helpful', 'useful', 'efficient', 'optimized', 'streamlined'];
  const positivePhrases = ['well done', 'good job', 'thank you', 'thanks', 'appreciate', 'love it', 'exactly what', 'perfect solution'];
  
  // Negative sentiment indicators
  const negativeWords = ['error', 'failed', 'broken', 'wrong', 'bad', 'terrible', 'awful', 'horrible', 'problem', 'issue', 'bug', 'crash', 'doesn\'t work', 'not working', 'disappointed', 'frustrated', 'confused', 'stuck'];
  const negativePhrases = ['not working', 'doesn\'t work', 'can\'t', 'cannot', 'unable to', 'failed to', 'error occurred'];
  
  // Question indicators
  const questionWords = ['how', 'what', 'why', 'when', 'where', 'which', 'who', 'can you', 'could you', 'would you', 'should i', 'is it', 'are you'];
  
  // Excitement indicators
  const excitedWords = ['wow', 'awesome', 'amazing', 'incredible', 'fantastic', 'brilliant', 'excellent'];
  const hasExclamation = text.includes('!');
  
  let positiveScore = 0;
  let negativeScore = 0;
  let questionScore = 0;
  let excitedScore = 0;
  
  // Count positive indicators
  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    positiveScore += (text.match(regex) || []).length;
  });
  positivePhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) positiveScore += 2;
  });
  
  // Count negative indicators
  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    negativeScore += (text.match(regex) || []).length;
  });
  negativePhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) negativeScore += 2;
  });
  
  // Count question indicators
  questionWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    questionScore += (text.match(regex) || []).length;
  });
  if (text.includes('?')) questionScore += 2;
  
  // Count excitement indicators
  excitedWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    excitedScore += (text.match(regex) || []).length;
  });
  if (hasExclamation) excitedScore += 1;
  
  // Determine sentiment
  if (questionScore > 0 && questionScore >= Math.max(positiveScore, negativeScore)) {
    return { sentiment: 'question', score: questionScore };
  }
  if (excitedScore > 0 && excitedScore >= 2) {
    return { sentiment: 'excited', score: excitedScore };
  }
  if (negativeScore > positiveScore && negativeScore > 0) {
    return { sentiment: 'negative', score: negativeScore };
  }
  if (positiveScore > 0) {
    return { sentiment: 'positive', score: positiveScore };
  }
  
  return { sentiment: 'neutral', score: 0 };
}

function enhanceWithEmojis(content: string): string {
  // Split content by code blocks to preserve them
  const codeBlockRegex = /(```[\s\S]*?```|`[^`]+`)/g;
  const parts: Array<{ type: 'code' | 'text'; content: string }> = [];
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[0] });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.substring(lastIndex) });
  }
  
  // If no code blocks found, treat entire content as text
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }
  
  // Process only text parts
  const processedParts = parts.map(part => {
    if (part.type === 'code') {
      return part.content; // Keep code blocks unchanged
    }
    
    let text = part.content;
    
    // Split text into sentences for better sentiment analysis
    const sentences = text.split(/([.!?]\s+|\.\n|\n\n)/);
    const processedSentences: string[] = [];
    let emojiCount = 0;
    const maxEmojis = 3; // Maximum emojis per text block
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i];
      const punctuation = sentences[i + 1] || '';
      
      if (!sentence || sentence.trim().length < 5) {
        processedSentences.push(sentence + punctuation);
        continue;
      }
      
      // Analyze sentiment for this sentence
      const sentimentResult = analyzeSentiment(sentence);
      
      // Only add emoji if sentiment is strong enough and we haven't exceeded limit
      if (emojiCount < maxEmojis && sentimentResult.score > 0) {
        let emoji = '';
        
        switch (sentimentResult.sentiment) {
          case 'positive':
            emoji = ['😊', '✨', '👍', '🎉'][Math.floor(Math.random() * 4)];
            break;
          case 'excited':
            emoji = ['🚀', '🎉', '✨', '🌟'][Math.floor(Math.random() * 4)];
            break;
          case 'question':
            emoji = ['🤔', '❓', '💭'][Math.floor(Math.random() * 3)];
            break;
          case 'negative':
            emoji = ['😔', '🔧', '⚠️'][Math.floor(Math.random() * 3)];
            break;
          case 'neutral':
            // For neutral, only add if it's a greeting or helpful phrase
            if (/^(hello|hi|hey|greetings)\b/gi.test(sentence)) {
              emoji = '👋';
            } else if (/\b(how can i|what can i|let me know)\b/gi.test(sentence)) {
              emoji = '😊';
            }
            break;
        }
        
        if (emoji) {
          // Add emoji at the end of the sentence (before punctuation)
          processedSentences.push(sentence + ' ' + emoji + punctuation);
          emojiCount++;
        } else {
          processedSentences.push(sentence + punctuation);
        }
      } else {
        processedSentences.push(sentence + punctuation);
      }
    }
    
    return processedSentences.join('');
  });
  
  return processedParts.join('');
}

function MessageItem({ message }: { message: Message }) {
  const [isHovered, setIsHovered] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <div 
      className={`lc-msg ${message.role === "user" ? "is-user" : "is-assistant"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="lc-msg-inner">
        <div className="lc-msg-role">{message.role === "user" ? "You" : "LazyCook"}</div>
        <div className="lc-msg-content">
          {message.role === "assistant" ? (
            <MarkdownContent content={message.content} />
          ) : (
            message.content
          )}
        </div>
        {message.role === "assistant" && isHovered && (
          <div className="lc-msg-actions">
            <button
              className="lc-msg-action-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message.content);
                } catch (err) {
                  console.error('Copy failed:', err);
                }
              }}
              aria-label="Copy message"
              title="Copy"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 2H12.5C13.3284 2 14 2.67157 14 3.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 2C5.5 1.72386 5.72386 1.5 6 1.5H12.5C12.7761 1.5 13 1.72386 13 2V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className={`lc-msg-action-btn ${liked ? 'is-active' : ''}`}
              onClick={() => setLiked(!liked)}
              aria-label="Thumbs up"
              title="Good response"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 7.5H4.5V13.5H2.5C2.22386 13.5 2 13.2761 2 13V8C2 7.72386 2.22386 7.5 2.5 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.5 7.5V6.5C4.5 5.67157 5.17157 5 6 5H7.5C7.77614 5 8 5.22386 8 5.5V6.5L6.5 10.5H11.5C12.3284 10.5 13 9.82843 13 9V8.5C13 8.22386 12.7761 8 12.5 8H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="lc-msg-action-btn"
              onClick={() => {}}
              aria-label="Thumbs down"
              title="Bad response"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.5 8.5H11.5V2.5H13.5C13.7761 2.5 14 2.72386 14 3V8C14 8.27614 13.7761 8.5 13.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11.5 8.5V9.5C11.5 10.3284 10.8284 11 10 11H8.5C8.22386 11 8 10.7761 8 10.5V9.5L9.5 5.5H4.5C3.67157 5.5 3 6.17157 3 7V7.5C3 7.77614 3.22386 8 3.5 8H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="lc-msg-action-btn"
              onClick={() => {}}
              aria-label="Share"
              title="Share"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 8C11.8284 8 12.5 7.32843 12.5 6.5C12.5 5.67157 11.8284 5 11 5C10.1716 5 9.5 5.67157 9.5 6.5C9.5 7.32843 10.1716 8 11 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 11C5.82843 11 6.5 10.3284 6.5 9.5C6.5 8.67157 5.82843 8 5 8C4.17157 8 3.5 8.67157 3.5 9.5C3.5 10.3284 4.17157 11 5 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 3L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 8L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="lc-msg-action-btn"
              onClick={() => {}}
              aria-label="Regenerate"
              title="Regenerate response"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.5 8C1.5 11.5899 4.41015 14.5 8 14.5C9.61061 14.5 11.0899 13.9528 12.2803 13.0196" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14.5 8C14.5 4.41015 11.5899 1.5 8 1.5C6.38939 1.5 4.91015 2.04724 3.71967 2.98039" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M5.5 11.5L1.5 8L5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.5 4.5L14.5 8L10.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="lc-msg-action-btn"
              onClick={() => {}}
              aria-label="More options"
              title="More"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="4" r="1" fill="currentColor"/>
                <circle cx="8" cy="8" r="1" fill="currentColor"/>
                <circle cx="8" cy="12" r="1" fill="currentColor"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("1234");
  const [token, setToken] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatCopyStatus, setChatCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const [model, setModel] = useState<Model>("gemini");
  const [prompt, setPrompt] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, loading]);

  // ---- Persist auth + chats ----
  useEffect(() => {
    const saved = localStorage.getItem("lazycook_auth");
    if (saved) {
      const parsed = JSON.parse(saved);
      setEmail(parsed.email || "");
      setToken(parsed.token || null);
      setPlan(parsed.plan || null);
    }

    const savedChats = localStorage.getItem("lazycook_chats");
    const savedActive = localStorage.getItem("lazycook_active_chat");
    if (savedChats) {
      const parsed = JSON.parse(savedChats) as Chat[];
      setChats(Array.isArray(parsed) ? parsed : []);
      setActiveChatId(savedActive || (parsed?.[0]?.id ?? null));
    } else {
      const first: Chat = { id: uid("chat"), title: "New chat", createdAt: Date.now(), messages: [] };
      setChats([first]);
      setActiveChatId(first.id);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lazycook_chats", JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (activeChatId) localStorage.setItem("lazycook_active_chat", activeChatId);
  }, [activeChatId]);

  const saveAuth = (e: string, t: string, p: string) => {
    localStorage.setItem("lazycook_auth", JSON.stringify({ email: e, token: t, plan: p }));
  };

  const logout = () => {
    localStorage.removeItem("lazycook_auth");
    setToken(null);
    setPlan(null);
  };

  const refreshMe = async (tok: string) => {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${tok}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load user");
    setPlan(data.plan);
    saveAuth(email, tok, data.plan);

    // Auto-select allowed model for the plan (strict routing)
    const allowed = PLAN_MODELS[data.plan as Plan]?.[0];
    if (allowed) setModel(allowed);
  };

  useEffect(() => {
    if (!token) return;
    refreshMe(token).catch(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      setToken(data.access_token);
      await refreshMe(data.access_token);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const newChat = () => {
    const c: Chat = { id: uid("chat"), title: "New chat", createdAt: Date.now(), messages: [] };
    setChats((prev) => [c, ...prev]);
    setActiveChatId(c.id);
    setPrompt("");
    setError(null);
  };

  const updateChatMessages = (chatId: string, updater: (m: Message[]) => Message[]) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: updater(c.messages) } : c))
    );
  };

  const runAI = async () => {
    if (!token || !plan) return;
    const text = prompt.trim();
    if (!text) return;
    if (!PLAN_MODELS[plan].includes(model)) {
      setError("Upgrade plan to access this model.");
      return;
    }

    // If no active chat, create a new one based on the prompt
    let chatId = activeChatId;
    if (!chatId || !chats.find((c) => c.id === chatId)) {
      const newChat: Chat = {
        id: uid("chat"),
        title: titleFromPrompt(text),
        createdAt: Date.now(),
        messages: [],
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      chatId = newChat.id;
    }

    setLoading(true);
    setError(null);

    const userMsg: Message = { id: uid("m"), role: "user", content: text };
    const assistantMsg: Message = { id: uid("m"), role: "assistant", content: "" };

    // If it's a fresh chat, set title from first user message
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId && c.messages.length === 0 ? { ...c, title: titleFromPrompt(text) } : c
      )
    );

    updateChatMessages(chatId, (m) => [...m, userMsg, assistantMsg]);
    setPrompt("");

    try {
      const res = await fetch(`${API_BASE}/ai/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-ID": email || "anon",
        },
        body: JSON.stringify({ prompt: text, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");

      let content = data.response || JSON.stringify(data.responses ?? data, null, 2);
      // Enhance content with emojis for better engagement
      content = enhanceWithEmojis(content);
      
      updateChatMessages(chatId, (m) => {
        const next = [...m];
        const idx = next.findIndex((x) => x.id === assistantMsg.id);
        if (idx >= 0) next[idx] = { ...next[idx], content };
        return next;
      });
    } catch (e) {
      updateChatMessages(chatId, (m) => {
        const next = [...m];
        const idx = next.findIndex((x) => x.id === assistantMsg.id);
        if (idx >= 0) next[idx] = { ...next[idx], content: `Error: ${(e as Error).message}` };
        return next;
      });
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onComposerKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runAI();
    }
  };

  const copyWholeChat = async () => {
    if (!activeChat) return;
    
    const chatText = activeChat.messages
      .map((m) => {
        const role = m.role === "user" ? "You" : "LazyCook";
        return `${role}:\n${m.content}\n\n`;
      })
      .join("---\n\n");
    
    try {
      await navigator.clipboard.writeText(chatText);
      setChatCopyStatus('copied');
      setTimeout(() => setChatCopyStatus('idle'), 2000);
    } catch (err) {
      setChatCopyStatus('error');
      setTimeout(() => setChatCopyStatus('idle'), 3000);
    }
  };

  const downloadChatAsPDF = () => {
    if (!activeChat) return;
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;
      const lineHeight = 7;
      const titleHeight = 15;

      // Add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(activeChat.title || "Chat Conversation", margin, yPosition);
      yPosition += titleHeight;

      // Add date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      doc.text(new Date(activeChat.createdAt).toLocaleString(), margin, yPosition);
      yPosition += lineHeight + 5;
      doc.setTextColor(0, 0, 0);

      // Add messages
      activeChat.messages.forEach((m, idx) => {
        const role = m.role === "user" ? "You" : "LazyCook";
        const content = m.content;

        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }

        // Add role label
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(role + ":", margin, yPosition);
        yPosition += lineHeight;

        // Add content (handle long text by splitting)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Remove markdown code blocks for cleaner PDF (or keep them, but format better)
        const cleanContent = content.replace(/```[\s\S]*?```/g, (match) => {
          return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
        });

        const lines = doc.splitTextToSize(cleanContent, maxWidth);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(line, margin, yPosition);
          yPosition += lineHeight;
        });

        // Add separator
        if (idx < activeChat.messages.length - 1) {
          yPosition += 5;
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 10;
        }
      });

      // Save PDF
      const filename = `${activeChat.title || "chat"}_${Date.now()}.pdf`;
      doc.save(filename);
    } catch (err) {
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!token) {
    return (
      <div className="lc-login">
        <div className="lc-login-card">
          <div className="lc-brand">
            <div className="lc-logo">LC</div>
            <div>
              <div className="lc-title">LazyCook</div>
              <div className="lc-subtitle">Sign in to continue</div>
            </div>
          </div>

          <label className="lc-label">Email</label>
          <input
            className="lc-input"
            placeholder="go@lazycook.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label className="lc-label">Password</label>
          <input
            className="lc-input"
            placeholder="(ignored for now)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button className="lc-primary" onClick={login}>
            Continue
          </button>

          {error && <div className="lc-error">{error}</div>}
          <div className="lc-hint">
            Tip: use <code>go@lazycook.ai</code> / <code>pro@lazycook.ai</code> / <code>ultra@lazycook.ai</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lc-shell">
      <aside className={`lc-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="lc-sidebar-top">
          <button className="lc-newchat" onClick={newChat}>
            New chat
          </button>
          <button className="lc-iconbtn" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle sidebar">
            ☰
          </button>
        </div>

        {/* Search */}
        <div className="lc-sidebar-search">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="lc-search-input"
            aria-label="Search conversations"
          />
        </div>

        <div className="lc-chatlist">
          {filteredChats.length === 0 ? (
            <div className="lc-chatlist-empty">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filteredChats.map((c) => (
              <button
                key={c.id}
                className={`lc-chatitem ${c.id === activeChatId ? "is-active" : ""}`}
                onClick={() => setActiveChatId(c.id)}
                title={c.title}
              >
                <div className="lc-chatitem-title">{c.title}</div>
                <div className="lc-chatitem-meta">{new Date(c.createdAt).toLocaleString()}</div>
              </button>
            ))
          )}
        </div>

        <div className="lc-sidebar-bottom">
          <div className="lc-userline">
            <div className="lc-avatar">{(email || "U").slice(0, 1).toUpperCase()}</div>
            <div className="lc-usertext">
              <div className="lc-useremail">{email}</div>
              <div className="lc-userplan">Plan: {plan}</div>
            </div>
          </div>
          <button className="lc-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="lc-main">
        <header className="lc-topbar">
          <button className="lc-iconbtn mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            ☰
          </button>

          <div className="lc-topbar-title">{activeChat?.title || "LazyCook"}</div>

          <div className="lc-topbar-actions">
            <select
              className="lc-select"
              value={model}
              onChange={(e) => setModel(e.target.value as Model)}
              aria-label="Model"
            >
              <option value="gemini" disabled={!!plan && !PLAN_MODELS[plan].includes("gemini")}>
                Gemini{plan && !PLAN_MODELS[plan].includes("gemini") ? " (locked)" : ""}
              </option>
              <option value="grok" disabled={!!plan && !PLAN_MODELS[plan].includes("grok")}>
                Grok{plan && !PLAN_MODELS[plan].includes("grok") ? " (locked)" : ""}
              </option>
              <option value="mixed" disabled={!!plan && !PLAN_MODELS[plan].includes("mixed")}>
                Mixed{plan && !PLAN_MODELS[plan].includes("mixed") ? " (locked)" : ""}
              </option>
            </select>
            <span className="lc-pill">{plan}</span>
          </div>
        </header>

        <section className="lc-thread">
          {(activeChat?.messages || []).length === 0 ? (
            <div className="lc-empty">
              <div className="lc-empty-title">Ask anything</div>
              <div className="lc-empty-subtitle">Gemini and Grok are ready. Your plan gates Grok.</div>
            </div>
          ) : (
            <div className="lc-messages">
              {(activeChat?.messages || []).map((m) => (
                <MessageItem key={m.id} message={m} />
              ))}
              {loading && <div className="lc-typing">Cooking…</div>}
              {activeChat && activeChat.messages.length > 0 && (
                <div className="lc-chat-actions">
                  <button
                    className={`lc-chat-action-btn ${chatCopyStatus === 'copied' ? 'is-copied' : chatCopyStatus === 'error' ? 'is-error' : ''}`}
                    onClick={copyWholeChat}
                    aria-label="Copy whole chat"
                    title={chatCopyStatus === 'copied' ? 'Copied!' : chatCopyStatus === 'error' ? 'Copy failed' : 'Copy chat'}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-chat-action-icon">
                      <path d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2H12.5C13.3284 2 14 2.67157 14 3.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2C5.5 1.72386 5.72386 1.5 6 1.5H12.5C12.7761 1.5 13 1.72386 13 2V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{chatCopyStatus === 'copied' ? 'Copied' : chatCopyStatus === 'error' ? 'Failed' : 'Copy Chat'}</span>
                  </button>
                  <button
                    className="lc-chat-action-btn"
                    onClick={downloadChatAsPDF}
                    aria-label="Download chat as PDF"
                    title="Download as PDF"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-chat-action-icon">
                      <path d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2H12.5C13.3284 2 14 2.67157 14 3.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2C5.5 1.72386 5.72386 1.5 6 1.5H12.5C12.7761 1.5 13 1.72386 13 2V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Download PDF</span>
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        <footer className="lc-composer">
          {error && <div className="lc-error lc-error-inline">{error}</div>}
          <div className="lc-composer-row">
            <textarea
              className="lc-textarea"
              placeholder="Message LazyCook…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onComposerKeyDown}
              rows={1}
            />
            <button className="lc-primary" onClick={runAI} disabled={loading || !prompt.trim()}>
              Send
            </button>
          </div>
          <div className="lc-footnote">Press Enter to send, Shift+Enter for a new line.</div>
        </footer>
      </main>
    </div>
  );
}
