import type { ConsoleLine, LogLevel } from "@g/com/lib/mcConsoleProtocol";

// Text color for each log level, following the same "inline object literal" pattern as
// StatusIndicator in PanelPageContent.tsx - these are single utility classes with no hover/focus
// variants, so a full ButtonColor/TextLinkColor-style constants file would be overkill
export const LEVEL_COLOR: Record<LogLevel, string> = {
    TRACE: "text-gray-500",
    DEBUG: "text-gray-500",
    INFO: "text-gray-200",
    WARN: "text-yellow-500",
    ERROR: "text-red-500",
    FATAL: "text-red-500 font-bold"
};

const THREAD_PAD_LENGTH = 14;

/**
 * Formats a console line as "[HH:MM:SS] [Log Level] [Thread] MSG".
 * The time is taken directly from the UTC ISO datetime (no timezone conversion, so it can't mismatch between server and client render).
 * Thread is padded to {@link THREAD_PAD_LENGTH}, but never cropped if it's already longer.
 */
export function formatConsoleLine(line: ConsoleLine): string {
    const time = line.datetime.slice(11, 19);
    const thread = line.thread.padEnd(THREAD_PAD_LENGTH);
    return `[${time}] [${line.level}] [${thread}] ${line.message}`;
}
