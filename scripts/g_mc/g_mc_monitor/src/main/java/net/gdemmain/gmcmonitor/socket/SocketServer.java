package net.gdemmain.gmcmonitor.socket;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import net.gdemmain.gmcmonitor.GMcMonitor;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Shared plumbing for the console and chat sockets: accept clients on a background thread, require
 * a shared-key auth line before anything else, then hand each client off to its own thread reading
 * newline-delimited JSON. Both sockets need this same shape, so it lives here once.
 */
public abstract class SocketServer {
	private final String name;
	private final String authKey;
	private final CopyOnWriteArrayList<ClientConnection> clients = new CopyOnWriteArrayList<>();
	private ServerSocket serverSocket;
	private volatile boolean running;

	protected SocketServer(String name, String authKey) {
		this.name = name;
		this.authKey = authKey;
	}

	/** Opens the listening socket and starts accepting clients on a background daemon thread. */
	public void start(InetAddress bindAddress, int port) throws IOException {
		serverSocket = new ServerSocket(port, 50, bindAddress);
		running = true;
		Thread acceptThread = new Thread(this::acceptLoop, name + "-accept");
		acceptThread.setDaemon(true);
		acceptThread.start();
		GMcMonitor.LOGGER.info("{} socket listening on {}:{}", name, bindAddress.getHostAddress(), port);
	}

	public void stop() {
		running = false;
		try {
			if (serverSocket != null) {
				serverSocket.close();
			}
		} catch (IOException ignored) {
		}
		for (ClientConnection client : clients) {
			client.close();
		}
	}

	private void acceptLoop() {
		while (running) {
			try {
				Socket socket = serverSocket.accept();
				Thread clientThread = new Thread(() -> handleClient(socket), name + "-client");
				clientThread.setDaemon(true);
				clientThread.start();
			} catch (IOException e) {
				if (running) {
					GMcMonitor.LOGGER.error("{} accept loop error", name, e);
				}
			}
		}
	}

	private void handleClient(Socket socket) {
		ClientConnection connection = null;
		try (socket; BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))) {
			String authLine = reader.readLine();
			if (authLine == null || !isAuthorized(authLine)) {
				GMcMonitor.LOGGER.warn("{} client {} failed authentication", name, socket.getRemoteSocketAddress());
				return;
			}

			connection = new ClientConnection(socket);
			clients.add(connection);
			GMcMonitor.LOGGER.info("{} client {} connected", name, socket.getRemoteSocketAddress());
			onClientConnected(connection);

			String line;
			while ((line = reader.readLine()) != null) {
				try {
					handleClientMessage(connection, line);
				} catch (JsonSyntaxException | IllegalStateException e) {
					GMcMonitor.LOGGER.warn("{} client {} sent malformed message: {}", name, socket.getRemoteSocketAddress(), line);
				}
			}
		} catch (IOException e) {
			// Expected on client disconnect - nothing to log
		} finally {
			if (connection != null) {
				clients.remove(connection);
				GMcMonitor.LOGGER.info("{} client {} disconnected", name, socket.getRemoteSocketAddress());
			}
		}
	}

	private boolean isAuthorized(String authLine) {
		try {
			JsonObject json = JsonParser.parseString(authLine).getAsJsonObject();
			String presented = json.has("authKey") ? json.get("authKey").getAsString() : "";
			return MessageDigest.isEqual(presented.getBytes(StandardCharsets.UTF_8), authKey.getBytes(StandardCharsets.UTF_8));
		} catch (JsonSyntaxException | IllegalStateException e) {
			return false;
		}
	}

	/** Sends a JSON line to every currently connected, authenticated client. */
	protected void broadcast(String jsonLine) {
		for (ClientConnection client : clients) {
			client.send(jsonLine);
		}
	}

	/** Sends a JSON line to every currently connected, authenticated client except {@code exclude}. */
	protected void broadcastExcept(String jsonLine, ClientConnection exclude) {
		for (ClientConnection client : clients) {
			if (client != exclude) {
				client.send(jsonLine);
			}
		}
	}

	/** Called once a client has authenticated successfully. */
	protected abstract void onClientConnected(ClientConnection connection);

	/** Called for each JSON line a client sends after authenticating. */
	protected abstract void handleClientMessage(ClientConnection connection, String jsonLine);
}
