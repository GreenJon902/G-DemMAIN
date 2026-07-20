package net.gdemmain.gmcmonitor;

import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.gdemmain.gmcmonitor.socket.ChatSocketServer;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Wires Fabric API events (join/leave/death/chat/server lifecycle) to the chat socket, rendering
 * each one-way event through its configured template. The advancement mixin also reports here,
 * since PlayerAdvancements has no public event to hook.
 */
public class EventHooks {
	private static EventHooks instance;

	private final ChatSocketServer chatSocket;
	private final MonitorConfig.MessageTemplates templates;

	public EventHooks(ChatSocketServer chatSocket) {
		this.chatSocket = chatSocket;
		this.templates = chatSocket.getTemplates();
	}

	/** Registers all event listeners. Call once during mod init. */
	public void register() {
		instance = this;

		ServerLifecycleEvents.SERVER_STARTED.register(server -> {
			ServerHolder.set(server);
			sendEvent(ChatEvent.SERVER_STARTED, templates.serverStarted, Map.of());
		});
		ServerLifecycleEvents.SERVER_STOPPING.register(server -> sendEvent(ChatEvent.SERVER_STOPPED, templates.serverStopped, Map.of()));
		ServerLifecycleEvents.SERVER_STOPPED.register(server -> ServerHolder.clear());

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			String name = handler.getPlayer().getGameProfile().name();
			sendEvent(ChatEvent.PLAYER_JOINED, templates.playerJoined, Map.of("player", name));
		});
		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
			String name = handler.getPlayer().getGameProfile().name();
			sendEvent(ChatEvent.PLAYER_LEFT, templates.playerLeft, Map.of("player", name));
		});

		ServerLivingEntityEvents.AFTER_DEATH.register((entity, source) -> {
			if (!(entity instanceof ServerPlayer player)) {
				return;
			}
			String deathMessage = player.getCombatTracker().getDeathMessage().getString();
			sendEvent(ChatEvent.PLAYER_DIED, templates.playerDied, Map.of("player", player.getGameProfile().name(), "message", deathMessage));
		});

		ServerMessageEvents.CHAT_MESSAGE.register((message, sender, params) ->
				chatSocket.broadcastChatMessage(sender.getGameProfile().name(), message.signedContent()));
	}

	/** Called by {@link net.gdemmain.gmcmonitor.mixin.AdvancementAnnounceMixin} when a player completes an announced advancement. */
	public static void fireAdvancement(ServerPlayer player, Component advancementTitle) {
		if (instance == null) {
			return;
		}
		instance.sendEvent(ChatEvent.PLAYER_ADVANCEMENT, instance.templates.playerAdvancement,
				Map.of("player", player.getGameProfile().name(), "advancement", advancementTitle.getString()));
	}

	private void sendEvent(ChatEvent event, String template, Map<String, String> fields) {
		String rendered = template;
		for (Map.Entry<String, String> entry : fields.entrySet()) {
			rendered = rendered.replace("{" + entry.getKey() + "}", entry.getValue());
		}
		Map<String, String> outFields = new LinkedHashMap<>(fields);
		outFields.put("message", rendered);
		chatSocket.broadcastEvent(event, outFields);
	}
}
