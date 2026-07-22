package net.gdemmain.gmcmonitor;

import com.mojang.brigadier.Command;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.permission.v1.PermissionNode;
import net.fabricmc.fabric.api.permission.v1.PermissionPredicates;
import net.minecraft.commands.CommandSourceStack;
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
            // TPS command ---
			dispatcher.register(Commands.literal("tps")
					.requires(PermissionPredicates.require(TPS_PERMISSION, PermissionLevel.GAMEMASTERS))
					.executes(ctx -> {
						double tps = tickStats.getTps();
						double mspt = tickStats.getAverageMspt();
						ctx.getSource().sendSuccess(() -> Component.literal(
								String.format("TPS: %.2f (%.2fms/tick avg)", tps, mspt)), false);
						return 1;
					}));

            // Heap comand ---
			// Zero-argument commands don't fire through Brigadier redirects (redirect only
			// engages when there's further input to parse), so heap/mem/memory each need
			// their own executes() bound to the same command lambda instead
			Command<CommandSourceStack> heapCommand = ctx -> {
				long used = HeapStats.getUsedBytes();
				long allocated = HeapStats.getAllocatedBytes();
				ctx.getSource().sendSuccess(() -> Component.literal(
						String.format("Heap: %s used / %s allocated", formatBytes(used), formatBytes(allocated))), false);
				return 1;
			};
			dispatcher.register(Commands.literal("heap")
					.requires(PermissionPredicates.require(HEAP_PERMISSION, PermissionLevel.GAMEMASTERS))
					.executes(heapCommand));
			dispatcher.register(Commands.literal("mem")
					.requires(PermissionPredicates.require(HEAP_PERMISSION, PermissionLevel.GAMEMASTERS))
					.executes(heapCommand));
			dispatcher.register(Commands.literal("memory")
					.requires(PermissionPredicates.require(HEAP_PERMISSION, PermissionLevel.GAMEMASTERS))
					.executes(heapCommand));
		});
	}

	private static String formatBytes(long bytes) {
		return String.format("%.1f GB", bytes / 1024.0 / 1024.0 / 1024.0);
	}
}
