package net.gdemmain.gmcmonitor;

/**
 * Persisted mod configuration. The JSON file backing this,
 * {@code ${G_DEMMAIN_ROOT}/config/${G_DEMMAIN_MODE}/g_mc_monitor/config.json}, has exactly four
 * possible keys: consolePort, chatPort, socketBindAddress and fuseMountPath - all required, with
 * no defaults, since {@link ConfigManager#load()} refuses to start the mod if any of them is
 * missing (a silently-defaulted port/address/path is worse than a loud failure). consoleAuthKey,
 * chatAuthKey and unsafe are populated by {@link ConfigManager#load()} from environment variables
 * instead - not from this file at all. messageTemplates keeps its Java-side defaults below and is
 * optional if present in the file - unaffected by any of the above.
 */
public class MonitorConfig {
	/** Secret the console socket requires clients to present before anything else. Populated by {@link ConfigManager#load()} from the MINECRAFT_MONITOR_CONSOLE_AUTH_KEY environment variable. Required, no default. */
	public String consoleAuthKey;

	/** Secret the chat socket requires clients to present before anything else. Separate from consoleAuthKey so the two sockets don't share a key. Populated by {@link ConfigManager#load()} from the MINECRAFT_MONITOR_CHAT_AUTH_KEY environment variable. Required, no default. */
	public String chatAuthKey;

	/** Address the console/chat sockets bind to. Required, no default. */
	public String socketBindAddress;

	/** TCP port for the console socket (see doc/G-DemMAIN Monitor Mod.md). Required, no default. */
	public Integer consolePort;

	/** TCP port for the chat socket (see doc/G-DemMAIN Monitor Mod.md). Required, no default. */
	public Integer chatPort;

	/** Where to mount the FUSE filesystem exposing tps/heap/players. Relative paths resolve against G_DEMMAIN_ROOT (see ConfigManager#resolvePath). Required, no default. */
	public String fuseMountPath;

	/** If false (default), a failure to mount the FUSE filesystem or bind the console/chat sockets crashes startup. If true, such failures are only logged and the mod continues in a degraded state. Populated by {@link ConfigManager#load()} from the G_MC_MONITOR_UNSAFE environment variable (optional, default false) - not read from the JSON file. */
	public boolean unsafe = false;

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
