"use server";

/**
 * The status of a systemd unit.
 * Note: there are technically more, but I don't think they'll come up.
 */
const STATUS_VALUES = ["active", "inactive", "failed", "activating", "deactivating"] as const;
export type Status = typeof STATUS_VALUES[number];

/**
 * The js representation of a systemd unit.
 */
export type Unit = {
    name: string,  // E.g. "g_mc"
    type: string,  // E.g. "service" or "timer"
    controllable: boolean,  // Should the user be able to start or stop this from the dashboard?
    expectActive: boolean  // Is normal behavior that this is running? E.g. g_mc.service being stopped is abnormal, but g_nightly_restart.service we don't expect to be running all the time
}
/** A utility function to create a {@link Unit}. */
const _mkUnit = (name: string, type: string, controllable: boolean, expectActive: boolean): Unit => ({ name, type, controllable, expectActive });

/** 
 * A list of all the units we want to keep track of and display to the user.
 * Note: this is not an exhaustive list of all units running on the system.
 */
const TRACKED_UNITS = [
    _mkUnit("g_mc", "service", true, true),
    _mkUnit("g_web", "service", true, true),
    _mkUnit("g_nightly_restart", "service", false, false),
    _mkUnit("g_nightly_restart", "timer", true, true),
    _mkUnit("mysql", "service", true, true)
];

/**
 * Gets the status of the units specified in {@link TRACKED_UNITS}.
 */ 
async function getUnitsStatuses() {
    // TODO: Get actual data for this
    return TRACKED_UNITS.map(unit => ({
        unit,
        status: STATUS_VALUES[Math.floor(Math.random() ** 5 * STATUS_VALUES.length)] as Status  // For now just pick a random value
    }));
}

export type PanelData = {
    unitsStatuses: {
        unit: Unit,
        status: Status
    }[],
    timestamp: number  // The time that this record was created, in ms since the epoch
}

/**
 * Get the data used on the main panel page.
 * This method should be fast enough that it can be used on the inital server-side render of the page.
 */
export async function loadPanelDataAction(): Promise<PanelData> {
    return {
        unitsStatuses: await getUnitsStatuses(),
        timestamp: Date.now()
    };
}

/**
 * Start, stop or restart a unit.
 */
export async function unitAction(unit: Unit, status: "start"|"stop"|"restart") {  // TODO: IMplement this
    console.log(`${status}ing ${unit.name}.${unit.type}`);
    await new Promise(r => setTimeout(r, 500));

}
