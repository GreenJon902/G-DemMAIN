import TextLink, { TEXT_LINK_WHITE } from "@/app/ui/TextLink";
import { FlexiDateDisplay } from "./FlexiDateDisplay";
import { FlexiDate } from "../lib/date/flexidate";

/**
 * A single line item for an event listing: its FlexiDate followed by a link to the event's page.
 * Used for both the "Recent Events" and "Recent Posts" lists on a person's profile page.
 *
 * Wraps as plain reflowing text (not flex) with a CSS hanging indent (negative text-indent +
 * padding), rather than a margin on a wrapped flex item — the latter doesn't reliably indent on
 * iOS Safari once the name wraps onto its own line.
 *
 * @param id - The event's id, used to build the `/hisdoc/event/[id]` link.
 * @param name - The event's name, shown as the link text.
 */
export default function SmallEvent({
    id, name, ...date
}: FlexiDate & { id: number, name: string }) {
    // TODO: The spacing+wrapping gets a bit messed up on iOS here
    return (
        <li className="mb-1 flex flex-wrap items-center gap-x-4 leading-none">
            <div className="flex flex-nowrap items-center gap-4">
                <FlexiDateDisplay {...date} />
                <span className="text-gray-400">-</span>
            </div>
            <TextLink href={"/hisdoc/event/" + id} color={TEXT_LINK_WHITE} className="text-nowrap">
                {name}
            </TextLink>
        </li>
    );
}
