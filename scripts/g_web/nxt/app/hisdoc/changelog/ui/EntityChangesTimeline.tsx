import SmallerChangelog from "../../ui/SmallerChangelog";

/** One entry in an {@link EntityChangesTimeline}. */
export type TimelineChange = {
    id: number;
    username: string | null;
    created_at: Date;
    message: string;
};

/**
 * A mini vertical timeline of every changelog entry recorded for one entity, with the
 * currently-viewed change picked out (filled dot, full-brightness pill) among the rest (hollow
 * dot, darker pill) — lets a reader jump from one change straight to its neighbours in the
 * entity's full history.
 *
 * @param changes - Every changelog entry for the entity, in the order they should be listed.
 * @param selectedId - The id of the change currently being viewed.
 */
export default function EntityChangesTimeline({ changes, selectedId }: {
    changes: Array<TimelineChange>;
    selectedId: number;
}) {
    return (
        <ul className="mt-2 flex flex-col">
            {changes.map((change, i) => {
                const selected = change.id === selectedId;
                return (
                    <li key={change.id} className="flex gap-2">
                        <div className="flex w-3 shrink-0 flex-col items-center">
                            <div className={`w-px flex-1 ${i === 0 ? "invisible" : "bg-gray-600"}`} />
                            <div className={`size-3 shrink-0 rounded-full ${selected ? "bg-indigo-400" : "border-2 border-gray-500"}`} />
                            <div className={`w-px flex-1 ${i === changes.length - 1 ? "invisible" : "bg-gray-600"}`} />
                        </div>
                        <div className="min-w-0 flex-1 pb-2">
                            <SmallerChangelog
                                id={change.id}
                                username={change.username}
                                created_at={change.created_at}
                                message={change.message}
                                bgColor={selected ? "bg-indigo-700" : "bg-gray-800"}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
