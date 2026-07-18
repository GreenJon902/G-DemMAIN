package net.gdemmain.gmcmonitor;

import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;

/**
 * Tracks a rolling window of tick durations so TPS/MSPT can be derived on demand, without any
 * background polling - each tick just stores one timestamp delta into a circular buffer.
 */
public class TickStats {
	// 100 ticks is ~5 real seconds at the vanilla 20 TPS tick rate
	private static final int BUFFER_SIZE = 100;
	private static final double NANOS_PER_MILLI = 1_000_000.0;
	private static final double TARGET_TPS = 20.0;

	private final long[] tickDurationsNanos = new long[BUFFER_SIZE];
	private int nextIndex = 0;
	private int filledCount = 0;
	private long tickStartNanos;

	/** Registers the server tick callbacks that feed this tracker. Call once during mod init. */
	public void register() {
		ServerTickEvents.START_SERVER_TICK.register(server -> tickStartNanos = System.nanoTime());
		ServerTickEvents.END_SERVER_TICK.register(server -> recordTick(System.nanoTime() - tickStartNanos));
	}

	private synchronized void recordTick(long durationNanos) {
		tickDurationsNanos[nextIndex] = durationNanos;
		nextIndex = (nextIndex + 1) % BUFFER_SIZE;
		if (filledCount < BUFFER_SIZE) {
			filledCount++;
		}
	}

	/** Average milliseconds-per-tick over the current window, or 0 if no ticks have run yet. */
	public synchronized double getAverageMspt() {
		if (filledCount == 0) {
			return 0;
		}
		long total = 0;
		for (int i = 0; i < filledCount; i++) {
			total += tickDurationsNanos[i];
		}
		return (total / (double) filledCount) / NANOS_PER_MILLI;
	}

	/** Estimated ticks-per-second, capped at the vanilla target of 20 - a server cannot tick faster than that. */
	public double getTps() {
		double avgMspt = getAverageMspt();
		if (avgMspt <= 0) {
			return TARGET_TPS;
		}
		return Math.min(TARGET_TPS, 1000.0 / avgMspt);
	}
}
