import { FlexiDateDisplay } from "../../ui/FlexiDateDisplay";
import { EventSnapshotV1, toFlexiDateInput } from "../lib/snapshot";
import { FieldRow, Unchanged, BeforeAfter, NotRecorded } from "./common";

/** True if all 6 FlexiDate columns match between two EVENT snapshots. */
function dateFieldsEqual(a: EventSnapshotV1, b: EventSnapshotV1): boolean {
    return a.event_date_type === b.event_date_type
        && a.event_date1 === b.event_date1
        && a.event_date_time_offset === b.event_date_time_offset
        && a.event_date_units === b.event_date_units
        && a.event_date_diff === b.event_date_diff
        && a.event_date2 === b.event_date2;
}

/**
 * Diffs hd_event's 6 FlexiDate columns as one logical "Date" field — never partially diffed, per
 * spec: shown once as "(unchanged)" if the whole tuple matches, otherwise as explicit Before/After
 * panels via {@link FlexiDateDisplay}.
 */
export default function FlexiDateDiff({ label, before, after }: {
    label: string;
    before: EventSnapshotV1 | undefined;
    after: EventSnapshotV1 | undefined;
}) {
    if (before === undefined && after === undefined) return null;

    if (before !== undefined && after !== undefined && dateFieldsEqual(before, after)) {
        return <FieldRow label={label}><Unchanged><FlexiDateDisplay {...toFlexiDateInput(after)} /></Unchanged></FieldRow>;
    }

    return (
        <FieldRow label={label}>
            <BeforeAfter
                before={before === undefined ? <NotRecorded /> : <FlexiDateDisplay {...toFlexiDateInput(before)} />}
                after={after === undefined ? <NotRecorded /> : <FlexiDateDisplay {...toFlexiDateInput(after)} />}
            />
        </FieldRow>
    );
}
