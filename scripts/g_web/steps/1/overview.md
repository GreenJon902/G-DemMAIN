# HisDoc — Project Overview

## What is HisDoc?

HisDoc ("History Documentation") is a Minecraft server mod (Java, Fabric/Paper) that embeds a lightweight HTTP server and serves a website for documenting the history of a Minecraft server's community. It lets server members record **events** (things that happened), link them to **people** (players or NPCs), categorise them with **tags**, and browse a searchable **timeline**.

The project is alpha/beta quality, designed for small communities, not public-scale deployments.

---

## Top-level Architecture

```
Minecraft Server (Paper/Fabric mod)
├── HisDoc mod running inside the JVM
│   ├── MySQL database  ←  stores all history data
│   ├── Embedded HTTP server (custom WebDriver)
│   │   ├── Route dispatcher → PageRenderer classes
│   │   └── Session/auth handler (/link system)
│   └── Dispatcher module  ←  all SQL queries live here
└── Served website (HTML generated server-side in Java)
    └── Browser-side JS for timeline filtering only
```

The whole UI is **server-side rendered HTML** built by a widget/builder system (no template engine, no JS framework). Styling is a custom CSS file served at `/themes`.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Java 21 |
| MC integration | Paper API 1.21 |
| Database | MySQL (JDBC, via custom Dispatcher) |
| HTTP server | Custom `WebDriver` (Java `com.sun.net.httpserver`) |
| HTML generation | Custom `PageBuilder` + ~40 `WidgetBuilder` classes |
| Charts | QuickChart.io (external service, now broken) |
| Player skin | MineRender.org (iframe embed) |
| Client-side JS | Minimal — only for timeline filter persistence (cookies) and form unsaved-changes warning |

---

## Key Concepts

### Events
The core entity. An event is something that happened on the server — a battle, a build, a political event, etc. Each event has:
- A unique name
- A long description
- Optional "details" (warnings, unknowns, things to clarify)
- A **FlexiDate** (flexible date representing when it happened — may be approximate)
- A posted-by person and posted date
- Relations to: tags, other events, and people involved

### People
Two kinds:
- **Minecraft players** — identified by UUID; linked to a real MC account
- **Miscellaneous / NPCs** — named entities that aren't real players (historical figures, factions, NPCs)

### Tags
Categorical labels (e.g. "Combat", "Politics", "Build") with a name, description, and a colour (stored as an RGB integer). Events can have multiple tags.

### FlexiDate
A flexible date type used because historical events often have uncertain timing. See `flexidate.md` for full detail.

### ChangeLog
Each time an event is edited, a changelog entry is written recording who changed it, when, and a description of the change.

### /link Authentication
The original auth mechanism: a user visits the site, gets a one-time code, runs `/hs link <code>` in-game, and is then identified by their Minecraft UUID for future visits (via a session cookie). **This is being dropped** in the JS migration in favour of the existing g_web user/password login.

---

## Source Layout

```
src/main/java/com/greenjon902/hisdoc/
├── Main.java                          entry point
├── MinecraftInfoSupplier.java         fetches player ticks from MC server
├── Permission.java / PermissionHandler.java
├── SessionHandler.java                session cookie ↔ person lookup
├── flexiDateTime/
│   ├── FlexiDateTime.java             abstract base
│   ├── CenteredFlexiDateTime.java
│   └── RangedFlexiDate.java
├── person/
│   ├── Person.java (interface)
│   ├── MinecraftPerson.java
│   ├── MiscellaneousPerson.java
│   └── PersonType.java (MINECRAFT, MISCELLANEOUS)
├── sql/
│   ├── Dispatcher.java                all DB queries
│   └── results/                       result record classes
├── pages/                             one renderer per route
│   ├── eventModification/
│   │   ├── AbstractModifyEventPageRenderer.java
│   │   ├── AddEventPageRenderer.java
│   │   ├── AddEventSubmitPageRenderer.java
│   │   ├── EditEventPageRenderer.java
│   │   └── EditEventSubmitPageRenderer.java
│   ├── EventPageRenderer.java
│   ├── HomePageRenderer.java
│   ├── PersonPageRenderer.java
│   ├── PersonsPageRenderer.java
│   ├── TagPageRenderer.java
│   ├── TagsPageRenderer.java
│   └── TimelinePageRenderer.java
├── pageBuilder/
│   ├── PageBuilder.java
│   ├── HtmlOutputStream.java
│   ├── scripts/                       client-side JS helpers
│   └── widgets/                       ~40 HTML widget builder classes
└── runners/papermc/
    ├── HisDocRunner.java              registers routes, starts server
    ├── PaperMcSessionHandlerImpl.java /link session management
    └── command/                       /hs link in-game command

src/main/resources/com/greenjon902/hisdoc/sql/statements/
├── createTables/                      CREATE TABLE SQL files
└── queries/                           SELECT/INSERT/UPDATE SQL files
```
