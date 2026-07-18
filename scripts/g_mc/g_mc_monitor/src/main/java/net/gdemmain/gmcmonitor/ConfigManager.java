package net.gdemmain.gmcmonitor;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Loads config/g_mc_monitor.json. This deliberately never writes to that file - it is meant to be
 * managed by static-config/g_mc/config/g_mc_monitor.json.template via utils/sync-static-config.py,
 * which stamps its own header line onto files it owns and treats a file it didn't write as a
 * conflict. Fields the mod defines a default for (see MonitorConfig) still get that default in
 * memory when absent from the file - only authKey/consolePort/chatPort, which have no default,
 * need to actually be present on disk.
 */
public final class ConfigManager {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	private ConfigManager() {
	}

	/** Reads and validates the config file, throwing if it's missing or missing a required field. */
	public static MonitorConfig load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("g_mc_monitor.json");
		if (!Files.exists(path)) {
			throw new IllegalStateException("g_mc_monitor config " + path + " does not exist - see doc/G-DemMAIN Monitor Mod.md");
		}

		MonitorConfig config;
		try (var reader = Files.newBufferedReader(path)) {
			config = GSON.fromJson(reader, MonitorConfig.class);
		} catch (IOException e) {
			throw new IllegalStateException("Failed to read g_mc_monitor config " + path, e);
		}
		if (config == null) {
			throw new IllegalStateException("g_mc_monitor config " + path + " is empty");
		}

		requireSet(config, path);
		return config;
	}

	/**
	 * authKey/consolePort/chatPort are deliberately given no default value - a mod silently
	 * listening on a made-up port, or accepting a made-up shared key, is a worse failure mode than
	 * refusing to start. In production these come from
	 * static-config/g_mc/config/g_mc_monitor.json.template via utils/sync-static-config.py.
	 */
	private static void requireSet(MonitorConfig config, Path path) {
		List<String> missing = new ArrayList<>();
		if (config.authKey == null || config.authKey.isBlank()) {
			missing.add("authKey");
		}
		if (config.consolePort == null) {
			missing.add("consolePort");
		}
		if (config.chatPort == null) {
			missing.add("chatPort");
		}
		if (!missing.isEmpty()) {
			throw new IllegalStateException("g_mc_monitor config " + path + " is missing required field(s): "
					+ String.join(", ", missing) + " - see doc/G-DemMAIN Monitor Mod.md");
		}
	}
}
