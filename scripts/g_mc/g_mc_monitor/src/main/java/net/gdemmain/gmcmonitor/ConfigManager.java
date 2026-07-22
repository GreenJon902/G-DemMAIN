package net.gdemmain.gmcmonitor;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Loads {@code ${G_DEMMAIN_ROOT}/config/${G_DEMMAIN_MODE}/g_mc_monitor/config.json}. This file is
 * non-synced - it is read directly from the repo checkout in place, never generated or templated
 * by any sync tooling. It only ever contains four keys: {@code consolePort}, {@code chatPort},
 * {@code socketBindAddress} and {@code fuseMountPath} - all required, with no Java-side defaults.
 * {@code consoleAuthKey}/{@code chatAuthKey} come from the {@code MINECRAFT_MONITOR_CONSOLE_AUTH_KEY}/
 * {@code MINECRAFT_MONITOR_CHAT_AUTH_KEY} environment variables and are never written to any file.
 * {@code unsafe} comes from the {@code G_MC_MONITOR_UNSAFE} environment variable (optional, default
 * false). {@code messageTemplates}, if present in the file, still gets its Java-side defaults (see
 * MonitorConfig) - unaffected by any of the above.
 */
public final class ConfigManager {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	private ConfigManager() {
	}

	/** Reads the named environment variable, throwing a clear error if it is missing or blank. */
	private static String requireEnv(String name) {
		String value = System.getenv(name);
		if (value == null || value.isBlank()) {
			throw new IllegalStateException("Missing required environment variable " + name);
		}
		return value;
	}

	/**
	 * Parses G_MC_MONITOR_UNSAFE into a boolean - null/blank defaults to false, otherwise
	 * case-insensitively truthy on "true"/"1"
	 */
	private static boolean parseUnsafeEnv(String raw) {
		if (raw == null || raw.isBlank()) {
			return false;
		}
		return raw.equalsIgnoreCase("true") || raw.equals("1");
	}

	/** Reads and validates the config file, throwing if it's missing or missing a required field. */
	public static MonitorConfig load() {
		Path path = Path.of(requireEnv("G_DEMMAIN_ROOT"), "config", requireEnv("G_DEMMAIN_MODE"), "g_mc_monitor", "config.json");
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

		// consoleAuthKey/chatAuthKey/unsafe no longer live in the JSON file at all - they come
		// straight from the environment
		config.consoleAuthKey = System.getenv("MINECRAFT_MONITOR_CONSOLE_AUTH_KEY");
		config.chatAuthKey = System.getenv("MINECRAFT_MONITOR_CHAT_AUTH_KEY");
		config.unsafe = parseUnsafeEnv(System.getenv("G_MC_MONITOR_UNSAFE"));

		requireSet(config, path);
		return config;
	}

	/**
	 * consoleAuthKey/chatAuthKey/consolePort/chatPort/socketBindAddress/fuseMountPath are
	 * deliberately given no default value - a mod silently listening on a made-up port, binding to
	 * the wrong address, mounting at a made-up path, or accepting a made-up shared key, is a worse
	 * failure mode than refusing to start. consoleAuthKey/chatAuthKey come from the environment (see
	 * load()); the other four come from config/${G_DEMMAIN_MODE}/g_mc_monitor/config.json.
	 */
	private static void requireSet(MonitorConfig config, Path path) {
		List<String> missing = new ArrayList<>();
		if (config.consoleAuthKey == null || config.consoleAuthKey.isBlank()) {
			missing.add("consoleAuthKey");
		}
		if (config.chatAuthKey == null || config.chatAuthKey.isBlank()) {
			missing.add("chatAuthKey");
		}
		if (config.consolePort == null) {
			missing.add("consolePort");
		}
		if (config.chatPort == null) {
			missing.add("chatPort");
		}
		if (config.socketBindAddress == null || config.socketBindAddress.isBlank()) {
			missing.add("socketBindAddress");
		}
		if (config.fuseMountPath == null || config.fuseMountPath.isBlank()) {
			missing.add("fuseMountPath");
		}
		if (!missing.isEmpty()) {
			throw new IllegalStateException("g_mc_monitor config " + path + " is missing required field(s): "
					+ String.join(", ", missing) + " - see doc/G-DemMAIN Monitor Mod.md");
		}
	}

	/** Absolute values are used as-is; relative values resolve against G_DEMMAIN_ROOT. Mirrors libs/config.py's resolvePath (Python side). */
	public static Path resolvePath(String value) {
		Path p = Path.of(value);
		return p.isAbsolute() ? p : Path.of(requireEnv("G_DEMMAIN_ROOT")).resolve(p);
	}
}
