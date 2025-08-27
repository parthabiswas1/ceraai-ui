// src/App.jsx
import { useEffect, useState } from "react";
import "./styles.css";

/** ===== CONFIG ===== */
const BASE_URL = "https://ceraai-erp-setup-copilot.onrender.com";
const USER = "demo";
const PASS = "demo";

/** ===== WELCOME ===== */
const WELCOME =
  "Hi, I am CERA, your ERP setup copilot. I will help you set up the Legal Entity in ERP. " +
  "I will ask a few simple questions to determine which template you’ll use to upload information " +
  "so I can create the Legal Entity objects for you. Don’t hesitate to ask questions or clarifications.";

/** ===== HELPERS ===== */
function useRunId() {
  const [runId, setRunId] = useState(() => {
    return localStorage.getItem("ceraai_run_id") || `ui-${Date.now()}`;
  });
  useEffect(() => localStorage.setItem("ceraai_run_id", runId), [runId]);
  return [runId, setRunId];
}

export default function App() {
  const [runId, setRunId] = useRunId();
  const AUTH = "Basic " + btoa(`${USER}:${PASS}`);

  const api = async (path, { method = "GET", body, headers = {} } = {}) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: AUTH,
        "Content-Type": "application/json",
        "X-Run-ID": runId,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} :: ${txt}`);
    }
    return res.json();
  };

  const downloadWithAuth = async (path, filename) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: AUTH, "X-Run-ID": runId },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  };

  /** ===== UI STATE ===== */
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [issues, setIssues] = useState([]);
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  /** ===== ACTIONS ===== */
  const nextQuestion = async () => {
    setError("");
    try {
      const data = await api("/interview/next");
      setReady(Boolean(data.complete));
      setMessages((m) => [
        ...m,
        {
          sender: "ceraai",
          text:
            data.question ||
            (data.complete ? "I can generate your template now." : "Provide more details."),
        },
      ]);
      await refreshState();
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const submitFreeText = async () => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { sender: "user", text }]);

    const res = await api("/interview/answer", { method: "POST", body: { text } });
    setText("");
    setReady(Boolean(res.complete));
    await refreshState();

    if (res.assist) {
      setMessages((m) => [...m, { sender: "ceraai", text: res.assist }]);
    }

    if (res.complete) {
      setMessages((m) => [
        ...m,
        { sender: "ceraai", text: "I have enough to generate your Legal Entity template." },
      ]);
      return;
    }

    if (res.next && res.next.question) {
      setMessages((m) => [...m, { sender: "ceraai", text: res.next.question }]);
    } else {
      await nextQuestion();
    }
  };

  const refreshState = async () => {
    setError("");
    try {
      const s = await api("/state");
      setState(s);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const downloadTemplate = async () => {
    setError("");
    try {
      await downloadWithAuth("/template/draft", "legal_entity_template.xlsx");
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const uploadAndValidate = async () => {
    if (!file) return;
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch(`${BASE_URL}/files/upload`, {
        method: "POST",
        headers: { Authorization: AUTH, "X-Run-ID": runId },
        body: fd,
      });
      if (!up.ok) throw new Error(`${up.status} ${up.statusText}`);
      const res = await api("/files/validate", { method: "POST" });
      setIssues(res.issues || []);
      setMessages((m) => [
        ...m,
        { sender: "ceraai", text: res.issues?.length ? `Found ${res.issues.length} issue(s). Download review for details.` : "Template is error-free." },
      ]);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const downloadReview = async () => {
    setError("");
    try {
      await downloadWithAuth("/files/review", "review.xlsx");
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  /** NEW: start a clean session (show welcome immediately) */
  const newSession = () => {
    const fresh = `ui-${Date.now()}`;
    setRunId(fresh);
    setMessages([{ sender: "ceraai", text: WELCOME }]);
    setText("");
    setFile(null);
    setIssues([]);
    setState(null);
    setReady(false);
    setError("");
  };

  /** On first load & whenever runId changes: ensure welcome appears once, then ask first question */
  useEffect(() => {
    // If there are no messages yet in this session, seed the welcome
    setMessages((m) => (m.length === 0 ? [{ sender: "ceraai", text: WELCOME }] : m));
    nextQuestion().catch(() => {});
    // eslint-disable-next-line
  }, [runId]);

  return (
    <div className="app">
      {/* Header */}
      <nav className="header">
        <div className="brand">CERAai – ERP-SETUP-COPILOT</div>
        <div className="runid">Run ID: <code>{runId}</code></div>
      </nav>

      <div className="body">
        {/* Sidebar */}
        <aside className="sidebar">
          <button className="new-session-btn" onClick={newSession}>
            New session
          </button>
          <div className="step">📄 Template</div>
          <div className="step">⬆️ Upload & Validate</div>
        </aside>

        {/* Main */}
        <main className="main">
          {/* Errors */}
          {error ? <div className="error">{error}</div> : null}

          {/* Chat */}
          <section className="card chat">
            <div className="card-head">
              <h2>Interview</h2>
              <div />
            </div>

            <div className="chat-body">
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.sender === "user" ? "user" : "bot"}`}>
                  {m.text}
                </div>
              ))}
            </div>

            <div className="chat-input" style={{ gridTemplateColumns: "1fr auto" }}>
              <textarea
                placeholder="Type your answer in natural language…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ resize: "vertical", minHeight: 60 }}
              />
              <button className="btn primary" onClick={submitFreeText}>Send</button>
            </div>
            <div className="powered-by">
              <span>Powered by CERA AI</span>
              <img src="/cera-logo.png" alt="CERA logo" className="powered-logo" />
            </div>

          </section>

          {/* State */}
          <section className="card">
            <div className="card-head">
              <h2>State</h2>
            </div>
            <pre className="code">{JSON.stringify(state || {}, null, 2)}</pre>
          </section>

          {/* Template + Upload/Validate */}
          <section className="card">
            <div className="card-head">
              <h2>Template & Validation</h2>
              <div className="actions" style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={downloadTemplate} disabled={!ready}>
                  Download Template (XLSX)
                </button>
                <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button className="btn" onClick={uploadAndValidate}>
                  Upload & Validate
                </button>
                <button className="btn" onClick={downloadReview}>
                  Download Review
                </button>
              </div>
            </div>
            {issues.length > 0 ? (
              <div className="error" style={{ margin: 12 }}>
                Found {issues.length} issue(s):{" "}
                {issues.map((i, idx) => (
                  <span key={idx}>{i.field}@row{i.row}{idx < issues.length - 1 ? ", " : ""}</span>
                ))}
              </div>
            ) : (
              <div style={{ padding: 12, color: "#6b7280" }}>
                {ready ? "Ready: You can download the template now." : "Waiting for enough info to generate the template."}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
