package net.gdemmain.gmcmonitor.mixin;

import net.gdemmain.gmcmonitor.event.EventHooks;
import net.minecraft.advancements.AdvancementHolder;
import net.minecraft.server.PlayerAdvancements;
import net.minecraft.server.level.ServerPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * PlayerAdvancements has no public event for "an advancement was just completed", so this hooks
 * the one method that reports it (award() returns true exactly when the advancement newly became
 * complete) and forwards it to the chat socket if the advancement is one vanilla would announce.
 */
@Mixin(PlayerAdvancements.class)
public abstract class AdvancementAnnounceMixin {
	@Shadow
	private ServerPlayer player;

	@Inject(method = "award", at = @At("RETURN"))
	private void gMcMonitor$onAward(AdvancementHolder advancement, String criterion, CallbackInfoReturnable<Boolean> cir) {
		if (!cir.getReturnValue()) {
			return;
		}
		advancement.value().display().ifPresent(display -> {
			if (display.shouldAnnounceChat()) {
				EventHooks.fireAdvancement(player, display.getTitle());
			}
		});
	}
}
