import "server-only";
import { ReactNode } from "react";
import prisma from "@g/com/lib/prisma/client";
import { hd_changelog_what } from "@g/com/prisma/client";
import { notFound } from "next/navigation";
import SplitPage from "../../ui/SplitPage";
import StatsPill from "../../ui/StatsPill";
import WarningBanner from "../../ui/WarningBanner";
import TextLink, { TEXT_LINK_WHITE } from "../../../ui/TextLink";
import { buildTagFieldDiffs, buildPersonFieldDiffs, buildEventFieldDiffs, UnsupportedSchemaVersionError, FieldDiff } from "../lib/fieldDiffs";
import { collectReferencedIds } from "../lib/collectRefs";
import { resolveRefs } from "../lib/resolveRefs";
import ChangelogDiff from "../ui/ChangelogDiff";
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

/** Parses both snapshot sides for one `what` branch and builds its field-diff rows + referenced-entity lookups. */
async function buildDiff(
    what: hd_changelog_what,
    schemaVersion: number,
    oldValues: string | null,
    newValues: string | null,
    entryUserId: number | null
): Promise<{ diffSection: ReactNode } & Built> {
    if (what === hd_changelog_what.TAG) {
        const { fields, before, after } = buildTagFieldDiffs(schemaVersion, oldValues, newValues);
        const refs = await resolveRefs(collectReferencedIds(what, before, after, entryUserId));
        return { diffSection: <ChangelogDiff fields={fields} refs={refs} />, fields, before, after };
    }

    if (what === hd_changelog_what.PERSON) {
        const { fields, before, after } = buildPersonFieldDiffs(schemaVersion, oldValues, newValues);
        const refs = await resolveRefs(collectReferencedIds(what, before, after, entryUserId));
        return { diffSection: <ChangelogDiff fields={fields} refs={refs} />, fields, before, after };
    }

    // what === hd_changelog_what.EVENT — the only remaining case, so left unguarded
    const { fields, before, after } = buildEventFieldDiffs(schemaVersion, oldValues, newValues);
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

    const entityStatus = await lookupEntityStatus(entry.what, entry.entity_id);

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

    const entityLabel = `${entry.what} #${entry.entity_id}`;
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
                    {before !== null && before.soft_deleted && <WarningBanner>The &quot;before&quot; state of this change has soft-deleted.</WarningBanner>}
                    {after !== null && after.soft_deleted && <WarningBanner>The &quot;after&quot; state of this change has soft-deleted.</WarningBanner>}
                    {unsupportedReason !== null && <WarningBanner>Could not render a diff for this entry ({unsupportedReason}). Showing the raw stored data instead.</WarningBanner>}

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
