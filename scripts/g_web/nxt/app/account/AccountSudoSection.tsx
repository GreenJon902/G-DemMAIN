"use client";

import { ActionButton, BUTTON_GREEN, BUTTON_RED, BUTTON_YELLOW } from "../ui/Button";
import { useAuthContext } from "../AuthContext";
import { exitSudoAction } from "./actions";

/**
 * Component which tells the user if they're in sudo mode, and gives them appropriate controls.
 */
export default function AccountSudoSection() {
    const { sudoVerifiedAt, tfaEnabled, requestSudo, showSudoUnavailable, onSudoExited } = useAuthContext();
    const inSudo = sudoVerifiedAt !== null;

    // Button callbacks -----------------
    const handleEnterSudo = async () => {
        if (!tfaEnabled) {
            await showSudoUnavailable();
            return;
        }
        await requestSudo();
    };
    const handleExitSudo = async () => {
        await exitSudoAction();
        onSudoExited();
    };
    const handleRefreshSudo = async () => {
        await requestSudo();
    };

    return (
        <div className="flex items-center gap-2">
            {inSudo ? (
                <>
                    <span className="text-gray-400">You are in sudo mode.</span>
                    <ActionButton action={handleExitSudo} color={BUTTON_RED}>
                        Exit sudo mode
                    </ActionButton>
                    <ActionButton action={handleRefreshSudo} color={BUTTON_YELLOW}>
                        Refresh sudo mode
                    </ActionButton>
                </>
            ) : (
                <>
                    <span className="text-gray-400">You are not in sudo mode.</span>
                    <ActionButton action={handleEnterSudo} color={BUTTON_GREEN}>
                        Enter sudo mode
                    </ActionButton>
                </>
            )}
        </div>
    );
}
