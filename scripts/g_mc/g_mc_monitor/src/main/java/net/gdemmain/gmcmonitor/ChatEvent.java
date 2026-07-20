package net.gdemmain.gmcmonitor;

/** The fixed set of one-way chat-socket event notifications (see doc/G-DemMAIN Monitor Mod.md). */
public enum ChatEvent {
	PLAYER_JOINED("player_joined"),
	PLAYER_LEFT("player_left"),
	PLAYER_DIED("player_died"),
	SERVER_STARTED("server_started"),
	SERVER_STOPPED("server_stopped"),
	PLAYER_ADVANCEMENT("player_advancement");

	private final String wireName;

	ChatEvent(String wireName) {
		this.wireName = wireName;
	}

	/** The exact string sent as the "event" field over the chat socket - see doc/G-DemMAIN Monitor Mod.md. */
	public String wireName() {
		return wireName;
	}
}
