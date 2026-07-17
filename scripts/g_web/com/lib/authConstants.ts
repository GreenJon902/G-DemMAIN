export const SUDO_WINDOW_MS = 30 * 60 * 1000;  // How long sudo mode remains active

export type AreaConfig = {
    readonly levels: readonly string[],
    readonly default: string | null,  // Null means no access by default
    readonly sudoFrom: string | null  // This level and above require sudo; null means none required. This only applies to write operations; read never requires sudo
}

// Definition for the different restricted areas.
//  * sudoFrom - The minimum level that requires sudo. null means no sudo is ever required by this area. If a user has 2FA enabled, sudo is always required regardless of this setting.
// Note, the permission specification must be manually mirrored in the database schema - `doc/Databases.md`.
export const AREAS = {
    panel: {
        levels: ["viewer", "admin"] as const,
        default: null,      // null = no panel access by default
        sudoFrom: "admin"   // admin-level panel actions require sudo
    },
    hisdoc: {
        levels: ["viewer", "editor", "admin"] as const,
        default: "viewer",  // all users can view hisdoc by default
        sudoFrom: null      // no sudo required for hisdoc operations
    }
} satisfies Record<string, AreaConfig>;

export type Area = keyof typeof AREAS;
/** The valid permission level strings for a given area. */
export type AreaPermission<A extends Area> = typeof AREAS[A]["levels"][number];

/** Returns true if userLevel meets or exceeds minLevel in the given ordered levels array. */
export function checkMinPermission(levels: readonly string[], userLevel: string | null, minLevel: string): boolean {
    if (userLevel === null) return false;
    return levels.indexOf(userLevel) >= levels.indexOf(minLevel);
}

// A discriminated union (not the naive { area: Area, minLevel: AreaPermission<Area> }, which would
// flatten to the union of every area's levels and so wouldn't catch a mismatched area/level pair)
export type AreaPermissionRequirement = { [A in Area]: { area: A, minLevel: AreaPermission<A> } }[Area];
