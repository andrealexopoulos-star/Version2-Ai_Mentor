import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useVirtualizer } from "@tanstack/react-virtual";
import { apiClient, API_BASE } from "../lib/api";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { AGENT_DEFINITIONS, MODE_DEFINITIONS, TIER_RANK } from "../lib/soundboardAgents";

const TIER_DISPLAY = {
  free: "Starter (Free)",
  starter: "Starter",
  pro: "Professional",
  enterprise: "Enterprise",
};

function formatModelName(modelUsed) {
  if (!modelUsed) return "";
  if (modelUsed.startsWith("boardroom/")) return "Boardroom";
  if (modelUsed.startsWith("trinity/")) return "Trinity";
  if (modelUsed.includes("fallback/error")) return "";
  return "Ask BIQc AI";
}

function groupConversations(conversations) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 7);

  const groups = { starred: [], today: [], yesterday: [], week: [], older: [] };
  for (const conv of conversations || []) {
    if (conv.is_starred) {
      groups.starred.push(conv);
      continue;
    }
    const ts = new Date(conv.updated_at || conv.created_at || Date.now());
    if (ts >= startToday) groups.today.push(conv);
    else if (ts >= startYesterday) groups.yesterday.push(conv);
    else if (ts >= startWeek) groups.week.push(conv);
    else groups.older.push(conv);
  }
  return groups;
}

function ConversationSidebar({
  collapsed,
  onToggle,
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onStar,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const groups = groupConversations(conversations);

  const section = (title, items) => (
    <>
      {items.length > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "10px 10px 6px" }}>{title}</div>}
      {items.map((c) => (
        <div
          key={c.id}
          style={{
            margin: "0 8px 6px",
            borderRadius: 8,
            background: activeId === c.id ? "rgba(255,255,255,0.12)" : "transparent",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: 8,
          }}
        >
          {editingId === c.id ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                if (editValue.trim()) onRename(c.id, editValue.trim());
                setEditingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editValue.trim()) {
                  onRename(c.id, editValue.trim());
                  setEditingId(null);
                }
              }}
              style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 6px" }}
            />
          ) : (
            <button
              onClick={() => onSelect(c.id)}
              onDoubleClick={() => {
                setEditingId(c.id);
                setEditValue(c.title || "New Conversation");
              }}
              style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 13 }}
              title={c.title || "New Conversation"}
            >
              {(c.is_starred ? "★ " : "") + (c.title || "New Conversation")}
            </button>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={() => { setEditingId(c.id); setEditValue(c.title || "New Conversation"); }} style={menuBtn}>Rename</button>
            <button onClick={() => onStar(c)} style={menuBtn}>{c.is_starred ? "Unstar" : "Star"}</button>
            <button onClick={() => onDelete(c.id)} style={menuBtn}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );

  if (collapsed) {
    return (
      <div style={{ width: 52, borderRight: "1px solid rgba(255,255,255,0.08)", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onToggle} style={iconBtn}>☰</button>
        <button onClick={onNew} style={iconBtn}>＋</button>
      </div>
    );
  }

  return (
    <div style={{ width: 260, borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minWidth: 260 }}>
      <div style={{ display: "flex", gap: 8, padding: 10 }}>
        <button onClick={onToggle} style={iconBtn}>◀</button>
        <button onClick={onNew} style={iconBtn}>New</button>
      </div>
      <div style={{ overflowY: "auto", paddingBottom: 10 }}>
        {section("Starred", groups.starred)}
        {section("Today", groups.today)}
        {section("Yesterday", groups.yesterday)}
        {section("This week", groups.week)}
        {section("Older", groups.older)}
      </div>
    </div>
  );
}

function AgentToolbar({ active, onSelect, userTier }) {
  const tierRank = TIER_RANK[userTier] || 0;
  return (
    <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
      {Object.entries(AGENT_DEFINITIONS).map(([key, agent]) => {
        const locked = (TIER_RANK[agent.minTier] || 0) > tierRank;
        return (
          <button
            key={key}
            onClick={() => !locked && onSelect(key)}
            title={locked ? `Requires ${TIER_DISPLAY[agent.minTier] || "higher tier"}` : agent.description}
            style={{
              border: "1px solid",
              borderColor: active === key ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
              borderRadius: 20,
              background: active === key ? "rgba(255,255,255,0.12)" : "transparent",
              color: locked ? "rgba(255,255,255,0.3)" : "#fff",
              padding: "4px 10px",
              fontSize: 12,
              cursor: locked ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {agent.icon} {agent.label}{locked ? " 🔒" : ""}
          </button>
        );
      })}
    </div>
  );
}

function CoverageBanner({ status, pct, sources }) {
  const styles = {
    FULL: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", dot: "#10b981", label: "Full coverage" },
    DEGRADED: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", dot: "#f59e0b", label: "Partial coverage" },
    BLOCKED: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", dot: "#ef4444", label: "Complete your profile to get better answers" },
  };
  const s = styles[status] || styles.DEGRADED;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", background: s.bg, borderBottom: `1px solid ${s.border}`, fontSize: 12, cursor: "pointer" }}>
      <span style={{ color: s.dot, fontSize: 8 }}>●</span>
      <span style={{ color: s.dot }}>{s.label}</span>
      {sources?.length > 0 && <span style={{ color: "rgba(255,255,255,0.35)" }}>· {sources.join(" + ")}</span>}
      {pct != null && <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{pct}% data coverage</span>}
    </div>
  );
}

function MessageMetadataDrawer({ metadata, onActionClick }) {
  const [open, setOpen] = useState(false);
  const sources = metadata?.evidence_pack?.sources || [];
  const grade = metadata?.retrieval_contract?.answer_grade;
  const actions = metadata?.suggested_actions || [];
  const gradeLabel = { FULL: "High confidence", PARTIAL: "Some data gaps", DEGRADED: "Limited data", BLOCKED: "More information needed" };
  const gradeColour = { FULL: "#10b981", PARTIAL: "#f59e0b", DEGRADED: "#ef4444", BLOCKED: "#6b7280" };

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen(!open)} style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {metadata?.agent_name || "BIQc"} · {gradeLabel[grade] || "Processing"} · {Math.round((metadata?.confidence_score || 0) * 100)}% confidence {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: "12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {sources.length > 0 && (
            <div>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>Data sources: </span>
              {sources.map((s) => (
                <span key={`${s.id || s.source}-${s.freshness}`} style={{ marginRight: 10, color: "rgba(255,255,255,0.7)" }}>{s.source} ({s.freshness})</span>
              ))}
            </div>
          )}
          {grade && (
            <div>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>Answer quality: </span>
              <span style={{ color: gradeColour[grade] || "#fff" }}>{gradeLabel[grade]}</span>
            </div>
          )}
          {metadata?.coverage_window?.coverage_start && (
            <div>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>Analysis period: </span>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{metadata.coverage_window.coverage_start?.slice(0, 10)} → {metadata.coverage_window.coverage_end?.slice(0, 10)}</span>
            </div>
          )}
          {actions.length > 0 && (
            <div>
              <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>What you can do next:</div>
              {actions.map((a) => (
                <button key={a.action} onClick={() => onActionClick?.(a.prompt)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", marginBottom: 4, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 12 }}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ content, metadata, isStreaming, onActionClick }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {AGENT_DEFINITIONS[metadata?.agent_id]?.label || "BIQc"}
          {metadata?.model_used && " · " + formatModelName(metadata.model_used)}
        </span>
        {isStreaming && <span style={{ fontSize: 11, color: "#60a5fa" }}>BIQc is thinking...</span>}
      </div>
      <div style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.9)" }} className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ""}</ReactMarkdown>
      </div>
      {!isStreaming && metadata && <MessageMetadataDrawer metadata={metadata} onActionClick={onActionClick} />}
    </div>
  );
}

function MessageThread({ messages, isStreaming, streamingContent, onActionClick }) {
  const parentRef = useRef(null);
  const rows = useMemo(() => {
    const out = [...(messages || [])];
    if (isStreaming) out.push({ role: "assistant", content: streamingContent, metadata: {}, _streaming: true });
    return out;
  }, [messages, isStreaming, streamingContent]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 4,
  });

  useEffect(() => {
    if (rows.length > 0) rowVirtualizer.scrollToIndex(rows.length - 1);
  }, [rows.length, streamingContent, rowVirtualizer]);

  return (
    <div ref={parentRef} style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((vRow) => {
          const message = rows[vRow.index];
          return (
            <div key={vRow.key} data-index={vRow.index} ref={rowVirtualizer.measureElement} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}>
              {message.role === "assistant" ? (
                <AssistantMessage content={message.content} metadata={message.metadata} isStreaming={Boolean(message._streaming)} onActionClick={onActionClick} />
              ) : (
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                  {message.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InputArea({ onSend, onStop, onAttach, isStreaming, mode, onModeChange, userTier }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);
  const tierRank = TIER_RANK[userTier] || 0;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value.trim());
        setValue("");
      }
    }
  };

  const handleModeSelect = (key, minTier) => {
    if (TIER_RANK[minTier] > tierRank) {
      alert(`${MODE_DEFINITIONS[key].label} mode requires ${TIER_DISPLAY[minTier] || "a higher plan"}.`);
      return;
    }
    onModeChange(key);
  };

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 14px" }}>
        <button onClick={onAttach} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", paddingBottom: 2 }} title="Attach file">📎</button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your business..."
          disabled={isStreaming}
          rows={1}
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", resize: "none", fontSize: 14, lineHeight: 1.5, fontFamily: "inherit" }}
        />
        {isStreaming ? (
          <button onClick={onStop} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "#fff", cursor: "pointer" }} title="Stop">⏹</button>
        ) : (
          <button onClick={() => { if (value.trim()) { onSend(value.trim()); setValue(""); } }} disabled={!value.trim()} style={{ background: value.trim() ? "#fff" : "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 10px", color: value.trim() ? "#000" : "rgba(255,255,255,0.4)", cursor: value.trim() ? "pointer" : "default" }}>↑</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, paddingLeft: 4, flexWrap: "wrap" }}>
        {Object.entries(MODE_DEFINITIONS).map(([key, m]) => {
          const locked = TIER_RANK[m.minTier] > tierRank;
          return (
            <button
              key={key}
              onClick={() => handleModeSelect(key, m.minTier)}
              title={locked ? `Requires ${TIER_DISPLAY[m.minTier] || "higher plan"}` : m.description}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid", borderColor: mode === key ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)", background: mode === key ? "rgba(255,255,255,0.12)" : "transparent", color: locked ? "rgba(255,255,255,0.25)" : mode === key ? "#fff" : "rgba(255,255,255,0.5)", cursor: locked ? "not-allowed" : "pointer" }}
            >
              {m.label}{locked ? " 🔒" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SoundboardPanel() {
  const { user, supabase } = useSupabaseAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingBuffer, setStreamingBuffer] = useState("");
  const [activeAgent, setActiveAgent] = useState("auto");
  const [activeMode, setActiveMode] = useState("auto");
  const [coverageStatus, setCoverageStatus] = useState(null);
  const [coveragePct, setCoveragePct] = useState(null);
  const [activeSources, setActiveSources] = useState([]);
  const [pendingUploadIds, setPendingUploadIds] = useState([]);
  const streamingBufferRef = useRef("");
  const esRef = useRef(null);
  const fileInputRef = useRef(null);
  const userTier = user?.subscription_tier || "free";

  const applyFinalPayload = (payload) => {
    setIsStreaming(false);
    const finalReply = payload?.reply || streamingBufferRef.current || "Something went wrong. Please try again.";
    setMessages((prev) => {
      const cloned = [...prev];
      const idx = cloned.findIndex((m) => m._streamingPlaceholder);
      const finalMessage = {
        role: "assistant",
        content: finalReply,
        metadata: {
          ...payload,
          model_used: payload?.model_used || payload?.mode_effective || payload?.mode,
          agent_id: payload?.agent_id || activeAgent,
        },
      };
      if (idx >= 0) cloned[idx] = finalMessage;
      else cloned.push(finalMessage);
      return cloned;
    });
    setCoverageStatus(payload?.guardrail || null);
    setCoveragePct(payload?.coverage_pct ?? null);
    setActiveSources((payload?.evidence_pack?.sources || []).map((s) => s.source).filter(Boolean));
    if (payload?.conversation_id) setActiveConversationId(payload.conversation_id);
    streamingBufferRef.current = "";
    setStreamingBuffer("");
  };

  const loadConversations = async () => {
    const res = await apiClient.get("/soundboard/conversations");
    setConversations(res?.data?.conversations || []);
  };

  const loadSettings = async () => {
    try {
      const res = await apiClient.get("/soundboard/settings");
      const settings = res?.data || {};
      setSidebarCollapsed(Boolean(settings.sidebar_collapsed));
      if (settings.default_agent) setActiveAgent(settings.default_agent);
      if (settings.default_mode) setActiveMode(settings.default_mode);
    } catch {
      // Keep defaults when settings table is missing/not migrated.
    }
  };

  const loadConversation = async (id) => {
    const res = await apiClient.get(`/soundboard/conversations/${id}`);
    setActiveConversationId(id);
    setMessages((res?.data?.messages || []).map((m) => ({ role: m.role, content: m.content, metadata: m.metadata || {} })));
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setCoverageStatus(null);
    setCoveragePct(null);
    setActiveSources([]);
  };

  const renameConversation = async (id, title) => {
    await apiClient.patch(`/soundboard/conversations/${id}`, { title });
    await loadConversations();
  };

  const deleteConversation = async (id) => {
    if (!window.confirm("Delete this conversation?")) return;
    await apiClient.delete(`/soundboard/conversations/${id}`);
    if (activeConversationId === id) startNewConversation();
    await loadConversations();
  };

  const starConversation = async (conversation) => {
    await apiClient.patch(`/soundboard/conversations/${conversation.id}`, { is_starred: !conversation.is_starred });
    await loadConversations();
  };

  useEffect(() => {
    loadConversations();
    loadSettings();
  }, []);

  useEffect(() => {
    if (!isStreaming) return undefined;
    const interval = setInterval(() => {
      if (streamingBufferRef.current !== streamingBuffer) setStreamingBuffer(streamingBufferRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [isStreaming, streamingBuffer]);

  const handleStop = () => {
    if (esRef.current?.close) esRef.current.close();
    setIsStreaming(false);
  };

  const handleAttach = () => fileInputRef.current?.click();

  const uploadFile = async (file) => {
    const form = new FormData();
    form.append("file", file);
    if (activeConversationId) form.append("conversation_id", activeConversationId);
    const res = await apiClient.post("/soundboard/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
    const id = res?.data?.upload_id;
    if (id) setPendingUploadIds((prev) => [...prev, id]);
  };

  const handleSend = async (prompt) => {
    const userMessage = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "", _streamingPlaceholder: true, metadata: {} }]);
    setIsStreaming(true);
    setStreamingBuffer("");
    streamingBufferRef.current = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const response = await fetch(`${API_BASE}/soundboard/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: prompt,
          conversation_id: activeConversationId,
          mode: activeMode,
          agent_id: activeAgent,
          upload_ids: pendingUploadIds,
        }),
      });
      if (!response.ok || !response.body) throw new Error("Connection dropped. Please send your message again.");

      const controller = new AbortController();
      esRef.current = { close: () => controller.abort() };

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let previewMode = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const raw of parts) {
          const line = raw.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let evt = null;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === "start") {
            setIsStreaming(true);
            setStreamingBuffer("");
            streamingBufferRef.current = "";
          } else if (evt.type === "thinking" || evt.type === "boardroom_phase" || evt.type === "trinity_provider") {
            const note = evt.message || "BIQc is thinking...";
            setMessages((prev) => {
              const cloned = [...prev];
              const idx = cloned.findIndex((m) => m._streamingPlaceholder);
              if (idx >= 0) cloned[idx] = { ...cloned[idx], content: note };
              return cloned;
            });
          } else if (evt.type === "delta") {
            if (evt.preview === true && previewMode) {
              streamingBufferRef.current += evt.text || "";
            } else {
              previewMode = false;
              streamingBufferRef.current += evt.text || "";
            }
          } else if (evt.type === "replacing") {
            previewMode = false;
            streamingBufferRef.current = "";
            setStreamingBuffer("");
          } else if (evt.type === "final") {
            applyFinalPayload(evt.payload || {});
            await loadConversations();
            setPendingUploadIds([]);
          } else if (evt.type === "error") {
            setIsStreaming(false);
            setMessages((prev) => prev.concat([{ role: "assistant", content: evt.message || "Something went wrong. Please try again.", metadata: {} }]));
          }
        }
      }
    } catch (err) {
      setIsStreaming(false);
      const text = err?.message || "Something went wrong. Please try again.";
      setMessages((prev) => {
        const cloned = [...prev];
        const idx = cloned.findIndex((m) => m._streamingPlaceholder);
        if (idx >= 0) cloned[idx] = { role: "assistant", content: text, metadata: {} };
        else cloned.push({ role: "assistant", content: text, metadata: {} });
        return cloned;
      });
    }
  };

  const onToggleSidebar = async () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try { await apiClient.patch("/soundboard/settings", { sidebar_collapsed: next }); } catch {}
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f0f0f", color: "#fff", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>
      <ConversationSidebar
        collapsed={sidebarCollapsed}
        onToggle={onToggleSidebar}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={(id) => loadConversation(id)}
        onNew={startNewConversation}
        onRename={renameConversation}
        onDelete={deleteConversation}
        onStar={starConversation}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <AgentToolbar active={activeAgent} onSelect={setActiveAgent} userTier={userTier} />
        {coverageStatus && <CoverageBanner status={coverageStatus} pct={coveragePct} sources={activeSources} />}
        <MessageThread messages={messages} isStreaming={isStreaming} streamingContent={streamingBuffer} onActionClick={(prompt) => handleSend(prompt)} />
        <InputArea onSend={handleSend} onStop={handleStop} onAttach={handleAttach} isStreaming={isStreaming} mode={activeMode} onModeChange={setActiveMode} userTier={userTier} />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const iconBtn = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 12,
};

const menuBtn = {
  background: "rgba(255,255,255,0.08)",
  border: "none",
  color: "rgba(255,255,255,0.8)",
  borderRadius: 6,
  padding: "3px 6px",
  fontSize: 11,
  cursor: "pointer",
};
