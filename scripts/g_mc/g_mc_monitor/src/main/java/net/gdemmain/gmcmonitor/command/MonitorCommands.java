package net.gdemmain.gmcmonitor.command;

import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.permission.v1.PermissionNode;
import net.fabricmc.fabric.api.permission.v1.PermissionPredicates;
import net.gdemmain.gmcmonitor.GMcMonitor;
import net.gdemmain.gmcmonitor.stats.HeapStats;
import net.gdemmain.gmcmonitor.stats.TickStats;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.permissions.PermissionLevel;

/**
 * In-game /tps and /heap commands mirroring the tps/heap files exposed over the filesystem.
 * Gated by Fabric's permission-node API (see doc/G-DemMAIN Monitor Mod.md) - a permission plugin
 * like LuckPerms can grant/deny the nodes directly, and if none is installed they fall back to
 * requiring permission level 2 (gamemaster/moderator), the same as before.
 */
public final class MonitorCommands {
	public static final PermissionNode<Boolean> TPS_PERMISSION =
			PermissionNode.of(Identifier.fromNamespaceAndPath(GMcMonitor.MOD_ID, "tps"));
	public static final PermissionNode<Boolean> HEAP_PERMISSION =
			PermissionNode.of(Identifier.fromNamespaceAndPath(GMcMonitor.MOD_ID, "heap"));

	private MonitorCommands() {
	}

	public static void register(TickStats tickStats) {
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
			dispatcher.register(Commands.literal("tps")
					.requires(PermissionPredicates.require(TPS_PERMISSION, PermissionLevel.GAMEMASTERS))
					.executes(ctx -> {
						double tps = tickStats.getTps();
						double mspt = tickStats.getAverageMspt();
						ctx.getSource().sendSuccess(() -> Component.literal(
								String.format("TPS: %.2f (%.2fms/tick avg)", tps, mspt)), false);
						return 1;
					}));
			dispatcher.register(Commands.literal("heap")
					.requires(PermissionPredicates.require(HEAP_PERMISSION, PermissionLevel.GAMEMASTERS))
					.executes(ctx -> {
						long used = HeapStats.getUsedBytes();
						long allocated = HeapStats.getAllocatedBytes();
						ctx.getSource().sendSuccess(() -> Component.literal(
								String.format("Heap: %s used / %s allocated", formatBytes(used), formatBytes(allocated))), false);
						return 1;
					}));
		});
	}

	private static String formatBytes(long bytes) {
		return String.format("%,d bytes (%.1f MiB)", bytes, bytes / 1024.0 / 1024.0);
	}
}
