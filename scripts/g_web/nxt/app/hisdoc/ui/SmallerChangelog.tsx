import Link from "next/link";

/**
 * A compact changelog entry for use in a timeline: the same info as {@link SmallChangelog} (who,
 * when, and the change message), but with the message starting on its own line below the meta
 * line rather than beside it, and cropped to 2 lines rather than wrapped in full. Always links to
 * the change's detail page with a hover effect, like {@link SmallerEvent}.
 *
 * @param id - The hd_changelog row's own id, used to build the link to its detail page.
 * @param username - The username of whoever made the change, or null if automated/imported (shown as "System").
 * @param created_at - When the change was recorded.
 * @param message - The free-text note describing the change; cropped rather than wrapped if it runs long.
 * @param bgColor - Tailwind background class for the pill, e.g. "bg-gray-700".
 */
export default function SmallerChangelog({ id, username, created_at, message, bgColor }: {
    id: number;
    username: string | null;
    created_at: Date;
    message: string;
    bgColor: string;
}) {
    return (
        <Link href={`/hisdoc/changelog/${id}`} className={`flex flex-col gap-0.5 rounded px-2 py-1 hover:brightness-75 ${bgColor}`}>
            <span className="text-sm text-nowrap text-gray-300">{username ?? "System"} · {created_at.toLocaleDateString()}</span>
            <p className="line-clamp-2 max-w-96 text-sm whitespace-pre-wrap text-white">{message}</p>
        </Link>
    );
}
