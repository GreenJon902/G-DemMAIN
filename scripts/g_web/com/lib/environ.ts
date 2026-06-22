/**
 * This file loads the config values from the environment. 
 * We need to load them during runtime as nextjs is stupid and messes up otherwise.
 */

// TODO: Don't load all of these all the time?

import zod from "zod";

let cached: ReturnType<typeof generate> | null = null;

const generate = () => {
    const zPort = zod.string().regex(/^\d+$/).transform(Number).pipe(zod.number().int().min(0).max(65535));

    const MCCWSS_PORT = zPort.parse(process.env.MCCWSS_PORT);
    const SESSION_PASSWORD = zod.string().trim().min(32).parse(process.env.SESSION_PASSWORD);
    const PANEL_USER = zod.string().trim().parse(process.env.PANEL_USER).split(",");
    const PANEL_PASSWORD = zod.array(zod.string()).length(PANEL_USER.length).parse(zod.string().trim().parse(process.env.PANEL_PASSWORD).split(","));

    const DONT_REQUIRE_WEBHOOKS_FILE = zod.coerce.boolean().default(false).parse(process.env.DONT_REQUIRE_WEBHOOKS_FILE);

    const LIST_FOLDER = zod.string().default("/var/lib/g_mc").parse(process.env.LIST_FOLDER);  // For testing we can override this. This folder contains whitelist.json and ...
    const MC_LOG_FOLDER = zod.string().default("/var/lib/g_mc/logs").parse(process.env.MC_LOG_FOLDER);  // For testing we can override this 

    const MINECRAFT_RCON_PORT = zPort.parse(process.env.MINECRAFT_RCON_PORT);
    const MINECRAFT_RCON_PASSWORD = zod.string().parse(process.env.MINECRAFT_RCON_PASSWORD);

    return {
        MCCWSS_PORT, SESSION_PASSWORD, PANEL_USER, PANEL_PASSWORD, DONT_REQUIRE_WEBHOOKS_FILE, LIST_FOLDER, MC_LOG_FOLDER, MINECRAFT_RCON_PORT, MINECRAFT_RCON_PASSWORD
    };
};


export function C() {
    cached = cached ?? generate();
    return cached;
}
