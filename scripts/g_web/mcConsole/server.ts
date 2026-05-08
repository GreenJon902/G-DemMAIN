import WebSocket, { WebSocketServer } from 'ws';
import zod from "zod";

// Get env-vars
const mccPort = zod.coerce.number().gte(0).lte(65535).multipleOf(1).parse(process.env.MCCWSS_PORT);

// Create WebSocketServer
const wss = new WebSocketServer({ port: mccPort });  // TODO: Use HTTPS
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

