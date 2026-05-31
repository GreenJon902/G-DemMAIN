import WebSocket, { WebSocketServer } from "ws";
import { C } from "@/lib/environ";
import { SessionAccessor } from "@/lib/auth";

// Create WebSocketServer
const wss = new WebSocketServer({ port: C().MCCWSS_PORT });  // TODO: Use HTTPS
wss.on("connection", async (ws: WebSocket, req: Request) => {
    console.log("Connection from client..");

    // Check cookies:
    const sa = new SessionAccessor(req, new Response());
    sa.optimisticRequireUser("panel");
    const username = (await sa.getUserData()).username;
    console.log(`Authenticated with name '${username}'`);

    ws.on("error", console.error);
    ws.on("message", (data: string) => {
        console.log(`Recieved from client (${username}):`, data);
        ws.send("Executing " + data + " on the server");
    });
    ws.on("close", () => "Connection closed..");
    setInterval(() => ws.send("Ping"), 5000);
});

