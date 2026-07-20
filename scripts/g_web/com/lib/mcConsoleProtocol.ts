/**
 * Shared shapes for g_mc_monitor's console socket (see doc/G-DemMAIN Monitor Mod.md), used by both
 * the mcc proxy (Node) and the panel's Console component (browser) so they agree on the wire format.
 */

import { z } from "zod";

export const LOG_LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;
export type LogLevel = typeof LOG_LEVELS[number];

// A single console line - either streamed live, replayed as history, or synthesized by mcc itself
// (e.g. permission-denied notices), all using this same shape so the client only ever parses one thing
export const zConsoleLine = z.object({
    type: z.literal("line"),
    datetime: z.string(),  // ISO 8601/RFC 3339, UTC, millisecond precision
    level: z.enum(LOG_LEVELS),
    thread: z.string(),
    message: z.string()
});
export type ConsoleLine = z.infer<typeof zConsoleLine>;

// Sent once, right after auth, with the last few lines that were printed before this client connected
export const zConsoleHistory = z.object({
    type: z.literal("history"),
    lines: z.array(zConsoleLine)
});
export type ConsoleHistory = z.infer<typeof zConsoleHistory>;

// A synthetic notice (e.g. "permission denied", "connection lost") from mcc or the client itself,
// rather than a real console line from the mod - so unlike zConsoleLine it has no datetime/thread
// (not timestamped or attributed to a game-server thread) and is rendered without either
export const zConsoleMeta = z.object({
    type: z.literal("meta"),
    level: z.enum(LOG_LEVELS),
    source: z.enum(["MCC", "Client"]),
    message: z.string()
});
export type ConsoleMeta = z.infer<typeof zConsoleMeta>;

// Everything mcc ever sends to the browser client
export const zConsoleServerMessage = z.discriminatedUnion("type", [zConsoleLine, zConsoleHistory, zConsoleMeta]);
export type ConsoleServerMessage = z.infer<typeof zConsoleServerMessage>;

// The only thing the browser client ever sends to mcc
export const zConsoleCommand = z.object({
    type: z.literal("command"),
    command: z.string()
});
export type ConsoleCommand = z.infer<typeof zConsoleCommand>;
