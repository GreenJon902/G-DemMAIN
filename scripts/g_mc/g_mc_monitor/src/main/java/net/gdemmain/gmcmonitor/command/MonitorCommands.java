package net.gdemmain.gmcmonitor.command;

import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.gdemmain.gmcmonitor.stats.HeapStats;
import net.gdemmain.gmcmonitor.stats.TickStats;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;

/** In-game /gmcmonitor commands mirroring the tps/heap files exposed over the filesystem. */
public final class MonitorCommands {
	private MonitorCommands() {
	}

	public static void register(TickStats tickStats) {
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
				dispatcher.register(Commands.literal("gmcmonitor")
						.requires(source -> Commands.LEVEL_GAMEMASTERS.check(source.permissions()))
						.then(Commands.literal("tps").executes(ctx -> {
							double tps = tickStats.getTps();
							double mspt = tickStats.getAverageMspt();
							ctx.getSource().sendSuccess(() -> Component.literal(
									String.format("TPS: %.2f (%.2fms/tick avg)", tps, mspt)), false);
							return 1;
						}))
						.then(Commands.literal("heap").executes(ctx -> {
							long used = HeapStats.getUsedBytes();
							long allocated = HeapStats.getAllocatedBytes();
							ctx.getSource().sendSuccess(() -> Component.literal(
									String.format("Heap: %s used / %s allocated", formatBytes(used), formatBytes(allocated))), false);
							return 1;
						}))));
	}

	private static String formatBytes(long bytes) {
		return String.format("%,d bytes (%.1f MiB)", bytes, bytes / 1024.0 / 1024.0);
	}
}
