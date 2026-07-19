"use client";

import { useState } from "react";
import { TrashIcon } from "@heroicons/react/20/solid";
import { useAuthContext, makeAreaSudoGuard } from "@/app/AuthContext";
import { useErrorContext } from "@/app/ErrorContext";
import { ActionButton, SimpleButton, BUTTON_RED, BUTTON_GRAY } from "@/app/ui/Button";
import ModalShell from "@/app/ui/ModalShell";
import TextInput from "@/app/ui/TextInput";
import type { AreaPermission } from "@g/com/lib/authConstants";
import type { ActionResult } from "../lib/actionHelpers";

/**
 * A permission-gated delete button for a hisdoc entity page. Opens a modal that requires a
 * changelog note (used as the deletion's changelog message) before running the bound delete
 * action behind the sudo guard.
 *
 * @param entityLabel - Lowercase entity kind for the modal copy, e.g. "event".
 * @param minLevel - The hisdoc permission level deleting this entity requires.
 * @param action - Bound server action performing the delete; receives the trimmed note and
 *   redirects on success or returns a human-readable error.
 */
export default function DeleteEntityButton(props: {
    entityLabel: string,
    minLevel: AreaPermission<"hisdoc">,
    action: (note: string) => Promise<ActionResult>
}) {
    const ctx = useAuthContext();
    const { showError } = useErrorContext();
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");

    return (
        <>
            <SimpleButton
                color={BUTTON_RED}
                className="items-center gap-1"
                title="Delete"
                disabled={{ area: "hisdoc", minLevel: props.minLevel }}
                callback={() => setOpen(true)}
            >
                <TrashIcon className="size-5" />
                Delete
            </SimpleButton>
            <ModalShell
                open={open}
                onDismiss={() => setOpen(false)}
                title={"Delete " + props.entityLabel}
                description={`This ${props.entityLabel} will be deleted. Enter a changelog note explaining why.`}
            >
                <TextInput
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Changelog note"
                />
                <div className="flex gap-2">
                    <ActionButton
                        color={BUTTON_RED}
                        className="flex-1"
                        disabled={note.trim() === ""}
                        guard={makeAreaSudoGuard("hisdoc", props.minLevel, ctx)}
                        onError={showError}
                        action={async () => {
                            const result = await props.action(note.trim());
                            if (result?.error) throw new Error(result.error);
                        }}
                    >
                        Delete
                    </ActionButton>
                    <SimpleButton color={BUTTON_GRAY} className="flex-1" callback={() => setOpen(false)}>
                        Cancel
                    </SimpleButton>
                </div>
            </ModalShell>
        </>
    );
}
