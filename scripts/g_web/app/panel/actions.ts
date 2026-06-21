// TODO: Logic for this file should go in lib
"use server";

import { getUnitStatus, loadMonitorRecords, tailLatest, UnitStatus, UnitType, unitAction as libUnitAction } from "@/lib/panelUtils";
import { loadGraphDataAction } from "./graphs/actions";

/**
 * The js representation of a systemd unit.
 */
export type Unit = {
    name: string,  // E.g. "g_mc"
    type: UnitType,  // E.g. "service" or "timer"
    controllable: boolean,  // Should the user be able to start or stop this from the dashboard?
    expectActive: boolean  // Is normal behavior that this is running? E.g. g_mc.service being stopped is abnormal, but g_nightly_restart.service we don't expect to be running all the time
}
/** A utility function to create a {@link Unit}. */
const _mkUnit = (name: string, type: UnitType, controllable: boolean, expectActive: boolean): Unit => ({ name, type, controllable, expectActive });

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
]; // TODO: DOn't hardcode these

/**
 * Gets the status of the units specified in {@link TRACKED_UNITS}.
 */ 
async function getUnitsStatuses() {
    return await Promise.all(TRACKED_UNITS.map(async unit => ({
        unit,
        status: await getUnitStatus(unit.name, unit.type)
    })));
}



export type PanelData = {
    unitsStatuses: {
        unit: Unit,
        status: UnitStatus | undefined
    }[],
    graphData: Awaited<ReturnType<typeof loadMonitorRecords>>,  
    timestamp: number  // The time that this record was created, in ms since the epoch
}

/**
 * Get the data used on the main panel page.
 * This method should be fast enough that it can be used on the inital server-side render of the page.
 */
export async function loadPanelDataAction(): Promise<PanelData> {
    return {
        unitsStatuses: await getUnitsStatuses(),
        graphData: await loadGraphDataAction(),  // TODO: This could be improved
        timestamp: Date.now()
    };
}

/**
 * Start, stop or restart a unit.
 */
export async function unitAction(unit: Unit, status: "start"|"stop"|"restart") {  // TODO: IMplement this
    console.log(`UnitAction: ${status}ing ${unit.name}.${unit.type}`);

    // Ensure that is a unit that we track:
    if (TRACKED_UNITS.filter(tu => tu.name === unit.name && tu.type === unit.type).length === 0) throw "This unit is not in TRACKED_UNITS";

    await libUnitAction(unit.name, unit.type, status);
}

/**
 * Returns the last ten lines from latest.log
 */
export async function tailLatestAction() {
    return tailLatest(50);
}
