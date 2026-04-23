"use server";

/**
 * The status of a systemd unit.
 * Note: there are technically more, but I don't think they'll come up.
 */
export type Status = typeof STATUS_VALUES[number];
const STATUS_VALUES = ["active", "inactive", "failed", "activating", "deactivating"] as const;

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

/**
 * The names of the data that we can graph on the main panel page.
 */
export type GraphKey = typeof GRAPH_KEYS[number];
const GRAPH_KEYS = [
    // Minecraft specific data
    "mc.tps",  // Minecraft server TPS, [0,1], 0 is 0TPS and 1 is 20TPS 
    "mc.mem",  // Percentage of the java heap used, [0,1] // TODO: Implement this, probably with jcmd?

    // Data reported for the entire CGroup for that service
    "g_mc.cpu",  // Percentage of system cpu that this service uses, [0,1]
    "g_mc.mem",  // Percentage of system memory that this service uses, [0,1)  
    "g_web.cpu",
    "g_web.mem",
    "mysql.cpu",
    "mysql.mem",

    // Data for the whole system
    "sys.cpu",  // Percentage of total cpu usage, [0,1]
    "sys.cpu1",  // Percentage for individual system cpu used, [0,1]
    "sys.cpu2",
    "sys.cpu3",
    "sys.cpu4",
    "sys.mem"  // Percentage of system memory used
] as const;

/**
 * The data to plot on the graphs on the main page.
 */
export type GraphData = Record<GraphKey, number[]>;

/**
 * Gets the status of the units specified in {@link TRACKED_UNITS}.
 */ 
async function getGraphData(): Promise<GraphData> {
    // TODO: Get actual data for this, and have it use the same time-span as the client.
    // For now just use this array

    if (_graphData === undefined) {
        // Populate initial array
        _graphData = Object.fromEntries(GRAPH_KEYS.map(key => [key, new Array(30).fill(0.5)])) as GraphData;
    } else {
        // Shift all values down and add a new one
        Object.values(_graphData).forEach(data => {
            data.push(Math.max(0, Math.min(1, (data.shift() ?? -1) + (Math.random() * 2 - 1) ** 17)));
        });
    }

    return _graphData;
}
let _graphData: GraphData;

export type PanelData = {
    unitsStatuses: {
        unit: Unit,
        status: Status
    }[],
    graphData: GraphData,
    timestamp: number  // The time that this record was created, in ms since the epoch
}

/**
 * Get the data used on the main panel page.
 * This method should be fast enough that it can be used on the inital server-side render of the page.
 */
export async function loadPanelDataAction(): Promise<PanelData> {
    return {
        unitsStatuses: await getUnitsStatuses(),
        graphData: await getGraphData(),
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
