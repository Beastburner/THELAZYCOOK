import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

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

export default function App() {
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("1234");
  const [token, setToken] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [model, setModel] = useState<Model>("gemini");
  const [prompt, setPrompt] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);

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

      const content = data.response || JSON.stringify(data.responses ?? data, null, 2);
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

        <div className="lc-chatlist">
          {chats.map((c) => (
            <button
              key={c.id}
              className={`lc-chatitem ${c.id === activeChatId ? "is-active" : ""}`}
              onClick={() => setActiveChatId(c.id)}
              title={c.title}
            >
              <div className="lc-chatitem-title">{c.title}</div>
              <div className="lc-chatitem-meta">{new Date(c.createdAt).toLocaleString()}</div>
            </button>
          ))}
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
                <div key={m.id} className={`lc-msg ${m.role === "user" ? "is-user" : "is-assistant"}`}>
                  <div className="lc-msg-inner">
                    <div className="lc-msg-role">{m.role === "user" ? "You" : "LazyCook"}</div>
                    <div className="lc-msg-content">{m.content}</div>
                  </div>
                </div>
              ))}
              {loading && <div className="lc-typing">Cooking…</div>}
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


