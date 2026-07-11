package net.gdemmain.gmcmonitor.fs;

import jnr.ffi.Pointer;
import net.gdemmain.gmcmonitor.GMcMonitor;
import net.gdemmain.gmcmonitor.ServerHolder;
import net.gdemmain.gmcmonitor.stats.HeapStats;
import net.gdemmain.gmcmonitor.stats.TickStats;
import net.minecraft.server.MinecraftServer;
import ru.serce.jnrfuse.ErrorCodes;
import ru.serce.jnrfuse.FuseFillDir;
import ru.serce.jnrfuse.FuseStubFS;
import ru.serce.jnrfuse.struct.FileStat;
import ru.serce.jnrfuse.struct.FuseFileInfo;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Read-only FUSE filesystem exposing live server stats as plain files, generated on demand -
 * nothing is written to disk or polled in the background, a read simply computes the current
 * value. Layout is documented in doc/G-DemMAIN Monitor Mod.md.
 */
public class MonitorFuseFS extends FuseStubFS {
	private static final byte[] EMPTY = new byte[0];

	private final Map<String, Supplier<byte[]>> rootFiles = new LinkedHashMap<>();

	public MonitorFuseFS(TickStats tickStats) {
		rootFiles.put("tps", () -> content(String.format("%.2f", tickStats.getTps())));
		rootFiles.put("heap_used_bytes", () -> content(Long.toString(HeapStats.getUsedBytes())));
		rootFiles.put("heap_allocated_bytes", () -> content(Long.toString(HeapStats.getAllocatedBytes())));
	}

	private static byte[] content(String text) {
		return (text + "\n").getBytes(StandardCharsets.UTF_8);
	}

	/** Mounts at the given path (created if necessary), with allow_other so other local users can read it. */
	public void mountAt(Path mountPoint) {
		try {
			java.nio.file.Files.createDirectories(mountPoint);
		} catch (java.io.IOException e) {
			throw new RuntimeException("Failed to create FUSE mount point directory " + mountPoint, e);
		}
		mount(mountPoint, false, false, new String[]{"-o", "allow_other"});
		GMcMonitor.LOGGER.info("Mounted monitor filesystem at {}", mountPoint);
	}

	private boolean isDirectory(String path) {
		return path.equals("/") || path.equals("/players");
	}

	/** Content for a regular file at this path, or null if the path is a directory or doesn't exist. */
	private byte[] regularFileContent(String path) {
		Supplier<byte[]> supplier = rootFiles.get(stripLeadingSlash(path));
		if (supplier != null) {
			return supplier.get();
		}
		if (path.startsWith("/players/")) {
			String name = path.substring("/players/".length());
			return isOnlinePlayer(name) ? EMPTY : null;
		}
		return null;
	}

	private static String stripLeadingSlash(String path) {
		return path.startsWith("/") ? path.substring(1) : path;
	}

	private boolean isOnlinePlayer(String name) {
		MinecraftServer server = ServerHolder.get();
		if (server == null) {
			return false;
		}
		for (String online : server.getPlayerNames()) {
			if (online.equals(name)) {
				return true;
			}
		}
		return false;
	}

	private String[] onlinePlayerNames() {
		MinecraftServer server = ServerHolder.get();
		return server == null ? new String[0] : server.getPlayerNames();
	}

	private void setOwnerToCaller(FileStat stat) {
		// Every reader is reported as the file's owner (with permission bits open to owner only) -
		// combined with the allow_other mount option this makes the tree world-readable without
		// needing real Unix permission bits, since jnr-fuse can't know the true "g_mc" uid/gid here
		stat.st_uid.set(getContext().uid.get());
		stat.st_gid.set(getContext().gid.get());
	}

	@Override
	public int getattr(String path, FileStat stat) {
		if (isDirectory(path)) {
			stat.st_mode.set(FileStat.S_IFDIR | 0555);
			setOwnerToCaller(stat);
			return 0;
		}
		byte[] content = regularFileContent(path);
		if (content == null) {
			return -ErrorCodes.ENOENT();
		}
		stat.st_mode.set(FileStat.S_IFREG | 0444);
		stat.st_size.set(content.length);
		setOwnerToCaller(stat);
		return 0;
	}

	@Override
	public int readdir(String path, Pointer buf, FuseFillDir filler, long offset, FuseFileInfo fi) {
		if (path.equals("/")) {
			filler.apply(buf, ".", null, 0);
			filler.apply(buf, "..", null, 0);
			for (String name : rootFiles.keySet()) {
				filler.apply(buf, name, null, 0);
			}
			filler.apply(buf, "players", null, 0);
			return 0;
		}
		if (path.equals("/players")) {
			filler.apply(buf, ".", null, 0);
			filler.apply(buf, "..", null, 0);
			for (String name : onlinePlayerNames()) {
				filler.apply(buf, name, null, 0);
			}
			return 0;
		}
		return -ErrorCodes.ENOENT();
	}

	@Override
	public int open(String path, FuseFileInfo fi) {
		return regularFileContent(path) != null ? 0 : -ErrorCodes.ENOENT();
	}

	@Override
	public int read(String path, Pointer buf, long size, long offset, FuseFileInfo fi) {
		byte[] content = regularFileContent(path);
		if (content == null) {
			return -ErrorCodes.ENOENT();
		}
		int bytesToRead = (int) Math.max(0, Math.min(content.length - offset, size));
		if (bytesToRead > 0) {
			buf.put(0, content, (int) offset, bytesToRead);
		}
		return bytesToRead;
	}
}
