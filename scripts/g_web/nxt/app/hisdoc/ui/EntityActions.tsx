import { PencilSquareIcon } from "@heroicons/react/20/solid";
import { LinkButton, BUTTON_INDIGO } from "@/app/ui/Button";
import type { AreaPermission } from "@g/com/lib/authConstants";
import type { ActionResult } from "../lib/actionHelpers";
import DeleteEntityButton from "./DeleteEntityButton";

/**
 * The edit/delete button row shown in an entity detail page's sidebar. Both buttons are
 * permission-gated on the same hisdoc level. Callers should hide the row entirely for
 * soft-deleted entities.
 *
 * @param entityLabel - Lowercase entity kind for the delete modal copy, e.g. "event".
 * @param minLevel - The hisdoc permission level editing/deleting this entity requires.
 * @param editHref - The entity's edit page.
 * @param deleteAction - Bound server action performing the delete; receives the changelog note
 *   and redirects on success or returns a human-readable error.
 * @param stackMode - Classname string that is meant to be used to specify how elements should stack. E.g. lg:flex-row.
 */
export default function EntityActions({stackMode = "", ...props}: {
    entityLabel: string,
    minLevel: AreaPermission<"hisdoc">,
    editHref: string,
    deleteAction: (note: string) => Promise<ActionResult>,
    stackMode?: string
}) {
    return (
        <div className={`flex gap-2 ${stackMode}`}>
            <LinkButton
                href={props.editHref}
                color={BUTTON_INDIGO}
                className="flex-1 items-center gap-1"
                disabled={{ area: "hisdoc", minLevel: props.minLevel }}
            >
                <PencilSquareIcon className="size-5" />
                Edit
            </LinkButton>
            <DeleteEntityButton
                className="flex-1 items-center gap-1"
                entityLabel={props.entityLabel}
                minLevel={props.minLevel}
                action={props.deleteAction}
            />
        </div>
    );
}
