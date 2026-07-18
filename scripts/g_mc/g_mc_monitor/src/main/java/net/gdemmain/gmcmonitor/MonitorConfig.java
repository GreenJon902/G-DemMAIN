package net.gdemmain.gmcmonitor;

/**
 * Persisted mod configuration, serialized as JSON to config/g_mc_monitor.json.
 * Most fields keep their default values below when absent from an existing config file, so the
 * file can be edited by hand and new fields introduced later fill themselves in. authKey,
 * consolePort and chatPort are the exception - they have no default and
 * {@link ConfigManager#load()} refuses to start the mod if any of them is missing, since a
 * silently-defaulted secret or port is worse than a loud failure. In production these three are
 * meant to come from static-config/g_mc/config/g_mc_monitor.json.template, populated from the
 * environ variables by utils/sync-static-config.py.
 */
public class MonitorConfig {
	/** Shared secret both the console and chat sockets require clients to present before anything else. Required, no default. */
	public String authKey;

	/** Address the console/chat sockets bind to - defaults to loopback-only since there's no need for remote access. */
	public String socketBindAddress = "127.0.0.1";

	/** TCP port for the console socket (see doc/G-DemMAIN Monitor Mod.md). Required, no default. */
	public Integer consolePort;

	/** TCP port for the chat socket (see doc/G-DemMAIN Monitor Mod.md). Required, no default. */
	public Integer chatPort;

	/** Where to mount the FUSE filesystem exposing tps/heap/players. Relative paths resolve against the server run directory. */
	public String fuseMountPath = "monitor-mount";

	public MessageTemplates messageTemplates = new MessageTemplates();

	/** Text templates used for chat-socket event/relay messages. Placeholders are substituted literally, e.g. {player}. */
	public static class MessageTemplates {
		public String playerJoined = "{player} joined the game";
		public String playerLeft = "{player} left the game";
		public String playerDied = "{message}";
		public String serverStarted = "Server started";
		public String serverStopped = "Server stopped";
		public String playerAdvancement = "{player} has made the advancement {advancement}";
		/** Used when broadcasting an incoming socket message (from a source like "Web" or "Discord") into the game as a system-styled chat line. */
		public String chatRelay = "[{source}] <{username}>: {message}";
	}
}
