package net.gdemmain.gmcmonitor.socket;

import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.net.Socket;
import java.net.SocketAddress;
import java.nio.charset.StandardCharsets;

/** One connected, authenticated client of a {@link SocketServer}. */
public class ClientConnection {
	private final Socket socket;
	private final PrintWriter writer;

	ClientConnection(Socket socket) throws IOException {
		this.socket = socket;
		OutputStream out = socket.getOutputStream();
		this.writer = new PrintWriter(new java.io.OutputStreamWriter(out, StandardCharsets.UTF_8), false);
	}

	/** Writes one JSON line to this client only. Safe to call concurrently with broadcasts. */
	public synchronized void send(String jsonLine) {
		writer.print(jsonLine);
		writer.print('\n');
		writer.flush();
	}

	public void close() {
		try {
			socket.close();
		} catch (IOException ignored) {
		}
	}

	/** Used for identifying this client in log messages. */
	public SocketAddress getRemoteSocketAddress() {
		return socket.getRemoteSocketAddress();
	}
}
