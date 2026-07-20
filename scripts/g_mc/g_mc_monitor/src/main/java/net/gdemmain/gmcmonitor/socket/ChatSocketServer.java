package net.gdemmain.gmcmonitor.socket;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.gdemmain.gmcmonitor.ServerHolder;
import net.gdemmain.gmcmonitor.MonitorConfig;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;

/**
 * Bridges game chat: real player messages and templated event notifications (join/leave/death/
 * advancement/server lifecycle) flow out to clients, and clients can send a username+message pair
 * back in, which is broadcast as a system-styled chat line (see doc/G-DemMAIN Monitor Mod.md for
 * why this isn't a signed player chat message).
 */
public class ChatSocketServer extends SocketServer {
	private static final Gson GSON = new Gson();
	private static final int HISTORY_SIZE = 10;

	private final MonitorConfig.MessageTemplates templates;
	private final Deque<JsonObject> history = new ArrayDeque<>();

	public ChatSocketServer(String authKey, MonitorConfig.MessageTemplates templates) {
		super("chat", authKey);
		this.templates = templates;
	}

	/** Records a message/event JSON object as history, dropping the oldest once past HISTORY_SIZE. */
	private void recordHistory(JsonObject json) {
		synchronized (history) {
			history.addLast(json);
			while (history.size() > HISTORY_SIZE) {
				history.removeFirst();
			}
		}
	}

	@Override
	protected void onClientConnected(ClientConnection connection) {
		JsonObject historyEnvelope = new JsonObject();
		historyEnvelope.addProperty("type", "history");
		JsonArray lines = new JsonArray();
		synchronized (history) {
			history.forEach(lines::add);
		}
		historyEnvelope.add("lines", lines);
		connection.send(GSON.toJson(historyEnvelope));
	}

	@Override
	protected void handleClientMessage(ClientConnection connection, String jsonLine) {
		JsonObject json = JsonParser.parseString(jsonLine).getAsJsonObject();
		String type = json.has("type") ? json.get("type").getAsString() : "";
		if (!type.equals("message") || !json.has("source") || !json.has("username") || !json.has("message")) {
			return;
		}
		String source = json.get("source").getAsString();
		String username = json.get("username").getAsString();
		String message = json.get("message").getAsString();

		MinecraftServer server = ServerHolder.get();
		if (server == null) {
			return;
		}
		String formatted = templates.chatRelay
				.replace("{source}", source)
				.replace("{username}", username)
				.replace("{message}", message);
		server.execute(() -> server.sendSystemMessage(Component.literal(formatted)));
	}

	/** Relays a real in-game chat message out to clients. */
	public void broadcastChatMessage(String username, String message) {
		JsonObject json = new JsonObject();
		json.addProperty("type", "message");
		json.addProperty("username", username);
		json.addProperty("message", message);
		recordHistory(json);
		broadcast(GSON.toJson(json));
	}

	/** Sends a one-way event notification (join/left/died/started/stopped/advancement) to clients. */
	public void broadcastEvent(String event, Map<String, String> fields) {
		JsonObject json = new JsonObject();
		json.addProperty("type", "event");
		json.addProperty("event", event);
		fields.forEach(json::addProperty);
		recordHistory(json);
		broadcast(GSON.toJson(json));
	}

	public MonitorConfig.MessageTemplates getTemplates() {
		return templates;
	}
}
