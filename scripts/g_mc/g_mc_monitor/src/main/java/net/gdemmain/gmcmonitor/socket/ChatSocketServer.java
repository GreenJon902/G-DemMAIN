package net.gdemmain.gmcmonitor.socket;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.gdemmain.gmcmonitor.ChatEvent;
import net.gdemmain.gmcmonitor.GMcMonitor;
import net.gdemmain.gmcmonitor.ServerHolder;
import net.gdemmain.gmcmonitor.MonitorConfig;
import net.minecraft.ChatFormatting;
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

	/** The "source" value used for real in-game chat messages, as opposed to a bridge client's own name. */
	private static final String INGAME_SOURCE = "Minecraft";

	/** message_type values for an incoming chat-socket message. */
	private static final String MESSAGE_TYPE_NORMAL = "normal";  // No action
	private static final String MESSAGE_TYPE_REPLY = "reply";    // Prepend with prefix string (from config)

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
		String messageType = json.has("message_type") ? json.get("message_type").getAsString() : MESSAGE_TYPE_NORMAL;  // Default is normal
		if (!type.equals("message") || !json.has("source") || !json.has("username") || !json.has("message")
				|| (!messageType.equals(MESSAGE_TYPE_NORMAL) && !messageType.equals(MESSAGE_TYPE_REPLY))) {
			GMcMonitor.LOGGER.warn("Chat socket client {} sent an invalid message: {}", connection.getRemoteSocketAddress(), jsonLine);
			return;
		}
		String source = json.get("source").getAsString();
		String username = json.get("username").getAsString();
		String message = json.get("message").getAsString();

		// Relay to every other connected bridge client, so e.g. a Discord bridge sees a message a Web bridge sent
		JsonObject outgoing = new JsonObject();
		outgoing.addProperty("type", "message");
		outgoing.addProperty("source", source);
		outgoing.addProperty("username", username);
		outgoing.addProperty("message", message);
		outgoing.addProperty("message_type", messageType);
		recordHistory(outgoing);
		broadcastExcept(GSON.toJson(outgoing), connection);

		MinecraftServer server = ServerHolder.get();
		if (server == null) {
			return;
		}
        // Render message
		Component chatLine = buildChatRelayMessage(source, username, message, messageType.equals(MESSAGE_TYPE_REPLY));
		server.execute(() -> server.getPlayerList().broadcastSystemMessage(chatLine, false));
	}

	/** Builds the colored "[source] username: message" system chat line for an incoming chat-socket message. */
	private Component buildChatRelayMessage(String source, String username, String message, boolean reply) {
		Component main = Component.literal("[").withStyle(ChatFormatting.DARK_BLUE)
				.append(Component.literal(source).withStyle(ChatFormatting.BLUE))
				.append(Component.literal("] ").withStyle(ChatFormatting.DARK_BLUE))
				.append(Component.literal(username).withStyle(ChatFormatting.WHITE))
				.append(Component.literal(": " + message).withStyle(ChatFormatting.WHITE));
        // Add the 'reply prefix' if required
        return (reply) ? 
            Component.literal(templates.replyPrefix).withStyle(ChatFormatting.GRAY).append(main) : 
            main;
	}

	/** Relays a real in-game chat message out to clients. */
	public void broadcastChatMessage(String username, String message) {
		JsonObject json = new JsonObject();
		json.addProperty("type", "message");
		json.addProperty("source", INGAME_SOURCE);
		json.addProperty("username", username);
		json.addProperty("message", message);
		recordHistory(json);
		broadcast(GSON.toJson(json));
	}

	/** Sends a one-way event notification (join/left/died/started/stopped/advancement) to clients. */
	public void broadcastEvent(ChatEvent event, Map<String, String> fields) {
		JsonObject json = new JsonObject();
		json.addProperty("type", "event");
		json.addProperty("event", event.wireName());
		fields.forEach(json::addProperty);
		recordHistory(json);
		broadcast(GSON.toJson(json));
	}

	public MonitorConfig.MessageTemplates getTemplates() {
		return templates;
	}
}
