/**
 * Finds the value of a per-record accessor across an array of records, preferring the value from the most
 * recent record for which it is defined. Useful for fields assumed constant across records (e.g. total system
 * memory, or a whole per-core/per-cgroup Map) that may legitimately be missing on individual records - e.g.
 * records predating that field's introduction, or a record where that subsystem failed to be read.
 */
export function latestDefined<T, V>(records: T[], accessor: (record: T) => V | null | undefined): V | null {
    for (let i = records.length - 1; i >= 0; i--) {
        const value = accessor(records[i]);
        if (value !== null && value !== undefined) return value;
    }
    return null;
}
