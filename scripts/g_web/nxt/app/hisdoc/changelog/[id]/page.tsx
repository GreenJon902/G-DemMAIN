import "server-only";
import { ReactNode } from "react";
import prisma from "@g/com/lib/prisma/client";
import { hd_changelog_what } from "@g/com/prisma/client";
import { notFound } from "next/navigation";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import SplitPage from "../../ui/SplitPage";
import StatsPill from "../../ui/StatsPill";
import { parseTagSnapshot, parsePersonSnapshot, parseEventSnapshot, UnsupportedSchemaVersionError } from "../lib/snapshot";
import { TAG_FIELD_VERSIONS, PERSON_FIELD_VERSIONS, EVENT_FIELD_VERSIONS } from "../lib/fields";
import { collectReferencedIds } from "../lib/collectRefs";
import { resolveRefs } from "../lib/resolveRefs";
import ChangelogDiff from "../ui/ChangelogDiff";
import UnsupportedSchemaVersion from "../ui/UnsupportedSchemaVersion";

/** True if the entity identified by (what, entityId) has no live row, or its live row is soft-deleted. */
async function checkEntityGone(what: hd_changelog_what, entityId: number): Promise<boolean> {
    if (what === hd_changelog_what.TAG) {
        const row = await prisma().hd_tag.findUnique({ where: { id: entityId }, select: { soft_deleted: true } });
        return row === null || row.soft_deleted;
    }
    if (what === hd_changelog_what.PERSON) {
        const row = await prisma().hd_person.findUnique({ where: { id: entityId }, select: { soft_deleted: true } });
        return row === null || row.soft_deleted;
    }
    // what === hd_changelog_what.EVENT — the only remaining case, so left unguarded
    const row = await prisma().hd_event.findUnique({ where: { id: entityId }, select: { soft_deleted: true } });
    return row === null || row.soft_deleted;
}

/** Builds the diff section for one `what` branch: parses both snapshot sides, looks up the field table, resolves refs, renders. */
async function buildDiffSection(
    what: hd_changelog_what,
    schemaVersion: number,
    oldValues: string | null,
    newValues: string | null,
    entryUserId: number | null
): Promise<{ diffSection: ReactNode; before: { soft_deleted: boolean } | null; after: { soft_deleted: boolean } | null }> {
    if (what === hd_changelog_what.TAG) {
        const before = parseTagSnapshot(schemaVersion, oldValues);
        const after = parseTagSnapshot(schemaVersion, newValues);
        const fields = TAG_FIELD_VERSIONS[schemaVersion];
        if (fields === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
        const refs = await resolveRefs(collectReferencedIds(what, before, after, entryUserId));
        return { diffSection: <ChangelogDiff fields={fields} before={before} after={after} refs={refs} />, before, after };
    }

    if (what === hd_changelog_what.PERSON) {
        const before = parsePersonSnapshot(schemaVersion, oldValues);
        const after = parsePersonSnapshot(schemaVersion, newValues);
        const fields = PERSON_FIELD_VERSIONS[schemaVersion];
        if (fields === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
        const refs = await resolveRefs(collectReferencedIds(what, before, after, entryUserId));
        return { diffSection: <ChangelogDiff fields={fields} before={before} after={after} refs={refs} />, before, after };
    }

    // what === hd_changelog_what.EVENT — the only remaining case, so left unguarded
    const before = parseEventSnapshot(schemaVersion, oldValues);
    const after = parseEventSnapshot(schemaVersion, newValues);
    const fields = EVENT_FIELD_VERSIONS[schemaVersion];
    if (fields === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
    const refs = await resolveRefs(collectReferencedIds(what, before, after, entryUserId));
    return { diffSection: <ChangelogDiff fields={fields} before={before} after={after} refs={refs} />, before, after };
}

/** An amber warning banner, matching the callout style used for hd_event.details on the event page. */
function Banner({ children }: { children: ReactNode }) {
    return (
        <p className="my-2 flex items-center gap-2 border border-amber-600 bg-amber-100 pl-1 whitespace-pre-wrap text-amber-900">
            <ExclamationTriangleIcon className="size-5 shrink-0 text-amber-700" />
            {children}
        </p>
    );
}

/**
 * Detail page for a single hd_changelog entry: the raw entry metadata plus a full before/after
 * diff of the entity it recorded, built generically from the field-descriptor table for its
 * `what`/`schema_version` (see changelog/lib/fields.ts).
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string (hd_changelog.id).
 */
export default async function ChangelogEntryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const entry = await prisma().hd_changelog.findUnique({
        where: { id },
        include: { user: { select: { username: true } } }
    });
    if (!entry) notFound();

    const entityGone = await checkEntityGone(entry.what, entry.entity_id);

    let diffSection: ReactNode;
    let before: { soft_deleted: boolean } | null = null;
    let after: { soft_deleted: boolean } | null = null;

    if (entry.old_values === null && entry.new_values === null) {
        diffSection = <p className="text-gray-400">No snapshot data available for this entry.</p>;
    } else {
        try {
            const built = await buildDiffSection(entry.what, entry.schema_version, entry.old_values, entry.new_values, entry.user_id);
            diffSection = built.diffSection;
            before = built.before;
            after = built.after;
        } catch (err) {
            const reason = err instanceof UnsupportedSchemaVersionError
                ? `unsupported schema_version ${err.schemaVersion}`
                : "could not parse the stored snapshot";
            diffSection = <UnsupportedSchemaVersion reason={reason} rawOld={entry.old_values} rawNew={entry.new_values} />;
        }
    }

    return (
        <SplitPage
            title={`Changelog #${entry.id}: ${entry.what} #${entry.entity_id} · ${entry.action}`}
            main={
                <>
                    {entry.soft_deleted && <Banner>This changelog entry has been soft-deleted.</Banner>}
                    {entityGone && <Banner>This {entry.what.toLowerCase()} (#{entry.entity_id}) no longer exists.</Banner>}
                    {before !== null && before.soft_deleted && <Banner>The &quot;before&quot; state of this change was already soft-deleted.</Banner>}
                    {after !== null && after.soft_deleted && <Banner>The &quot;after&quot; state of this change is soft-deleted.</Banner>}

                    <p className="whitespace-pre-wrap text-gray-200">{entry.message}</p>

                    <div className="mt-4">{diffSection}</div>
                </>
            }
            sidebar={
                <StatsPill>
                    <span>CID: {entry.id}</span>
                    <span>By {entry.user?.username ?? "System"}</span>
                    <span>{entry.created_at.toLocaleString()}</span>
                    <span>Schema v{entry.schema_version}</span>
                </StatsPill>
            }
        />
    );
}
