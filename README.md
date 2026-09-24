# superagent-web

React web app for the Super Agent Platform (Django backend in `../Super Agent Platform/superagent-django`).

**Stack:** React 18 · Vite 6 · TypeScript · Tailwind CSS v4 · TanStack Query · Zustand · React Router · Recharts · lucide-react

## Run it

```bash
cd superagent-web
npm install
cp .env.example .env      # point VITE_API_URL at your Django server
npm run dev               # http://localhost:5173
```

The backend must be served by an ASGI server (Daphne/Uvicorn) for WebSockets to work, and CORS must allow the dev origin (development settings already set `CORS_ALLOW_ALL_ORIGINS = True`).

| Env var | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Django base URL |
| `VITE_WS_URL` | derived from API URL | Channels base URL (`ws://` / `wss://`) |
| `VITE_GOOGLE_CLIENT_ID` | — | Optional. Shows "Continue with Google" on login (`/auth/google/`) |

Build for production: `npm run build` → static files in `dist/`.

## Screens → API

| Route | Screen | Endpoints |
|---|---|---|
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth | `/auth/*` |
| `/` | Home dashboard | `/dashboard/`, `/quick-tasks/`, `/approvals/{id}/decide/` |
| `/chat` | Chat + live execution trace + inline approvals | `/tasks/*`, `ws/tasks/<id>/` |
| `/approvals`, `/approvals/:id` | Inbox, history, rules | `/approvals/*` |
| `/agents`, `/agents/library`, `/agents/:id` | My agents, template library, agent detail (overview / tasks / live / audit / settings) | `/agents/*`, `ws/agents/<id>/live/` |
| `/workflows`, `/workflows/:id` | Step-list builder + runs | `/workflows/*` |
| `/customers`, `/customers/:id` | Customer memory + interaction timeline | `/memory/*` |
| `/costs` · `/audit` · `/compliance` · `/qa` | Governance | `/costs/*`, `/audit/*`, `/compliance/*`, `/qa/*` |
| `/settings/*` | Profile, integrations & channels, team, notifications | `/profile/*`, `/integrations/*`, `/team/*`, `/notifications/settings/` |

Global: `Ctrl/⌘ K` search (`/search/`), notification bell (`/notifications/*` + `ws/notifications/`), light/dark toggle.

## How it's put together

```
src/
  api/client.ts        axios instance, Bearer token, auto-refresh on 401 (/auth/token/refresh/)
  api/types.ts         Task, TaskStep, Agent, Approval, Notification
  lib/useLiveSocket.ts Channels hook: ?token=<jwt>, ping keep-alive, reconnect w/ backoff
  store/               zustand: auth (persisted), ui (theme, search, sidebar)
  components/          Layout (sidebar/topbar), CommandPalette, TaskTrace, ApprovalCard, Markdown, ui kit
  pages/               one file per area
```

- **Chat threading:** the client generates a `conversation_id` (UUID) for each new chat and sends it with every follow-up; the sidebar groups `/tasks/` by it.
- **Live trace:** while a task is queued/running/waiting, the turn opens `ws/tasks/<id>/`, appends `step_update` events, and refetches on `status_changed`. It also polls every 5s as a fallback, so it still works if Redis/Channels is down.
- **Clarifications:** `/tasks/create/` 400s with `needs_clarification` / `needs_file_selection` are shown as agent messages (Drive files become clickable chips).

## Known backend gaps

- OAuth callbacks redirect to the Flutter app (`_OAUTH_COMPLETE_URL` in `apps/integrations/views.py`). The web app opens the consent screen in a popup and refreshes when you return to the tab. Make that URL configurable to get a clean redirect back to `/settings/integrations`.
- Slack, Notion and GitHub have no `auth-url` endpoint yet, so they show "Coming soon".
