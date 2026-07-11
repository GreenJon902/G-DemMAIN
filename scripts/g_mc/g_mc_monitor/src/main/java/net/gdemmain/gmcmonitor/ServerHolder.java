package net.gdemmain.gmcmonitor;

import net.minecraft.server.MinecraftServer;

/**
 * Tracks the live {@link MinecraftServer} instance so the FUSE filesystem and socket servers -
 * which run on their own threads and are set up before the server object exists - can reach it.
 */
public final class ServerHolder {
	private static volatile MinecraftServer server;

	private ServerHolder() {
	}

	public static void set(MinecraftServer instance) {
		server = instance;
	}

	public static void clear() {
		server = null;
	}

	/** The running server, or null if it hasn't started (or has already stopped). */
	public static MinecraftServer get() {
		return server;
	}
}
