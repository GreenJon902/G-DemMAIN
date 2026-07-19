import TextLink, { TEXT_LINK_GRAY } from "../../ui/TextLink";
import { formatTimestampDate } from "../lib/dateFormat";

/**
 * One list entry for an entity's changelog section (event/tag/person pages all show the same
 * shape). The meta line links through to the full diff at `/hisdoc/changelog/[id]`.
 *
 * @param id - The hd_changelog row's own id, used to build the link to its detail page.
 * @param username - The username of whoever made the change, or null if automated/imported (shown as "System").
 * @param created_at - When the change was recorded.
 * @param message - The free-text note describing the change.
 */
export default function SmallChangelog({ id, username, created_at, message }: {
    id: number;
    username: string | null;
    created_at: Date;
    message: string;
}) {
    return (
        <li className="flex flex-row">
            <TextLink href={`/hisdoc/changelog/${id}`} color={TEXT_LINK_GRAY} className="w-fit text-nowrap">
                {username ?? "System"} · {formatTimestampDate(created_at)}
            </TextLink>: 
            <p className="ml-1 line-clamp-3 whitespace-pre-wrap">{message}</p>
        </li>
    );
}
