import WebSocket, { WebSocketServer } from "ws";
import { C } from "@g/com/lib/environ";
import { SessionAccessor, SUDO_WINDOW_MS } from "@g/com/lib/auth";
import { sendWebcommandWebhook } from "@g/com/lib/webhook";

import rconPkg from "ts-rcon";
// ts-rcon is broken, and - something something gpt help me - classes don't work without the next line 
const Rcon = (rconPkg as unknown as { default: typeof rconPkg }).default;

// Create the WebSocketServer - the server that the client/browser connects to.
const wss = new WebSocketServer({ port: C().MCCWSS_PORT });  // TODO: Use HTTPS
wss.on("connection", async (ws: WebSocket, req: Request) => {
    console.log("WSS: Connection");

    // Check cookies:
    const sa = new SessionAccessor(req, new Response());
    if (!await sa.strictCheckUser("panel")) {
        console.log("WSS: 'User does not have permissions'");
        ws.send("You do not have permission to access the console!");
        ws.close();
        return;
    }
    
    const username = (await sa.getUserData()).username;
    console.log(`WSS: 'Authenticated with name "${username}"'`);

    // Close the connection when the sudo window expires
    const { sudoVerifiedAt } = await sa.getSudoActiveStatus();
    const sudoRemaining = sudoVerifiedAt !== null ? Math.max(0, SUDO_WINDOW_MS - (Date.now() - sudoVerifiedAt)) : 0;
    const sudoTimer = setTimeout(() => {
        console.log(`WS[${username}]: Sudo mode expired, closing`);
        ws.send("Sudo mode has expired — reconnect to re-authenticate");
        ws.close();
    }, sudoRemaining);

    // Create a connection to the mcrcon server and attach to the websocket - this is the server that is hosted by the minecraft jar
    const mcrcon = new Rcon("localhost", C().MINECRAFT_RCON_PORT, C().MINECRAFT_RCON_PASSWORD);
    // WS bindings:
    ws.on("error", console.error);
    ws.on("message", (data: Buffer) => {
        const string = data.toString();  
        console.log(`WS[${username}]: Message<`, string, ">");
        sendWebcommandWebhook(username, string);
        ws.send("/" + string);  // Send the command to the client so they can see what they sent
        mcrcon.send(string);
    });
    ws.on("close", () => {
        console.log(`WS[${username}]: Close`);
        clearTimeout(sudoTimer);
        mcrcon.disconnect();
    });
    // MCRCON bindings:
    mcrcon.on("auth", () => {
        console.info(`MCRCON[${username}]: Auth`);
        ws.send("Succesfully authenticated!");
    }).on("server", (str: string) => {
        console.info(`MCRCON[${username}]: Server<`, str, ">");
        ws.send(str);
    }).on("response", (str: string) => {
        console.info(`MCRCON[${username}]: Response<`, str, ">");
        ws.send(str);
    }).on("end", () => {
        console.info(`MCRCON[${username}]: End`);
        ws.close();
    }).on("error", (err: Error) => {
        console.info(`MCRCON[${username}]: Error<`, err, ">");
        ws.send("An error occured: " + err);
    });
    // Do MCRCON connection:
    mcrcon.connect();
});
