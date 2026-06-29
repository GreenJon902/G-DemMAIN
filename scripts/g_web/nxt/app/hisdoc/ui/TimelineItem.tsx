import Link from "next/link";
import { FlexiDateInput } from "../lib/flexidate";
import { FlexiDateDisplay } from "./FlexiDateDisplay";
import { TagChip } from "./TagChip";


/**
 * A card representing a single historical event on the timeline.
 *
 * @param id - The event's unique identifier, used to build the detail page href.
 * @param name - The display name of the event.
 * @param description - A longer description, truncated to three lines in the UI.
 * @param date - The FlexiDate describing when the event occurred.
 * @param tags - The tags associated with the event, rendered in the order given.
 */
export function TimelineItem({ id, name, description, date, tags }: {
    id: number;
    name: string;
    description: string;
    date: FlexiDateInput;
    tags: { id: number; name: string; color: number }[];
}) {
    return (
        <div className="flex flex-col gap-3 rounded-lg bg-gray-800 p-4">
            <Link href={"/hisdoc/event/" + id} className="text-xl font-bold">
                {name}
            </Link>
            <FlexiDateDisplay {...date} />
            <p className="line-clamp-3 text-gray-300">{description}</p>
            <div className="flex flex-row flex-wrap gap-2">
                {tags.map(tag => (
                    <TagChip key={tag.id} id={tag.id} name={tag.name} color={tag.color} />
                ))}
            </div>
        </div>
    );
}
