"use server";

import { loadMonitorRecords } from "@/lib/panelUtils";

export async function loadGraphDataAction() {
    return await loadMonitorRecords(5, 20);  // TODO: Don't hardcode the parameterss
}
