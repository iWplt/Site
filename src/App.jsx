import { useEffect, useState } from "react";

function formatDate(value) {
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  async function loadMessages() {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setMessages(await res.json());
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  useEffect(() => {
    loadMessages();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not post message");
      setMessages((prev) => [data, ...prev]);
      setBody("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <span className="badge">Live · SQLite backed</span>
        <h1>The Guestbook</h1>
        <p className="subtitle">
          Sign in from anywhere. Every note is stored by the API and shared with
          the next visitor.
        </p>
      </header>

      <section className="card">
        <form className="composer" onSubmit={handleSubmit}>
          <div className="row">
            <input
              className="input"
              type="text"
              placeholder="Your name"
              value={name}
              maxLength={60}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <textarea
            className="input textarea"
            placeholder="Leave a message…"
            value={body}
            maxLength={500}
            required
            rows={3}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="actions">
            {error && <span className="error">{error}</span>}
            <button className="button" type="submit" disabled={!name || !body}>
              Sign the guestbook
            </button>
          </div>
        </form>
      </section>

      <section className="feed">
        <div className="feed-head">
          <h2>Recent notes</h2>
          <span className="count">{messages.length}</span>
        </div>

        {status === "loading" && <p className="muted">Loading messages…</p>}
        {status === "error" && (
          <p className="error">Couldn&apos;t reach the API: {error}</p>
        )}
        {status === "ready" && messages.length === 0 && (
          <p className="muted">No messages yet — be the first to sign.</p>
        )}

        <ul className="messages">
          {messages.map((message) => (
            <li key={message.id} className="message">
              <div className="avatar" aria-hidden="true">
                {message.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <span className="message-name">{message.name}</span>
                  <span className="message-date">
                    {formatDate(message.created_at)}
                  </span>
                </div>
                <p className="message-text">{message.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="footer">
        Built with React, Vite, Express and SQLite.
      </footer>
    </main>
  );
}
