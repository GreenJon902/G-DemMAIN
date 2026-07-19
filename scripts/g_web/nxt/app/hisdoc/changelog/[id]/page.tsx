import "server-only";
import { ReactNode } from "react";
import prisma from "@g/com/lib/prisma/client";
import { hd_changelog_what } from "@g/com/prisma/client";
import { notFound } from "next/navigation";
import SplitPage from "../../ui/SplitPage";
import StatsPill from "../../ui/StatsPill";
import WarningBanner from "../../ui/WarningBanner";
import PageSection from "../../../ui/PageSection";
import TextLink, { TEXT_LINK_WHITE } from "../../../ui/TextLink";
import { buildFieldDiffs, UnsupportedSchemaVersionError, FieldDiff } from "../lib/fieldDiffs";
import { formatTimestamp } from "../../lib/date/date";
import { collectReferencedIds } from "../lib/collectRefs";
import { resolveRefs } from "../lib/resolveRefs";
import ChangelogDiff from "../ui/ChangelogDiff";
import EntityChangesTimeline from "../ui/EntityChangesTimeline";
import UnsupportedSchemaVersion from "../ui/UnsupportedSchemaVersion";

const ENTITY_PATH: Record<hd_changelog_what, string> = {
    [hd_changelog_what.TAG]: "tag",
    [hd_changelog_what.PERSON]: "person",
    [hd_changelog_what.EVENT]: "event"
};

type EntityStatus = { missing: boolean; softDeleted: boolean };

/**
 * Looks up the live state of the entity identified by (what, entityId): whether it exists at all,
 * and if so whether it's soft-deleted. A soft-deleted entity still gets its own warning-bannered
 * page (see event/tag/person [id]/page.tsx), so it's treated as existing for linking purposes —
 * only a fully-missing row is "missing".
 */
async function lookupEntityStatus(what: hd_changelog_what, entityId: number): Promise<EntityStatus> {
    if (what === hd_changelog_what.TAG) {
        const row = await prisma().hd_tag.findUnique({ where: { id: entityId }, select: { soft_deleted: true } });
        return { missing: row === null, softDeleted: row?.soft_deleted ?? false };
    }
    if (what === hd_changelog_what.PERSON) {
        const row = await prisma().hd_person.findUnique({ where: { id: entityId }, select: { soft_deleted: true } });
        return { missing: row === null, softDeleted: row?.soft_deleted ?? false };
    }
    // what === hd_changelog_what.EVENT — the only remaining case, so left unguarded
    const row = await prisma().hd_event.findUnique({ where: { id: entityId }, select: { soft_deleted: true } });
    return { missing: row === null, softDeleted: row?.soft_deleted ?? false };
}

type Built = { fields: FieldDiff[]; before: { soft_deleted: boolean } | null; after: { soft_deleted: boolean } | null };

/** Parses both snapshot sides of a changelog entry and builds its field-diff rows + referenced-entity lookups. */
async function buildDiff(
    what: hd_changelog_what,
    schemaVersion: number,
    oldValues: string | null,
    newValues: string | null,
    entryUserId: number | null
): Promise<{ diffSection: ReactNode } & Built> {
    const { fields, before, after } = buildFieldDiffs(schemaVersion, what, oldValues, newValues);
    const refs = await resolveRefs(collectReferencedIds(what, before, after, entryUserId));
    return { diffSection: <ChangelogDiff fields={fields} refs={refs} />, fields, before, after };
}

/**
 * Detail page for a single hd_changelog entry: the raw entry metadata plus a full before/after
 * diff of the entity it recorded, built generically from the field-diff builder for its
 * `what`/`schema_version` (see changelog/lib/fieldDiffs.ts).
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

    const [entityStatus, entityChanges] = await Promise.all([
        lookupEntityStatus(entry.what, entry.entity_id),
        // Every other changelog entry for this same entity, for the mini timeline — mirrors the
        // soft_deleted filtering of the "Changelog" list on the entity's own page
        prisma().hd_changelog.findMany({
            where: { what: entry.what, entity_id: entry.entity_id, soft_deleted: false },
            orderBy: { created_at: "desc" },
            include: { user: { select: { username: true } } }
        })
    ]);

    let diffSection: ReactNode;
    let before: { soft_deleted: boolean } | null = null;
    let after: { soft_deleted: boolean } | null = null;
    // Set when the diff falls back to a raw dump; its warning banner is rendered above the change
    // message (with the other banners) rather than inside the diff section below it.
    let unsupportedReason: string | null = null;

    if (entry.old_values === null && entry.new_values === null) {
        diffSection = <p className="text-gray-400">No snapshot data available for this entry.</p>;
    } else {
        try {
            const built = await buildDiff(entry.what, entry.schema_version, entry.old_values, entry.new_values, entry.user_id);
            diffSection = built.diffSection;
            before = built.before;
            after = built.after;
        } catch (err) {
            unsupportedReason = err instanceof UnsupportedSchemaVersionError
                ? `unsupported schema_version ${err.schemaVersion}`
                : "could not parse the stored snapshot";
            diffSection = <UnsupportedSchemaVersion rawOld={entry.old_values} rawNew={entry.new_values} />;
        }
    }

    const entityLabel = `${entry.what} (#${entry.entity_id})`;
    const titleNode = (
        <>
            Change #{entry.id}: {entityStatus.missing ? entityLabel : (
                // inline-block so the section title's solid underline isn't painted across the link,
                // leaving only TextLink's own dotted underline visible
                <TextLink className="inline-block" href={`/hisdoc/${ENTITY_PATH[entry.what]}/${entry.entity_id}`} color={TEXT_LINK_WHITE}>{entityLabel}</TextLink>
            )} · {entry.action}
        </>
    );

    return (
        <SplitPage
            titleNode={titleNode}
            main={
                <>
                    {entry.soft_deleted && <WarningBanner>This changelog entry has been soft-deleted.</WarningBanner>}
                    {entityStatus.missing && <WarningBanner>This {entry.what.toLowerCase()} (#{entry.entity_id}) no longer exists.</WarningBanner>}
                    {!entityStatus.missing && entityStatus.softDeleted && <WarningBanner>This {entry.what.toLowerCase()} (#{entry.entity_id}) has been deleted.</WarningBanner>}
                    {before !== null && before.soft_deleted && <WarningBanner>The &quot;before&quot; state of this change has soft-deleted true.</WarningBanner>}
                    {after !== null && after.soft_deleted && <WarningBanner>The &quot;after&quot; state of this change has soft-deleted true.</WarningBanner>}
                    {unsupportedReason !== null && <WarningBanner>Could not render a diff for this entry ({unsupportedReason}). Showing the raw stored data instead.</WarningBanner>}

                    <p className="whitespace-pre-wrap text-gray-200">{entry.message}</p>

                    <div className="mt-4">{diffSection}</div>
                </>
            }
            sidebarA={
                <StatsPill>
                    <span>CID: {entry.id}</span>
                    <span>By {entry.user?.username ?? "System"}</span>
                    <span>{formatTimestamp(entry.created_at)}</span>
                    <span>Schema v{entry.schema_version}</span>
                </StatsPill>
            }
            sidebarBUnfoldedWrapper={StatsPill}
            sidebarB={
                entityChanges.length > 0 && (
                    <PageSection title="History" sub>
                        <EntityChangesTimeline
                            changes={entityChanges.map(change => ({
                                id: change.id,
                                username: change.user?.username ?? null,
                                created_at: change.created_at,
                                message: change.message
                            }))}
                            selectedId={entry.id}
                        />
                    </PageSection>
                )
            }
        />
    );
}
