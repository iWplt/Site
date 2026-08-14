# Site

A small, modern full-stack **guestbook**. Visitors leave a note; the API stores
it in SQLite and shares it with everyone else.

## Stack

- **Frontend:** React + Vite (dev server on port `5173`)
- **Backend:** Express REST API (port `3001`)
- **Storage:** SQLite via `better-sqlite3` (file under `data/`, git-ignored)

## Getting started

```bash
npm install      # install dependencies
npm run dev      # run the API and the Vite dev server together
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the
Express API, so a single origin serves the whole app during development.

## API

| Method | Path            | Description                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/api/health`   | Health check + message count         |
| GET    | `/api/messages` | List recent messages (newest first)  |
| POST   | `/api/messages` | Create a message `{ name, body }`    |

Example:

```bash
curl -s http://localhost:3001/api/health
curl -s -X POST http://localhost:3001/api/messages \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","body":"Hello from the API!"}'
```

## Scripts

| Script            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Run API (`--watch`) and Vite dev server together   |
| `npm run build`   | Build the client to `dist/`                        |
| `npm start`       | Serve the built client + API (production mode)     |

## Production

```bash
npm run build      # emit static client into dist/
npm start          # Express serves dist/ and the API on port 3001
```
