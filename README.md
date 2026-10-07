# superagent-web

React web app for the Super Agent Platform (Django backend in `../Super Agent Platform/superagent-django`).

**Stack:** React 18 · Vite 6 · TypeScript · Tailwind CSS v4 · TanStack Query · Zustand · React Router · Recharts · lucide-react

## Run it

```bash
cd superagent-web
npm install
npm run dev               # http://localhost:5173
```

By default the app talks to the same backend as the Flutter app: `https://super-agent-platform.onrender.com`.
To use a local Django instead, copy `.env.example` to `.env` and set `VITE_API_URL=http://localhost:8000`.

The design follows the Flutter app (`super_agent_flutter`): same splash, onboarding slides, navy auth screens,
brand blue `#1A6FFF`, and the Home / Inbox / Tasks / Agents navigation with the New Task button.

The backend must be served by an ASGI server (Daphne/Uvicorn) for WebSockets to work, and CORS must allow the dev origin (development settings already set `CORS_ALLOW_ALL_ORIGINS = True`).

| Env var | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `https://super-agent-platform.onrender.com` | Django base URL |
| `VITE_WS_URL` | derived from API URL | Channels base URL (`ws://` / `wss://`) |
| `VITE_GOOGLE_CLIENT_ID` | Flutter app's web client | Google sign-in (`/auth/google/`). Add your site's origin to the client's authorised JavaScript origins |

Build for production: `npm run build` → static files in `dist/`. `public/_redirects` makes client-side routes work on Netlify.

## Screens → API

| Route | Screen | Endpoints |
|---|---|---|
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth | `/auth/*` |
| `/welcome` | Onboarding slides (first visit) | — |
| `/` | Home dashboard + business pulse + follow-ups | `/dashboard/`, `/quick-tasks/`, `/business/dashboard/`, `/crm/follow-ups/` |
| `/tasks`, `/tasks/new` | Task list with filters/search, New Task form (attach files / folders) | `/tasks/`, `/search/tasks/`, `/tasks/new-task-form/`, `/tasks/create/` |
| `/chat` | Conversations + live trace + inline approvals, file attachments, agent questions (`needs_input`) and document View / Download | `/tasks/*`, `/tasks/documents/<id>/view|download/`, `ws/tasks/<id>/` |
| `/inbox`, `/inbox/:id` | Approvals: awaiting, history, tool rules, who approves (per-agent policy) | `/approvals/*`, `/approvals/policies/` |
| `/crm` | Deals pipeline (drag & drop), follow-ups, lead scores, inactive contacts, customer overview | `/crm/*` |
| `/business`, `/business/:page` | Business onboarding (upload → review → confirm → import → hire agents), records browser + CSV export, dynamic dashboards | `/business/*` |
| `/agents`, `/agents/library`, `/agents/:id` | My agents, template library, agent detail (overview / tasks / live / audit / settings) | `/agents/*`, `ws/agents/<id>/live/` |
| `/workflows`, `/workflows/:id` | Step-list builder + runs | `/workflows/*` |
| `/customers`, `/customers/:id` | Customer memory + interaction timeline | `/memory/*` |
| `/costs` · `/audit` · `/compliance` · `/qa` | Governance | `/costs/*`, `/audit/*`, `/compliance/*`, `/qa/*` |
| `/settings/*` | Profile, connected apps & channels, team (Admin / Manager / Member, manager assignment, activity), notifications | `/profile/*`, `/integrations/*`, `/team/*`, `/notifications/settings/` |

Role-aware UI: the current role comes from the `header` of `/profile/settings/` (`owner` = Admin). Admin-only actions
(confirm business profile, hire recommended agents, approval policies, role changes) are hidden for others.

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
- **Files:** attach files, a folder or a zip (drag & drop or paste works too). With files the message goes as multipart (`files` repeated, `paths` for folders); the prompt can be empty for a summary. Limits match the backend: 25 MB a file, 100 MB in total.
- **Agent questions:** a task with status `needs_input` shows its question (`result`) with `input_options` as chips; picking sends `selected_options` in the same conversation (typing an answer works too).
- **Documents:** `task.documents` render with View (PDF / image / text in a viewer, Word / PPT / Excel as preview text) and Download. Files are fetched through the API client because Django sends `X-Frame-Options: DENY`. Google Drive links show only when the user asked for Drive.
- **Clarifications:** `/tasks/create/` 400s with `needs_clarification` / `needs_file_selection` are shown as agent messages (Drive files become clickable chips).

## Known backend gaps

- OAuth callbacks redirect to the Flutter app (`_OAUTH_COMPLETE_URL` in `apps/integrations/views.py`). The web app opens the consent screen in a popup and refreshes when you return to the tab. Make that URL configurable to get a clean redirect back to `/settings/integrations`.
- Slack, Notion and GitHub have no `auth-url` endpoint yet, so they show "Coming soon".
