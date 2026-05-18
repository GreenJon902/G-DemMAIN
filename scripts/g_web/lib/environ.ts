/**
 * This file loads the config values from the environment. 
 * We need to load them during runtime as nextjs is stupid and messes up otherwise.
 * All variables should be documented in /environ/common or /environ/...g_web....
 */

import zod from "zod";

let cached: ReturnType<typeof generate> | null = null;

const port = zod.string().regex(/^\d+$/).transform(Number).pipe(zod.number().int().min(0).max(65535));

const generate = () => {
    const MCCWSS_PORT = port.parse(process.env.MCCWSS_PORT);

    const SESSION_PASSWORD = zod.string().trim().min(32).parse(process.env.SESSION_PASSWORD);
    const PANEL_USER = zod.string().trim().parse(process.env.PANEL_USER).split(",");
    const PANEL_PASSWORD = zod.array(zod.string()).length(PANEL_USER.length).parse(zod.string().trim().parse(process.env.PANEL_PASSWORD).split(","));

    const MINECRAFT_LOG_PATH = zod.string().trim().parse(process.env.MINECRAFT_LOG_PATH);

    const MINECRAFT_MS_PORT = port.parse(process.env.MINECRAFT_MS_PORT);
    const MINECRAFT_MS_SECRET = zod.string().trim().min(40).parse(process.env.MINECRAFT_MS_SECRET);

    return {
        MCCWSS_PORT, SESSION_PASSWORD, PANEL_USER, PANEL_PASSWORD, MINECRAFT_LOG_PATH, MINECRAFT_MS_PORT, MINECRAFT_MS_SECRET
    };
};


export default function C() {
    cached = cached ?? generate();
    return cached;
}
