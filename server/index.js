import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { addMessage, countMessages, listMessages } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", messages: countMessages() });
});

app.get("/api/messages", (_req, res) => {
  res.json(listMessages());
});

app.post("/api/messages", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const body = String(req.body?.body ?? "").trim();

  if (!name || !body) {
    return res.status(400).json({ error: "Both 'name' and 'body' are required." });
  }
  if (name.length > 60 || body.length > 500) {
    return res.status(400).json({ error: "'name' max 60 chars, 'body' max 500 chars." });
  }

  const message = addMessage({ name, body });
  res.status(201).json(message);
});

// In production, serve the built client from dist/.
if (process.env.NODE_ENV === "production") {
  const distDir = join(__dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(join(distDir, "index.html")));
}

app.listen(PORT, () => {
  console.log(`[api] Site API listening on http://localhost:${PORT}`);
});
