// TODO: Logic for this file should go in lib
"use server";

import { C, type Unit } from "@g/com/lib/config";
import { getUnitStatus, loadMonitorRecords, UnitStatus, unitAction as libUnitAction } from "@/lib/panelUtils";
import { loadGraphDataAction } from "./graphs/actions";

/**
 * Gets the status of the units specified in g_web/config.json's trackedUnits.
 */
async function getUnitsStatuses() {
    return await Promise.all(C().TRACKED_UNITS.map(async unit => ({
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
    timestamp?: number,  // The time that this record was created, in ms since the epoch. Absent if there are no records yet
    refreshRate: number  // How ofter the (graph) data refreshes
}

/**
 * Get the data used on the main panel page.
 * This method should be fast enough that it can be used on the inital server-side render of the page.
 * The timestamp is taken from the graph data.
 */
export async function loadPanelDataAction(): Promise<PanelData> {
    const [graphData, unitsStatuses] = await Promise.all([
        loadGraphDataAction(),
        getUnitsStatuses()
    ]);
    return {
        unitsStatuses,
        graphData,  // TODO: This could be improved
        timestamp: graphData.timestamp,
        refreshRate: graphData.refreshRate
    };
}

/**
 * Start, stop or restart a unit.
 */
export async function unitAction(unit: Unit, status: "start"|"stop"|"restart") {  // TODO: IMplement this
    console.log(`UnitAction: ${status}ing ${unit.name}.${unit.type}`);

    // Ensure that is a unit that we track:
    if (C().TRACKED_UNITS.filter(tu => tu.name === unit.name && tu.type === unit.type).length === 0) throw new Error("This unit is not in TRACKED_UNITS");

    await libUnitAction(unit.name, unit.type, status);
}
