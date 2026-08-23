import type { Mem, MemAggregate, PlayerCount, PlayerCountAggregate, Tps, TpsAggregate } from "./panelUtils";

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

/** True if a Mem field holds aggregate stats ({min, mean, max, total}) rather than a plain snapshot ({used, total}). */
export function isAggregateMem(mem: Mem): mem is MemAggregate {
    return "min" in mem;
}

/** True if a Tps field holds aggregate stats ({min, mean, max}) rather than a plain snapshot number. */
export function isAggregateTps(tps: Tps): tps is TpsAggregate {
    return typeof tps === "object";
}

/** True if a PlayerCount field holds aggregate stats ({min, mean, max}) rather than a plain snapshot number. */
export function isAggregatePlayerCount(playerCount: PlayerCount): playerCount is PlayerCountAggregate {
    return typeof playerCount === "object";
}


// TODO: The next few functions can be generalised?
/**
 * Reduces a Mem field to a single {value, min, max} point for graphing - value is `used` for a snapshot or
 * `mean` for an aggregate, and min/max are null unless the field is aggregate (i.e. there is no band to draw).
 */
export function memPoint(mem: Mem | null | undefined): { value: number | null, min: number | null, max: number | null } {
    if (mem === null || mem === undefined) return { value: null, min: null, max: null };
    return isAggregateMem(mem) ? { value: mem.mean, min: mem.min, max: mem.max } : { value: mem.used, min: null, max: null };
}

// See memPoint above - same idea but for a Tps field, whose snapshot form is a bare number rather than an object
export function tpsPoint(tps: Tps | null | undefined): { value: number | null, min: number | null, max: number | null } {
    if (tps === null || tps === undefined) return { value: null, min: null, max: null };
    return isAggregateTps(tps) ? { value: tps.mean, min: tps.min, max: tps.max } : { value: tps, min: null, max: null };
}

// See tpsPoint above - same idea but for a PlayerCount field
export function playerCountPoint(playerCount: PlayerCount | null | undefined): { value: number | null, min: number | null, max: number | null } {
    if (playerCount === null || playerCount === undefined) return { value: null, min: null, max: null };
    return isAggregatePlayerCount(playerCount) ? { value: playerCount.mean, min: playerCount.min, max: playerCount.max } : { value: playerCount, min: null, max: null };
}
