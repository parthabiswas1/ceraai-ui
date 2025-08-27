// src/App.jsx
import { useEffect, useState } from "react";
import "./styles.css";

/** ===== CONFIG ===== */
const BASE_URL = "https://ceraai-erp-setup-copilot.onrender.com";
const USER = "demo";
const PASS = "demo";

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
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /** ===== UI STATE ===== */
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
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
            (data.complete
              ? "I can generate your template now."
              : "Provide more details."),
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

    const res = await api("/interview/answer", {
      method: "POST",
      body: { text },
    });
    setText("");
    setReady(Boolean(res.complete));
    await refreshState();

    if (res.assist) {
      setMessages((m) => [...m, { sender: "ceraai", text: res.assist }]);
    }

    if (res.complete) {
      setMessages((m) => [
        ...m,
        {
          sender: "ceraai",
          text: "I have enough to generate your Legal Entity template.",
        },
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

  /** NEW: start a clean session */
  const newSession = () => {
    const fresh = `ui-${Date.now()}`;
    setRunId(fresh);
    setMessages([]);
    setText("");
    setState(null);
    setReady(false);
    setError("");
  };

  useEffect(() => {
    nextQuestion().catch(() => {});
    // eslint-disable-next-line
  }, [runId]);

  return (
    <div className="app">
      <nav className="header">
        <div className="brand">CERAai – ERP-SETUP-COPILOT</div>
        <div className="runid">
          Run ID: <code>{runId}</code>
        </div>
      </nav>

      <div className="body">
        {/* Sidebar */}
        <aside className="sidebar">
          <button className="step-card" onClick={newSession}>
            🧪 New session
          </button>
        </aside>

        {/* Main */}
        <main className="main">
          {error ? <div className="error">{error}</div> : null}

          {/* Chat */}
          <section className="card chat">
            <div className="card-head">
              <h2>Interview</h2>
              <div />
            </div>

            <div className="chat-body">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`bubble ${m.sender === "user" ? "user" : "bot"}`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div
              className="chat-input"
              style={{ gridTemplateColumns: "1fr auto" }}
            >
              <textarea
                placeholder="Type your answer in natural language…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ resize: "vertical", minHeight: 60 }}
              />
              <button className="btn primary" onClick={submitFreeText}>
                Send
              </button>
            </div>
            <div className="powered-by">Powered by CERA AI</div>
          </section>

          {/* State */}
          <section className="card">
            <div className="card-head">
              <h2>State</h2>
            </div>
            <pre className="code">{JSON.stringify(state || {}, null, 2)}</pre>
          </section>
        </main>
      </div>
    </div>
  );
}
