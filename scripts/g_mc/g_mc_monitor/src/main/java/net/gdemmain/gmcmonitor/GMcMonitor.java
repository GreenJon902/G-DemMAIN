package net.gdemmain.gmcmonitor;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.gdemmain.gmcmonitor.socket.ChatSocketServer;
import net.gdemmain.gmcmonitor.socket.ConsoleSocketServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.InetAddress;
import java.nio.file.Path;

/** Entrypoint for the server-only monitoring/bridging mod. */
public class GMcMonitor implements DedicatedServerModInitializer {
	public static final String MOD_ID = "g_mc_monitor";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	private MonitorFuseFS fuseFS;
	private ConsoleSocketServer consoleSocketServer;
	private ChatSocketServer chatSocketServer;

	@Override
	public void onInitializeServer() {
		MonitorConfig config = ConfigManager.load();

		TickStats tickStats = new TickStats();
		tickStats.register();
		MonitorCommands.register(tickStats);

		ConsoleCapture consoleCapture = new ConsoleCapture();
		consoleCapture.register();

		fuseFS = new MonitorFuseFS(tickStats);
		Path mountPath = Path.of(config.fuseMountPath);
		if (!mountPath.isAbsolute()) {
			mountPath = FabricLoader.getInstance().getGameDir().resolve(mountPath);
		}
		try {
			fuseFS.mountAt(mountPath);
		} catch (RuntimeException e) {
			LOGGER.error("Failed to mount monitor filesystem - see doc/G-DemMAIN Monitor Mod.md for FUSE prerequisites", e);
		}

		consoleSocketServer = new ConsoleSocketServer(config.authKey, consoleCapture);
		chatSocketServer = new ChatSocketServer(config.authKey, config.messageTemplates);
		try {
			InetAddress bindAddress = InetAddress.getByName(config.socketBindAddress);
			consoleSocketServer.start(bindAddress, config.consolePort);
			chatSocketServer.start(bindAddress, config.chatPort);
		} catch (IOException e) {
			LOGGER.error("Failed to start console/chat sockets", e);
		}

		new EventHooks(chatSocketServer).register();

		ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
			if (consoleSocketServer != null) {
				consoleSocketServer.stop();
			}
			if (chatSocketServer != null) {
				chatSocketServer.stop();
			}
			if (fuseFS != null) {
				fuseFS.umount();
			}
		});

		LOGGER.info("G-DemMAIN Monitor initialized");
	}
}
