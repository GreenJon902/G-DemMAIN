/**
 * This file loads the config values from the environment.
 * We need to load them during runtime as nextjs is stupid and messes up otherwise.
 */
// TODO: Don't load all of these all the time?
import zod from "zod";
let cached = null;
const generate = () => {
    const zPort = zod.string().regex(/^\d+$/).transform(Number).pipe(zod.number().int().min(0).max(65535));
    const zTNe = zod.string().trim().nonempty();
    const MCCWSS_PORT = zPort.parse(process.env.MCCWSS_PORT);
    const SESSION_PASSWORD = zTNe.min(32).parse(process.env.SESSION_PASSWORD);
    const DONT_REQUIRE_WEBHOOKS_FILE = zod.coerce.boolean().default(false).parse(process.env.DONT_REQUIRE_WEBHOOKS_FILE);
    const LIST_FOLDER = zod.string().default("/var/lib/g_mc").parse(process.env.LIST_FOLDER); // For testing we can override this. This folder contains whitelist.json and ...
    const MC_LOG_FOLDER = zod.string().default("/var/lib/g_mc/logs").parse(process.env.MC_LOG_FOLDER); // For testing we can override this 
    const MINECRAFT_RCON_PORT = zPort.parse(process.env.MINECRAFT_RCON_PORT);
    const MINECRAFT_RCON_PASSWORD = zod.string().parse(process.env.MINECRAFT_RCON_PASSWORD);
    const G_WEB_DATABASE_USER = zTNe.parse(process.env.G_WEB_DATABASE_USER);
    const G_WEB_DATABASE_PASSWORD = zTNe.parse(process.env.G_WEB_DATABASE_PASSWORD);
    const G_WEB_DATABASE_HOST = zTNe.parse(process.env.G_WEB_DATABASE_HOST);
    const G_WEB_DATABASE_PORT = zPort.parse(process.env.G_WEB_DATABASE_PORT);
    return {
        MCCWSS_PORT, SESSION_PASSWORD, DONT_REQUIRE_WEBHOOKS_FILE, LIST_FOLDER, MC_LOG_FOLDER, MINECRAFT_RCON_PORT, MINECRAFT_RCON_PASSWORD, G_WEB_DATABASE_USER, G_WEB_DATABASE_PASSWORD, G_WEB_DATABASE_HOST, G_WEB_DATABASE_PORT
    };
};
export function C() {
    cached = cached ?? generate();
    return cached;
}
export default C;
