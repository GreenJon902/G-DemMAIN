"use client";

import { LinkButton, BUTTON_INDIGO } from "@/app/ui/Button";
import { useAuthContext } from "@/app/AuthContext";

/** Link to an event's edit page; disabled when the viewer lacks hisdoc editor access. */
export default function EditEventButton({ id }: { id: number }) {
    const { checkPermission } = useAuthContext();
    return (
        <LinkButton href={"/hisdoc/event/" + id + "/edit"} color={BUTTON_INDIGO} disabled={!checkPermission("hisdoc", "editor")}>
            Edit
        </LinkButton>
    );
}
