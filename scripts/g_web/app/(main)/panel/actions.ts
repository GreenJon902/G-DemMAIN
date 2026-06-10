// TODO: Logic for this file should go in lib
"use server";

import { getUnitStatus, loadMonitorRecords, tailLatest, UnitStatus, UnitType } from "@/lib/panelUtils";
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

/**
 * A group of graph data pieces that are all about the same service/thing.
 */
export type GraphDataGroup = {
    cpu: number[],  // Percentage [0,1]
    mem: number[],  // In GB
    network: {
        up: number[],  // In MB/s
        down: number[]  // In MB/s  
    },
    disk: {
        read: number[],  // In MB/s
        write: number[]  // In MB/s
    }
}
/**
 * The data to plot on the graphs on the main page.
 */
type GraphData = {
    sys: GraphDataGroup & {
        cpus: number[][]  // Percentages [0,1] for each cpu individually
    }
    services: {
        [name: string]: GraphDataGroup  // These should only be services in TRACKED_UNITS
    }
    mc: {
        tps: number[],  // In range [0,20]
        mem: number[]  // In GB
    }
    meta: {
        timeSpan: number,  // How long the data spans over. In seconds
        totMem: number,   // The total amount of RAM installed into the computer
        mc: {
            totMem: number  // The total amount of RAM that is allocated to the heap
        }
    }
    
}

/**
 * Gets the status of the units specified in {@link TRACKED_UNITS}.
 */ 
async function getGraphData(): Promise<GraphData> {
    // TODO: Get actual data for this, and have it use the same time-span as the client.
    // For now just use this array
    
    const stuff: object[] = [_graphData];
    while (stuff.length > 0) {
        const obj = stuff.pop() as object;
        Object.entries(obj).forEach(([key, value]) => {
            let max;
            if (key === "meta") {
                return;  // Ignore this
            } else if (key === "mem") {
                max = 8;
            } else if (key === "cpu") {
                max = 1;
            } else if (["up", "down", "read", "write"].includes(key)) {
                max = 100;
            } else if (parseInt(key) + "" === key) {
                max = 1;
            } else if (key === "tps") {
                max = 20;
            } else if (["sys", "network", "disk", "mc", "cpus"].includes(key)) {
                stuff.push(value);
                return;
            } else if (key === "services") {
                Object.values(value as { string: object }).forEach(serv => stuff.push(serv));
                return;
            } else {
                console.log("Skipping", key);
                return;
            }
            value.push(Math.max(0, Math.min(max, value.shift() + max * 0.1 * (Math.random() - 0.5) * 2)));
        });
    }

    return _graphData;
}
const _initGroupData = JSON.stringify({
    cpu: new Array(30).fill(0),
    mem: new Array(30).fill(0),
    network: {
        up: new Array(30).fill(0),
        down: new Array(30).fill(0)
    },
    disk: {
        read: new Array(30).fill(0),
        write: new Array(30).fill(0)
    }
});
const _graphData: GraphData = {
    sys: Object.assign(
        JSON.parse(_initGroupData), // Deep copy object
        { cpus: [new Array(30).fill(0), new Array(30).fill(0), new Array(30).fill(0), new Array(30).fill(0)] }),
    services: {
        g_mc: JSON.parse(_initGroupData),
        g_web: JSON.parse(_initGroupData),
        mysql: JSON.parse(_initGroupData)
    },
    mc: {
        tps: new Array(30).fill(0),
        mem: new Array(30).fill(0)
    },
    meta: {
        timeSpan: 240,
        totMem: 8,
        mc: {
            totMem: 3
        }
    }
};

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
    console.log(`${status}ing ${unit.name}.${unit.type}`);
    await new Promise(r => setTimeout(r, 500));
}

/**
 * Returns the last ten lines from latest.log
 */
export async function tailLatestAction() {
    return tailLatest(50);
}
