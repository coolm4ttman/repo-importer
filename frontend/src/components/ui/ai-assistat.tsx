import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, X, Loader2, Plus, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIMessageBarProps {
  projectContext?: {
    name: string;
    summary?: string;
    fileCount: number;
    totalLines: number;
    deadCodeLines: number;
    migratedFiles: number;
    status: string;
    riskAssessments?: { file_path: string; risk_level: string; risk_score: number; factors: string[] }[];
    migrationPlan?: { file_path: string; order: number; risk_level: string; estimated_transformations: number }[];
    deadCode?: { file_path: string; name: string; kind: string; lines_saved: number; reason: string }[];
  };
}

interface ChatMessage {
  text: string;
  isUser: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getChatTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.isUser);
  if (!firstUserMsg) return "New Chat";
  const text = firstUserMsg.text;
  return text.length > 30 ? text.slice(0, 30) + "..." : text;
}

function loadChats(projectName: string): ChatSession[] {
  try {
    const key = `reforge-chats-${projectName}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveChats(projectName: string, chats: ChatSession[]) {
  try {
    const key = `reforge-chats-${projectName}`;
    localStorage.setItem(key, JSON.stringify(chats));
  } catch {
    // Storage full or unavailable
  }
}

const AIMessageBar: React.FC<AIMessageBarProps> = ({ projectContext }) => {
  const projectName = projectContext?.name ?? "__global__";

  const [chats, setChats] = useState<ChatSession[]>(() => loadChats(projectName));
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    const loaded = loadChats(projectName);
    return loaded.length > 0 ? loaded[0].id : null;
  });

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const messages = activeChat?.messages ?? [];

  const [input, setInput] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Persist chats on change
  useEffect(() => {
    saveChats(projectName, chats);
  }, [chats, projectName]);

  const updateActiveMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, messages: updater(c.messages), title: getChatTitle(updater(c.messages)) }
            : c,
        ),
      );
    },
    [activeChatId],
  );

  const createNewChat = useCallback(() => {
    const newChat: ChatSession = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput("");
  }, []);

  const deleteChat = useCallback(
    (chatId: string) => {
      setChats((prev) => {
        const updated = prev.filter((c) => c.id !== chatId);
        if (chatId === activeChatId) {
          setActiveChatId(updated.length > 0 ? updated[0].id : null);
        }
        return updated;
      });
    },
    [activeChatId],
  );

  const generateResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();
    const ctx = projectContext;

    if (!ctx) {
      return "No project loaded. Navigate to a project first to ask questions about it.";
    }

    if (msg.includes("summary") || msg.includes("overview") || msg.includes("status")) {
      const parts = [
        `**${ctx.name}** — Status: ${ctx.status}`,
        `${ctx.fileCount} files, ${ctx.totalLines.toLocaleString()} total lines.`,
        ctx.migratedFiles > 0
          ? `${ctx.migratedFiles}/${ctx.fileCount} files migrated (${Math.round((ctx.migratedFiles / ctx.fileCount) * 100)}%).`
          : "No files migrated yet.",
        ctx.deadCodeLines > 0
          ? `${ctx.deadCodeLines.toLocaleString()} lines of dead code detected.`
          : "",
        ctx.summary || "",
      ];
      return parts.filter(Boolean).join("\n\n");
    }

    if (msg.includes("risk") || msg.includes("dangerous") || msg.includes("risky")) {
      if (!ctx.riskAssessments || ctx.riskAssessments.length === 0) {
        return "No risk assessment data available yet. Run the analysis first.";
      }
      const high = ctx.riskAssessments.filter((r) => r.risk_level === "high" || r.risk_level === "critical");
      if (high.length === 0) {
        return `All ${ctx.riskAssessments.length} files have low/medium risk. Your codebase is in good shape for migration!`;
      }
      const lines = high
        .sort((a, b) => b.risk_score - a.risk_score)
        .map((r) => `• **${r.file_path}** — ${r.risk_level} (score: ${r.risk_score}) — ${r.factors[0] || "multiple factors"}`);
      return `Found ${high.length} high-risk file${high.length > 1 ? "s" : ""}:\n\n${lines.join("\n")}`;
    }

    if (msg.includes("dead code") || msg.includes("unused")) {
      if (!ctx.deadCode || ctx.deadCode.length === 0) {
        return ctx.deadCodeLines > 0
          ? `${ctx.deadCodeLines.toLocaleString()} lines of dead code detected. Run analysis to see details.`
          : "No dead code detected — your codebase looks clean!";
      }
      const byFile = new Map<string, number>();
      for (const item of ctx.deadCode) {
        byFile.set(item.file_path, (byFile.get(item.file_path) || 0) + item.lines_saved);
      }
      const lines = Array.from(byFile.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([file, saved]) => `• **${file}** — ${saved} lines`);
      return `${ctx.deadCode.length} dead code items across ${byFile.size} files (${ctx.deadCodeLines.toLocaleString()} lines total).\n\nTop files:\n${lines.join("\n")}`;
    }

    if (msg.includes("migration plan") || msg.includes("order") || msg.includes("what should i migrate") || msg.includes("where to start")) {
      if (!ctx.migrationPlan || ctx.migrationPlan.length === 0) {
        return "No migration plan available yet. Run analysis first to generate one.";
      }
      const sorted = [...ctx.migrationPlan].sort((a, b) => a.order - b.order);
      const lines = sorted.map(
        (s) => `${s.order}. **${s.file_path}** — ${s.risk_level} risk, ~${s.estimated_transformations} transformations`
      );
      return `Recommended migration order:\n\n${lines.join("\n")}\n\nStart from the top — leaf modules first to minimize breakage.`;
    }

    if (msg.includes("progress") || msg.includes("how far") || msg.includes("done")) {
      const pct = ctx.fileCount > 0 ? Math.round((ctx.migratedFiles / ctx.fileCount) * 100) : 0;
      if (ctx.migratedFiles === 0) {
        return "No files have been migrated yet. Start by running analysis, then transform files.";
      }
      if (ctx.migratedFiles === ctx.fileCount) {
        return `All ${ctx.fileCount} files have been migrated! You're at 100%. Check the dashboard for details.`;
      }
      return `${ctx.migratedFiles}/${ctx.fileCount} files migrated (${pct}%). ${ctx.fileCount - ctx.migratedFiles} remaining.`;
    }

    if (msg.includes("file") && (msg.includes("how many") || msg.includes("list") || msg.includes("what"))) {
      return `The project has ${ctx.fileCount} files with ${ctx.totalLines.toLocaleString()} total lines of code.`;
    }

    if (msg.includes("help") || msg.includes("what can you")) {
      return "I can help with your migration project! Try asking:\n\n• \"Give me a summary\"\n• \"What are the high-risk files?\"\n• \"Show me the migration plan\"\n• \"What's the dead code situation?\"\n• \"How far along is the migration?\"\n• \"Where should I start?\"";
    }

    if (msg.includes("hello") || msg.includes("hi") || msg === "hey") {
      return `Hi! I'm your AI assistant for the **${ctx.name}** project. Ask me about the summary, risks, dead code, migration plan, or progress.`;
    }

    return `I can help with your **${ctx.name}** migration project. Try asking about the summary, risks, dead code, migration plan, or progress. Type "help" to see all options.`;
  };

  const simulateResponse = useCallback(
    (userMessage: string) => {
      setIsTyping(true);
      const response = generateResponse(userMessage);
      setTimeout(() => {
        setIsTyping(false);
        updateActiveMessages((prev) => [...prev, { text: response, isUser: false }]);
      }, 800);
    },
    [updateActiveMessages, projectContext],
  );

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() === "" || isTyping) return;
    const userMessage = input;

    // Auto-create a chat if none exists
    if (!activeChatId) {
      const newChat: ChatSession = {
        id: generateId(),
        title: userMessage.length > 30 ? userMessage.slice(0, 30) + "..." : userMessage,
        messages: [{ text: userMessage, isUser: true }],
        createdAt: Date.now(),
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      setInput("");
      // Simulate response for this new chat
      setIsTyping(true);
      const response = generateResponse(userMessage);
      setTimeout(() => {
        setIsTyping(false);
        setChats((prev) =>
          prev.map((c) =>
            c.id === newChat.id
              ? { ...c, messages: [...c.messages, { text: response, isUser: false }] }
              : c,
          ),
        );
      }, 800);
      return;
    }

    updateActiveMessages((prev) => [...prev, { text: userMessage, isUser: true }]);
    setInput("");
    simulateResponse(userMessage);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const renderText = (text: string) => {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="font-semibold text-white">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <React.Fragment key={j}>{part}</React.Fragment>
            ),
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat history sidebar */}
      <div className="w-64 shrink-0 border-r border-border bg-card/50 flex flex-col">
        <div className="shrink-0 p-3 border-b border-border">
          <button
            onClick={createNewChat}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-3">
              No conversations yet. Start a new chat to begin.
            </p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={cn(
                  "group flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors",
                  chat.id === activeChatId
                    ? "bg-[#36B7FC]/10 text-[#36B7FC]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{chat.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-border flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#36B7FC]" />
            <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
            {projectContext && (
              <span className="text-xs text-muted-foreground">
                — {projectContext.name}
              </span>
            )}
          </div>
        </div>

        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-6">
          {!activeChatId || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="h-12 w-12 text-[#36B7FC] mb-4" />
              <h3 className="text-foreground text-xl font-medium mb-2">
                How can I help you?
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-8">
                Ask about your migration summary, risks, dead code, or progress.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {["Summary", "High-risk files?", "Migration plan", "Dead code?"].map(
                  (q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        if (!activeChatId) {
                          const newChat: ChatSession = {
                            id: generateId(),
                            title: q,
                            messages: [{ text: q, isUser: true }],
                            createdAt: Date.now(),
                          };
                          setChats((prev) => [newChat, ...prev]);
                          setActiveChatId(newChat.id);
                          setIsTyping(true);
                          const response = generateResponse(q);
                          setTimeout(() => {
                            setIsTyping(false);
                            setChats((prev) =>
                              prev.map((c) =>
                                c.id === newChat.id
                                  ? { ...c, messages: [...c.messages, { text: response, isUser: false }] }
                                  : c,
                              ),
                            );
                          }, 800);
                        } else {
                          updateActiveMessages((prev) => [...prev, { text: q, isUser: true }]);
                          simulateResponse(q);
                        }
                      }}
                      className="text-xs px-4 py-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-[#36B7FC]/50 transition-colors"
                    >
                      {q}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn("flex", msg.isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.isUser
                        ? "bg-[#2DA1E0] text-white rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm",
                    )}
                  >
                    {msg.isUser ? msg.text : renderText(msg.text)}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-muted rounded-tl-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#36B7FC] animate-pulse" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#36B7FC] animate-pulse [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#36B7FC] animate-pulse [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input form */}
        <form
          onSubmit={handleSubmit}
          className={cn(
            "shrink-0 p-4 border-t transition-colors",
            isFocused ? "border-[#36B7FC]/50 bg-card" : "border-border bg-card/50",
          )}
        >
          <div className="max-w-3xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask about your migration..."
              className="w-full bg-muted border border-border rounded-full py-3 pl-5 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#36B7FC]/50"
            />
            <button
              type="submit"
              disabled={input.trim() === "" || isTyping}
              className={cn(
                "absolute right-2 rounded-full p-2 transition-colors",
                input.trim() === "" || isTyping
                  ? "text-muted-foreground bg-muted cursor-not-allowed"
                  : "text-white bg-[#2DA1E0] hover:bg-[#36B7FC]",
              )}
            >
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIMessageBar;
