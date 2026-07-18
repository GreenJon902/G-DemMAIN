package net.gdemmain.gmcmonitor.socket;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.gdemmain.gmcmonitor.GMcMonitor;
import net.gdemmain.gmcmonitor.ServerHolder;
import net.gdemmain.gmcmonitor.ConsoleCapture;
import net.minecraft.server.MinecraftServer;

/**
 * Bridges the server console: on connect a client gets the last 10 lines, then every new line
 * printed to console (which already includes chat and command feedback) as it happens. Clients
 * may also send commands, executed with the same permissions/attribution as typed server console
 * input - see {@link MinecraftServer#createCommandSourceStack()}.
 */
public class ConsoleSocketServer extends SocketServer {
	private static final Gson GSON = new Gson();

	private final ConsoleCapture consoleCapture;

	public ConsoleSocketServer(String authKey, ConsoleCapture consoleCapture) {
		super("console", authKey);
		this.consoleCapture = consoleCapture;
		consoleCapture.addListener(this::broadcastLine);
	}

	private void broadcastLine(String line) {
		JsonObject message = new JsonObject();
		message.addProperty("type", "line");
		message.addProperty("text", line);
		broadcast(GSON.toJson(message));
	}

	@Override
	protected void onClientConnected(ClientConnection connection) {
		JsonObject history = new JsonObject();
		history.addProperty("type", "history");
		JsonArray lines = new JsonArray();
		consoleCapture.getHistory().forEach(lines::add);
		history.add("lines", lines);
		connection.send(GSON.toJson(history));
	}

	@Override
	protected void handleClientMessage(ClientConnection connection, String jsonLine) {
		JsonObject json = JsonParser.parseString(jsonLine).getAsJsonObject();
		String type = json.has("type") ? json.get("type").getAsString() : "";
		if (!type.equals("command") || !json.has("command")) {
			return;
		}
		String command = json.get("command").getAsString();

		MinecraftServer server = ServerHolder.get();
		if (server == null) {
			return;
		}
		// Command execution must happen on the main server thread, like any other command source
		server.execute(() -> {
			try {
				server.getCommands().performPrefixedCommand(server.createCommandSourceStack(), command);
			} catch (RuntimeException e) {
				GMcMonitor.LOGGER.error("Failed to run command '{}' from console socket", command, e);
			}
		});
	}
}
