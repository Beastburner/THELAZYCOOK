import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MarkdownContent from "./MarkdownContent";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

// Component to render LazyCook with red Z
function LazyCookText({ className }: { className?: string }) {
  return (
    <span className={className}>
      La<span className="lc-red-z">z</span>yCook
    </span>
  );
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
    // Better sentence splitting that handles various punctuation and line breaks
    const sentenceRegex = /([.!?]+\s+|\.\n|\n\n+|\.\s+$)/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentence = text.substring(lastIndex, match.index + match[0].length);
      if (sentence.trim().length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex);
      if (remaining.trim().length > 0) {
        sentences.push(remaining);
      }
    }
    
    // If no sentences found, treat entire text as one sentence
    if (sentences.length === 0) {
      sentences.push(text);
    }
    
    // First, add emojis to numbered steps in the text (not too frequently)
    // Pattern: "1.", "2.", "3." or "1)", "2)", "3)" at the start of a line or after whitespace
    const stepEmojis = ['✅', '📝', '🔢', '➡️', '🎯', '💡', '⚡', '🔑'];
    let stepEmojiIndex = 0;
    let processedText = text;
    
    // Find all numbered steps
    const stepPattern = /(^|\n|\s)(\d+)([.)])\s+/g;
    const stepMatches: Array<{ fullMatch: string; number: number; replacement: string }> = [];
    let stepMatch;
    
    while ((stepMatch = stepPattern.exec(text)) !== null) {
      const stepNumber = parseInt(stepMatch[2], 10);
      if (stepNumber >= 1 && stepNumber <= 50) { // Reasonable step range
        stepMatches.push({
          fullMatch: stepMatch[0],
          number: stepNumber,
          replacement: stepMatch[0] // Will be updated if emoji is added
        });
      }
    }
    
    // Add emojis to steps, but not too frequently
    // If there are many steps (5+), add emoji to every 2nd or 3rd step
    // If there are few steps (1-4), add emoji to all of them
    const stepEmojiInterval = stepMatches.length > 5 ? 2 : 1;
    
    stepMatches.forEach((match) => {
      // Add emoji to steps: first 3 always get emoji, then every Nth step
      if (match.number <= 3 || (match.number - 1) % stepEmojiInterval === 0) {
        const emoji = stepEmojis[stepEmojiIndex % stepEmojis.length];
        stepEmojiIndex++;
        // Replace the step pattern with step + emoji
        match.replacement = match.fullMatch.replace(/(\d+)([.)])\s+/, `$1$2 ${emoji} `);
        // Replace in processed text
        processedText = processedText.replace(match.fullMatch, match.replacement);
      }
    });
    
    // Now process sentences for other emojis (sentiment-based)
    const processedSentences: string[] = [];
    let emojiCount = 0;
    // Calculate max emojis based on text length - more emojis for longer responses
    const textLength = processedText.length;
    const maxEmojis = Math.min(Math.max(2, Math.floor(textLength / 200)), 8); // 2-8 emojis based on length
    
    // Re-split processed text into sentences (since we modified it)
    const processedSentenceRegex = /([.!?]+\s+|\.\n|\n\n+|\.\s+$)/g;
    const processedSentencesList: string[] = [];
    let lastIdx = 0;
    let procMatch;
    
    while ((procMatch = processedSentenceRegex.exec(processedText)) !== null) {
      const sentence = processedText.substring(lastIdx, procMatch.index + procMatch[0].length);
      if (sentence.trim().length > 0) {
        processedSentencesList.push(sentence);
      }
      lastIdx = procMatch.index + procMatch[0].length;
    }
    
    if (lastIdx < processedText.length) {
      const remaining = processedText.substring(lastIdx);
      if (remaining.trim().length > 0) {
        processedSentencesList.push(remaining);
      }
    }
    
    if (processedSentencesList.length === 0) {
      processedSentencesList.push(processedText);
    }
    
    // Distribute emojis evenly throughout the text
    const emojiInterval = processedSentencesList.length > maxEmojis ? Math.floor(processedSentencesList.length / maxEmojis) : 1;
    
    processedSentencesList.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();
      
      if (!trimmedSentence || trimmedSentence.length < 5) {
        processedSentences.push(sentence);
        return;
      }
      
      // Skip if this sentence already has a step emoji (to avoid double emojis)
      if (/[\d]+[.)]\s+[✅📝🔢➡️🎯💡⚡🔑]/.test(trimmedSentence)) {
        processedSentences.push(sentence);
        return;
      }
      
      // Analyze sentiment for this sentence
      const sentimentResult = analyzeSentiment(trimmedSentence);
      
      // Add emoji if:
      // 1. We haven't exceeded the limit
      // 2. Either sentiment is strong OR it's at an interval position
      const shouldAddEmoji = emojiCount < maxEmojis && (
        sentimentResult.score > 0 || 
        (index > 0 && index % emojiInterval === 0 && emojiCount < maxEmojis - 1)
      );
      
      if (shouldAddEmoji) {
        let emoji = '';
        
        if (sentimentResult.score > 0) {
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
              if (/^(hello|hi|hey|greetings)\b/gi.test(trimmedSentence)) {
                emoji = '👋';
              } else if (/\b(how can i|what can i|let me know)\b/gi.test(trimmedSentence)) {
                emoji = '😊';
              }
              break;
          }
        } else {
          // For sentences without strong sentiment, add subtle emojis at intervals
          const subtleEmojis = ['✨', '💡', '🎯'];
          emoji = subtleEmojis[Math.floor(Math.random() * subtleEmojis.length)];
        }
        
        if (emoji) {
          // Add emoji at the end of the sentence (before punctuation if it exists)
          const hasPunctuation = /[.!?]$/.test(trimmedSentence);
          if (hasPunctuation) {
            processedSentences.push(sentence.replace(/([.!?]+)$/, ' ' + emoji + '$1'));
          } else {
            processedSentences.push(sentence.trim() + ' ' + emoji + (sentence.endsWith('\n') ? '\n' : ''));
          }
          emojiCount++;
        } else {
          processedSentences.push(sentence);
        }
      } else {
        processedSentences.push(sentence);
      }
    });
    
    return processedSentences.join('');
  });
  
  return processedParts.join('');
}

function TypingIndicator() {
  const [showProgress, setShowProgress] = useState(false);
  
  useEffect(() => {
    // Show progress bar after 3 seconds to indicate longer processing
    const timer = setTimeout(() => {
      setShowProgress(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="lc-typing-indicator">
      <div className="lc-typing-avatar">LC</div>
      <div className="lc-typing-bubble">
        <div className="lc-typing-dots">
          <span className="lc-typing-dot"></span>
          <span className="lc-typing-dot"></span>
          <span className="lc-typing-dot"></span>
        </div>
        <span className="lc-typing-text"><LazyCookText /> is cooking…</span>
      </div>
      {showProgress && (
        <div className="lc-typing-progress-container">
          <div className="lc-typing-progress-bar">
            <div className="lc-typing-progress-fill"></div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageItem({ message, onRegenerate }: { message: Message; onRegenerate?: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <div 
      className={`lc-msg ${message.role === "user" ? "is-user" : "is-assistant"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="lc-msg-inner">
        <div className="lc-msg-role">{message.role === "user" ? "You" : <LazyCookText />}</div>
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
              onClick={onRegenerate}
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

  // Sidebar starts closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 900;
    }
    return true;
  });
  
  // Close sidebar on mobile when window resizes to mobile size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 900 && sidebarOpen) {
        setSidebarOpen(false);
      } else if (window.innerWidth > 900 && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);
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
      // Ensure content is always a string (handle case where response is an object)
      content = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
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

  const regenerateResponse = async (assistantMessageId: string) => {
    if (!token || !plan || !activeChat) return;
    
    // Find the assistant message and the user message before it
    const messages = activeChat.messages;
    const assistantIndex = messages.findIndex(m => m.id === assistantMessageId);
    if (assistantIndex === -1 || messages[assistantIndex].role !== 'assistant') return;
    
    // Find the previous user message
    let userMessage: Message | null = null;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        break;
      }
    }
    
    if (!userMessage) {
      setError('No user message found to regenerate from');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/ai/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-ID": email || "anon",
        },
        body: JSON.stringify({ prompt: userMessage.content, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");

      let content = data.response || JSON.stringify(data.responses ?? data, null, 2);
      // Ensure content is always a string (handle case where response is an object)
      content = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      // Enhance content with emojis for better engagement
      content = enhanceWithEmojis(content);
      
      // Update the assistant message with new content
      updateChatMessages(activeChat.id, (m) => {
        const next = [...m];
        const idx = next.findIndex((x) => x.id === assistantMessageId);
        if (idx >= 0) next[idx] = { ...next[idx], content };
        return next;
      });
    } catch (e) {
      updateChatMessages(activeChat.id, (m) => {
        const next = [...m];
        const idx = next.findIndex((x) => x.id === assistantMessageId);
        if (idx >= 0) next[idx] = { ...next[idx], content: `Error: ${(e as Error).message}` };
        return next;
      });
      setError((e as Error).message);
    } finally {
      setLoading(false);
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

  const downloadChatAsPDF = async () => {
    if (!activeChat) {
      alert('No active chat to download.');
      return;
    }
    
    let loadingMsg: HTMLDivElement | null = null;
    let pdfContainer: HTMLDivElement | null = null;
    
    try {
      // Show loading indicator
      loadingMsg = document.createElement('div');
      loadingMsg.id = 'pdf-loading-indicator';
      loadingMsg.style.position = 'fixed';
      loadingMsg.style.top = '20px';
      loadingMsg.style.right = '20px';
      loadingMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      loadingMsg.style.color = 'white';
      loadingMsg.style.padding = '12px 20px';
      loadingMsg.style.borderRadius = '8px';
      loadingMsg.style.zIndex = '10000';
      loadingMsg.textContent = 'Generating PDF...';
      document.body.appendChild(loadingMsg);

      // Create a temporary container for PDF rendering (hidden but visible for rendering)
      pdfContainer = document.createElement('div');
      if (!pdfContainer) {
        throw new Error('Failed to create PDF container');
      }
      
      // TypeScript guard - pdfContainer is now guaranteed to be non-null
      const container = pdfContainer;
      
      container.id = 'pdf-container-temp';
      container.style.position = 'absolute';
      container.style.left = '-99999px'; // Move off-screen but keep visible for canvas
      container.style.top = '0';
      container.style.width = '768px';
      container.style.maxWidth = '768px';
      container.style.margin = '0 auto'; // Center the container
      container.style.backgroundColor = '#0b0b0f';
      container.style.color = 'rgba(255, 255, 255, 0.92)';
      container.style.padding = '24px';
      container.style.fontFamily = 'system-ui, Avenir, Helvetica, Arial, sans-serif';
      container.style.overflow = 'visible';
      container.style.zIndex = '0'; // Must be 0 or positive for html2canvas
      container.style.opacity = '1'; // MUST be visible for html2canvas to work
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);

      console.log('PDF: Container created, messages count:', activeChat.messages.length);

      // Add title
      const titleDiv = document.createElement('div');
      titleDiv.style.fontSize = '20px';
      titleDiv.style.fontWeight = 'bold';
      titleDiv.style.marginBottom = '8px';
      titleDiv.style.color = 'rgba(255, 255, 255, 0.92)';
      titleDiv.textContent = activeChat.title || "Chat Conversation";
      container.appendChild(titleDiv);

      // Add date
      const dateDiv = document.createElement('div');
      dateDiv.style.fontSize = '12px';
      dateDiv.style.color = 'rgba(255, 255, 255, 0.5)';
      dateDiv.style.marginBottom = '24px';
      dateDiv.textContent = new Date(activeChat.createdAt).toLocaleString();
      container.appendChild(dateDiv);

      // Clone and render messages
      activeChat.messages.forEach((m) => {
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '24px';
        msgDiv.style.display = 'flex';
        msgDiv.style.flexDirection = 'column';
        msgDiv.style.gap = '8px';

        // Role label
        const roleDiv = document.createElement('div');
        roleDiv.style.fontSize = '13px';
        roleDiv.style.fontWeight = '600';
        roleDiv.style.color = 'rgba(255, 255, 255, 0.7)';
        roleDiv.style.marginBottom = '4px';
        if (m.role === 'user') {
          roleDiv.textContent = 'You';
        } else {
          roleDiv.innerHTML = 'La<span style="color: #ff4444; font-weight: 700;">z</span>yCook';
        }
        msgDiv.appendChild(roleDiv);

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.style.fontSize = '14px';
        contentDiv.style.lineHeight = '1.6';
        contentDiv.style.color = 'rgba(255, 255, 255, 0.92)';
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.wordWrap = 'break-word';
        
        if (m.role === 'assistant') {
          // For assistant messages, we need to render markdown
          // Simple markdown to HTML conversion for PDF
          let htmlContent = m.content
            // Code blocks (multiline)
            .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_match, _lang, code) => {
              return `<pre style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; overflow-x: auto; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; margin: 12px 0; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word;"><code>${code.trim()}</code></pre>`;
            })
            // Inline code
            .replace(/`([^`\n]+)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">$1</code>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 700;">$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>')
            // Headings
            .replace(/^#### (.+)$/gm, '<h4 style="font-size: 16px; font-weight: 700; margin: 16px 0 8px 0; line-height: 1.3;">$1</h4>')
            .replace(/^### (.+)$/gm, '<h3 style="font-size: 18px; font-weight: 700; margin: 18px 0 10px 0; line-height: 1.3;">$1</h3>')
            .replace(/^## (.+)$/gm, '<h2 style="font-size: 20px; font-weight: 700; margin: 20px 0 12px 0; line-height: 1.3;">$1</h2>')
            .replace(/^# (.+)$/gm, '<h1 style="font-size: 24px; font-weight: 700; margin: 24px 0 14px 0; line-height: 1.3;">$1</h1>')
            // Lists
            .replace(/^\- (.+)$/gm, '<li style="margin: 4px 0; padding-left: 8px;">$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li style="margin: 4px 0; padding-left: 8px;">$2</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
            .replace(/\n/g, '<br>');
          
          // Wrap in paragraph if not already wrapped
          if (!htmlContent.startsWith('<')) {
            htmlContent = `<p style="margin: 8px 0;">${htmlContent}</p>`;
          } else {
            htmlContent = `<div>${htmlContent}</div>`;
          }
          
          // Replace LazyCook with red z
          htmlContent = htmlContent.replace(/LazyCook/gi, 'La<span style="color: #ff4444; font-weight: 700;">z</span>yCook');
          
          contentDiv.innerHTML = htmlContent;
        } else {
          contentDiv.textContent = m.content;
        }
        
        msgDiv.appendChild(contentDiv);
        container.appendChild(msgDiv);
      });

      // Wait for DOM to update and images/fonts to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('PDF: Container dimensions:', {
        width: container.scrollWidth,
        height: container.scrollHeight,
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight
      });

      // Capture as canvas
      console.log('PDF: Starting html2canvas...');
      const canvas = await html2canvas(container, {
        backgroundColor: '#0b0b0f',
        scale: window.devicePixelRatio || 2,
        useCORS: true,
        width: container.scrollWidth,
        height: container.scrollHeight,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
      });

      console.log('PDF: Canvas created:', {
        width: canvas.width,
        height: canvas.height
      });

      // DO NOT remove container yet - wait until after PDF is saved
      // Remove loading indicator only
      if (loadingMsg && loadingMsg.parentElement) {
        document.body.removeChild(loadingMsg);
      }

      // Convert canvas to PDF
      console.log('PDF: Converting canvas to image...');
      const imgData = canvas.toDataURL('image/png');
      if (!imgData || imgData === 'data:,') {
        throw new Error('Failed to convert canvas to image');
      }
      console.log('PDF: Image data created, length:', imgData.length);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      console.log('PDF: PDF document created');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate scaling to fit page width (always scale to width, split by height)
      const pageMargin = 10; // 10mm margin on each side
      const availableWidth = pdfWidth - (pageMargin * 2);
      const availableHeight = pdfHeight - (pageMargin * 2);
      
      // ALWAYS scale to fit width (don't scale to fit height, that makes content too narrow)
      const ratio = availableWidth / imgWidth;
      
      const imgScaledWidth = imgWidth * ratio;
      
      // Calculate centered position
      const xPosition = (pdfWidth - imgScaledWidth) / 2;
      const yStart = pageMargin;
      
      // Calculate how many pixels fit on one page
      const pageHeightInPixels = availableHeight / ratio;
      
      // Always split across multiple pages if content is longer than one page
      let heightLeft = imgHeight;
      let position = 0;
      let isFirstPage = true;

      while (heightLeft > 0) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;
        
        const currentPageHeight = Math.min(pageHeightInPixels, heightLeft);
        
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        pageCanvas.width = imgWidth;
        pageCanvas.height = currentPageHeight;

        if (pageCtx) {
          pageCtx.drawImage(
            canvas,
            0,
            position,
            imgWidth,
            currentPageHeight,
            0,
            0,
            imgWidth,
            currentPageHeight
          );
        }

        const pageImgData = pageCanvas.toDataURL('image/png');
        const pageImgScaledHeight = currentPageHeight * ratio;
        
        // Center each page horizontally, start from top margin
        pdf.addImage(pageImgData, 'PNG', xPosition, yStart, imgScaledWidth, pageImgScaledHeight);

        heightLeft -= currentPageHeight;
        position += currentPageHeight;
      }

      // Save PDF - use ONLY blob download method (most reliable)
      const filename = `${(activeChat.title || "chat").replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
      console.log('PDF: Saving file:', filename);
      
      // Generate PDF blob and create download link
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      console.log('PDF: Download triggered via blob method');
      
      // Cleanup: Remove container and link after download starts
      setTimeout(() => {
        // Remove download link
        if (link.parentElement) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
        
        // Remove container (now safe to remove)
        if (container && container.parentElement) {
          document.body.removeChild(container);
        }
        console.log('PDF: Cleanup complete');
      }, 2000);
      
      // Update loading message with helpful instructions
      if (loadingMsg && loadingMsg.parentElement) {
        loadingMsg.innerHTML = `
          <div style="text-align: center;">
            <div style="font-size: 18px; margin-bottom: 8px;">✓ PDF Generated!</div>
            <div style="font-size: 12px; margin-bottom: 12px;">File: ${filename}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.8);">
              <div>1. Press <strong>Ctrl+J</strong> to open Downloads</div>
              <div>2. Check: <strong>C:\\Users\\parth\\Downloads</strong></div>
              <div>3. Look for: <strong>${filename}</strong></div>
            </div>
          </div>
        `;
        loadingMsg.style.backgroundColor = 'rgba(76, 175, 80, 0.95)';
        loadingMsg.style.maxWidth = '400px';
        loadingMsg.style.padding = '20px';
        loadingMsg.style.fontSize = '13px';
        setTimeout(() => {
          if (loadingMsg && loadingMsg.parentElement) {
            document.body.removeChild(loadingMsg);
          }
        }, 8000);
      }
      
      console.log('PDF: Download complete!');
      console.log('PDF: File location should be:', `C:\\Users\\parth\\Downloads\\${filename}`);
    } catch (err) {
      console.error('PDF generation error:', err);
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      // Clean up in case of error
      if (loadingMsg && loadingMsg.parentElement) {
        document.body.removeChild(loadingMsg);
      }
      const tempContainer = document.getElementById('pdf-container-temp');
      if (tempContainer && tempContainer.parentElement) {
        document.body.removeChild(tempContainer);
      }
      
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('PDF Error details:', errorMsg);
      alert(`Failed to generate PDF: ${errorMsg}\n\nPlease check the browser console (F12) for more details.`);
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
              <div className="lc-title"><LazyCookText /></div>
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
      {sidebarOpen && (
        <div 
          className="lc-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}
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

          <div className="lc-topbar-title">{activeChat?.title || <LazyCookText />}</div>

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
                <MessageItem 
                  key={m.id} 
                  message={m} 
                  onRegenerate={m.role === 'assistant' ? () => regenerateResponse(m.id) : undefined}
                />
              ))}
              {loading && <TypingIndicator />}
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
