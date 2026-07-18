package net.gdemmain.gmcmonitor;

/** Reads JVM heap usage directly from {@link Runtime} - cheap enough to call on every read, no caching needed. */
public final class HeapStats {
	private HeapStats() {
	}

	/** Bytes of heap currently in use. */
	public static long getUsedBytes() {
		Runtime runtime = Runtime.getRuntime();
		return runtime.totalMemory() - runtime.freeMemory();
	}

	/** The configured maximum heap size in bytes (the -Xmx the JVM was launched with). */
	public static long getAllocatedBytes() {
		return Runtime.getRuntime().maxMemory();
	}
}
