import WebSocket, { WebSocketServer } from "ws";
import { C } from "@/lib/environ";

// Create WebSocketServer
const wss = new WebSocketServer({ port: C().MCCWSS_PORT });  // TODO: Use HTTPS
wss.on("connection", (ws: WebSocket) => {
    console.log("Connection from client..");
    ws.on("error", console.error);
    ws.on("message", (data: string) => {
        console.log("Recieved:", data);
        ws.send("Executing " + data + " on the server");
    });
    ws.on("close", () => "Connection closed..");
    setInterval(() => ws.send("Ping"), 5000);
});

