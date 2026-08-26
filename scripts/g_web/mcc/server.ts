import net from "node:net";
import WebSocket, { WebSocketServer } from "ws";
import { C } from "@g/com/lib/config";
import { SessionAccessor } from "@g/com/lib/auth";
import { sendWebcommandWebhook } from "@g/com/lib/webhook";
import { zConsoleCommand, zConsoleServerMessage, type ConsoleMeta } from "@g/com/lib/mcConsoleProtocol";

// Create the WebSocketServer - the server that the client/browser connects to.
const wss = new WebSocketServer({ port: C().MCCWSS_PORT, host: "127.0.0.1" });  // `host=127.0.0.1` => loopback-only

/** Builds a synthetic notice, for messages mcc generates itself rather than relaying from the monitor mod. */
function mccMeta(level: ConsoleMeta["level"], message: string): ConsoleMeta {
    return { type: "meta", level, source: "MCC", message };
}

/** Parses a line of JSON, returning undefined (rather than throwing) if it isn't valid JSON. */
function tryParseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

wss.on("connection", async (ws: WebSocket, req: Request) => {
    // Log as WSS for web-socket-server
    console.log("WSS: Connection");

    // Check cookies - viewing the console only requires "viewer"; sending commands (checked per-command below) requires "admin"
    const sa = new SessionAccessor(req, new Response());
    if (!await sa.strictCheckPermission("panel", "viewer")) {
        console.log("WSS: 'User does not have permissions'");
        ws.send(JSON.stringify(mccMeta("WARN", "You do not have permission to access the console!")));
        ws.close();
        return;
    }

    const username = (await sa.getUserData()).username;
    console.log(`WSS: 'Authenticated with name "${username}"'`);

    // Connect to the monitor mod's console socket (TCP, newline-delimited JSON - see doc/G-DemMAIN Monitor Mod.md)
    const monitorSocket = net.createConnection({ host: C().MINECRAFT_MONITOR_CONSOLE_HOST, port: C().MINECRAFT_MONITOR_CONSOLE_PORT });
    let buffer = "";

    monitorSocket.on("connect", () => {
        // Log as WS for web-socket for this user
        console.info(`WS[${username}]: Connected, authenticating`);
        monitorSocket.write(JSON.stringify({ authKey: C().MINECRAFT_MONITOR_CONSOLE_AUTH_KEY }) + "\n");
    });
    monitorSocket.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";  // Keep the last (possibly incomplete) line in the buffer
        for (const line of lines) {
            if (line === "") continue;
            const parsed = zConsoleServerMessage.safeParse(tryParseJson(line));
            if (!parsed.success) {
                console.warn(`WS[${username}]: Dropping unparseable line<`, line, ">", parsed.error);
                continue;
            }
            ws.send(JSON.stringify(parsed.data));
        }
    });
    monitorSocket.on("close", () => {
        console.info(`WS[${username}]: Close`);
        ws.send(JSON.stringify(mccMeta("ERROR", "Lost connection to the monitor mod!")));
        ws.close();
    });
    monitorSocket.on("error", (err: Error) => {
        console.info(`WS[${username}]: Error<`, err, ">");
        ws.send(JSON.stringify(mccMeta("ERROR", "Lost connection to the monitor mod: " + err)));
        ws.close();
    });

    // WS bindings:
    ws.on("error", console.error);
    ws.on("message", async (data: Buffer) => {
        const string = data.toString();
        const parsed = zConsoleCommand.safeParse(tryParseJson(string));
        if (!parsed.success) {
            console.warn(`WS[${username}]: Dropping unparseable message<`, string, ">", parsed.error);
            return;
        }
        const { command } = parsed.data;

        // Re-check permission fresh for every command - this (not the connect-time check above) is
        // what actually gates sending, and it naturally re-validates sudo mode's live expiry too
        if (!await sa.strictCheckPermission("panel", "admin")) {
            console.log(`WS[${username}]: 'Denied command<`, command, ">'");
            ws.send(JSON.stringify(mccMeta("WARN", "You do not have permission to run commands.")));
            return;
        }

        console.log(`WS[${username}]: Command<`, command, ">");
        sendWebcommandWebhook(username, command);
        monitorSocket.write(JSON.stringify({ type: "command", command }) + "\n");
    });
    ws.on("close", () => {
        console.log(`WS[${username}]: Close`);
        monitorSocket.destroy();
    });
});
