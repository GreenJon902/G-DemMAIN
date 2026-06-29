# g_web — Project Structure Overview

## What is g_web?

g_web is a Next.js monorepo web application for the G-DemMAIN Minecraft server. It currently provides a **server admin panel** (monitoring, logs, console, player lists) accessible to authorised users. HisDoc will be added as a second top-level feature.

---

## Monorepo Layout

```
scripts/g_web/
├── package.json          workspace root (npm workspaces)
├── .devenv               environment variables for dev
├── com/                  @g/com — shared library (Prisma, auth, webhooks)
├── nxt/                  @g/nxt — Next.js frontend
└── mcc/                  @g/mcc — Minecraft console WebSocket server
```

### Packages

| Package | Name | Purpose |
|---------|------|---------|
| `com/` | `@g/com` | Shared: Prisma client, auth session, webhook util, env config |
| `nxt/` | `@g/nxt` | Next.js 16 app (all pages, UI, server actions) |
| `mcc/` | `@g/mcc` | Node.js WebSocket server bridging RCON → browser console |

---

## @g/com — Common Library

### `com/lib/prisma.ts`

Singleton Prisma client backed by MariaDB. Usage pattern:

```typescript
import prisma from "@g/com/lib/prisma";
await prisma().user.findUnique({ where: { id: 1 } });
```

The client uses `@prisma/adapter-mariadb`. Connection details come from `C()` (the env config):
- `G_WEB_DATABASE_USER`, `G_WEB_DATABASE_PASSWORD`, `G_WEB_DATABASE_HOST`, `G_WEB_DATABASE_PORT`
- Database name: `g_web` (hardcoded)
- Connection pool limit: 5

### `com/prisma/schema.prisma`

Current schema — one model:

```prisma
model user {
  id               Int     @id @default(autoincrement())
  username         String  @unique @db.VarChar(50)
  password_hash    String  @db.VarChar(255)        // Argon2 hashed
  has_panel_access Boolean @default(false)
  totp_secret      String? @db.VarChar(32)          // TOTP 2FA secret, nullable
}
```

### `com/lib/auth.ts` — `SessionAccessor`

Wraps `iron-session` (encrypted cookie sessions). Key methods:
- `getSession()` → raw session object
- `getUser()` → `{ id, username, has_panel_access }` or null
- `requireLoggedIn()` → redirects to `/login` if not authenticated
- `getSudoMode()` → whether TOTP was verified within the last 30 minutes

### `com/lib/webhook.ts`

Wrapper for a Python script at `/opt/infra/scripts/webhooks.py`. Spawns it as a child process (non-blocking). Current message types:

```typescript
sendWebloginWebhook(name: string)          // user logged into website
sendWebcommandWebhook(name: string, command: string)  // user ran a command
```

Called as: `python3 webhooks.py <type> <arg1> [<arg2>]`

**Will be extended** with new HisDoc event types.

### `com/lib/environ.ts`

Loads environment variables with Zod validation. Exposed via `C()`. Relevant vars:
- `SESSION_PASSWORD` (≥32 chars, for iron-session)
- `G_WEB_DATABASE_*` (DB connection)
- `DONT_REQUIRE_WEBHOOKS_FILE` (bool, dev mode)

---

## @g/nxt — Next.js Frontend

### App Router Structure

```
nxt/app/
├── globals.css          Tailwind CSS import
├── layout.tsx           Root layout (html/body, no header)
├── page.tsx             Root redirect or landing
├── login/               Login page
├── account/             Account settings (2FA setup, sudo mode)
├── rules/               Server rules page
├── panel/               Admin panel (requires has_panel_access)
│   ├── layout.tsx       Panel navbar + main wrapper
│   ├── page.tsx         Panel home (live system stats)
│   ├── graphs/          Historical graphs page
│   ├── lists/           Player lists (whitelist, ops, etc.)
│   ├── mcLogs/          Minecraft server log viewer
│   ├── mcConsole/       Live console (WebSocket)
│   └── ui/              Panel-specific components
│       ├── Graph.tsx
│       ├── Graphs.tsx
│       ├── LogView.tsx
│       └── PanelPageSection.tsx
└── ui/                  Shared UI components
    ├── Button.tsx
    ├── TextInput.tsx
    ├── RadioButtons.tsx
    └── RefreshingPage.tsx
```

### Panel Layout & Theme

The panel uses a **dark theme** throughout:

| Role | Tailwind class |
|------|---------------|
| Page background | `bg-gray-900` |
| Card / section background | `bg-gray-800` |
| Input / code background | `bg-gray-950` |
| Primary text | `text-white` |
| Secondary text | `text-gray-400`, `text-gray-600` |

**Panel header** (`panel/layout.tsx`): full-width `bg-gray-700` bar with title and navigation `LinkButton`s. Calls `requireArea("panel")` to gate access.

**`PanelPageSection`** (`panel/ui/PanelPageSection.tsx`): Section component with a `<h1>` title (underlined, bold) and padded content area. Used to group related controls on a page.

### Button Component (`ui/Button.tsx`)

Three variants:
- `LinkButton` — styled `<Link>` (navigation)
- `ActionButton` — runs a server action, shows spinner while pending, supports a `guard` callback (e.g. sudo mode check)
- `SimpleButton` — runs a client-side callback

Colour constants (all Tailwind, must be static strings):
```typescript
BUTTON_GREEN, BUTTON_YELLOW, BUTTON_RED, BUTTON_CYAN, BUTTON_INDIGO
```

### Graph Components (`panel/ui/`)

**`Graph.tsx`** — Core SVG-based line graph:
- `viewBox="0 0 1 1"` coordinate space; data normalised to [0, 1]
- Multiple lines, each with colour, optional under-fill, optional vertex circles
- Axis labels on all four sides; grid lines
- Legend below graph
- Handles null y-values as gaps in the line
- Fixed `LineColor` constants (Tailwind classes — cannot be dynamic)

**`Graphs.tsx`** — Pre-built templates built on `Graph`:
- `CpuRamGraph` — dual-axis CPU+RAM
- `MultiCPUGraph` — per-core CPU lines
- `TransferGraph` — in/out transfer rates
- `prepareData()` utility normalises time/value ranges, generates tick labels

### Auth Flow

1. User hits any panel page → `requireArea("panel")` checks session
2. Session stored in `iron-session` encrypted cookie (`SESSION_PASSWORD`)
3. Sensitive operations guarded by sudo mode: user re-enters TOTP within 30-minute window
4. `AuthContext` (client-side React context) exposes session state and sudo mode verification

### `nxt/lib/session.ts` — `requireArea()`

Server-side helper. Calls `SessionAccessor` and redirects to `/login` if not authenticated, or shows 403 if authenticated but no panel access.

---

## Key Dev Commands

```bash
# From scripts/g_web/
npm run dev          # start Next.js dev server on port 8000
npm run build        # production build
npm run tsc          # TypeScript type-check (no emit)
npm run lint         # ESLint

# From scripts/g_web/com/
npm run build        # prisma generate + tsc (must run after schema changes)
npm run schema:pull  # pull schema from DB (dev only)
```

---

## Environment Setup

A `.devenv` file (git-ignored) at the repo root provides env vars for dev. Format: `KEY=value`, loaded by `dotenv-cli` in npm scripts.

Required variables:
- `SESSION_PASSWORD` — ≥32 character secret
- `G_WEB_DATABASE_USER`, `G_WEB_DATABASE_PASSWORD`, `G_WEB_DATABASE_HOST`, `G_WEB_DATABASE_PORT`
- `MCCWSS_PORT` — WebSocket port for console
- `MINECRAFT_RCON_PORT`, `MINECRAFT_RCON_PASSWORD`
- `DONT_REQUIRE_WEBHOOKS_FILE=true` — for local dev without the Python webhook script
