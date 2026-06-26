"use server";

import { listMonitorOptions, loadMonitorRecords, MonitorOption } from "@g/com/lib/panelUtils";

/**
 * Loads the monitor options list, and records for the record specified in the GRAPH_MONITOR_OPTION_COOKIE. If this is not set then this will take the minimum interval.
 */
export async function loadGraphDataAction(monopt?: MonitorOption | undefined) {
    const monitorOptions = await listMonitorOptions();
    
    // Validate that monopt is a valid option
    // Compare strings as object comparison doesn't work
    if (!monitorOptions.map(mo => `${mo.interval}_${mo.number}`).includes(`${monopt?.interval}_${monopt?.number}`)) {
        monopt = undefined;
    }

    // Choose a default value if there is no current value
    const currentMonitorOption = monopt ??
        // Get min (in respect ot interval) of listed monitor options. If no minimum exists (options.length === 0) then skill issue ig, we can crash ;)
        monitorOptions.sort((a, b) => a.interval - b.interval)[0];

    return {
        currentOption: currentMonitorOption,
        options: monitorOptions,
        ...await loadMonitorRecords(currentMonitorOption.interval, currentMonitorOption.number)
    };
}
