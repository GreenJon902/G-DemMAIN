import TextLink, { TEXT_LINK_WHITE } from "@/app/ui/TextLink";
import { FlexiDateDisplay } from "./FlexiDateDisplay";
import { FlexiDateInput } from "../lib/flexidate";

/**
 * A single line item for an event listing: its FlexiDate followed by a link to the event's page.
 * Used for both the "Recent Events" and "Recent Posts" lists on a person's profile page.
 *
 * @param id - The event's id, used to build the `/hisdoc/event/[id]` link.
 * @param name - The event's name, shown as the link text.
 */
export default function SmallEvent({
    id, name, ...date
}: FlexiDateInput & { id: number, name: string }) {
    return (
        <li className="flex items-center gap-4">
            <FlexiDateDisplay {...date} />
            <span className="text-white">-</span>
            <TextLink href={"/hisdoc/event/" + id} color={TEXT_LINK_WHITE}>
                {name}
            </TextLink>
        </li>
    );
}
