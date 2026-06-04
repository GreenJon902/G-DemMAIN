"use server";

import { loadMonitorRecords } from "@/lib/panelUtils";

export async function loadGraphDataAction() {
    return await loadMonitorRecords(2, 50);
}
