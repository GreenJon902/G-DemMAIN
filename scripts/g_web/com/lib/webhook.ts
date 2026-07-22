/**
 * This is a wrapper for the python webhooks utility.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";

const WEBHOOKS_FILE = `${process.env.G_DEMMAIN_ROOT}/scripts/webhooks.py`;

/**
 * Send a notifation that the given user has logged into the website.
 * Note this will not wait for the webhook to finish.
 */
export function sendWebloginWebhook(name: string) {
    executeCommand("weblogin", name);
}

/**
 * Send a notifation that the given user has exectued a given command.
 * The given command should not have the prefix (/).
 * Note this will not wait for the webhook to finish.
 */
export function sendWebcommandWebhook(name: string, command: string) {
    executeCommand("webcommand", name, command);
}

/**
 * Send a notification that a HisDoc entity was added, edited or deleted.
 * Note this will not wait for the webhook to finish.
 * @param entityType - Which kind of hisdoc entity was changed.
 * @param action - What was done to it.
 * @param entityId - The entity's database id.
 * @param entityName - Human-readable name for the entity (event/tag name, person display name).
 * @param actorId - The database id of the g_web user who made the change.
 * @param actorUsername - The g_web username of the user who made the change.
 * @param changelogNote - The changelog message for this change (typed note for edits/deletes, the
 *   auto-generated message for adds).
 */
export function sendHisDocWebhook(
    entityType: "event" | "person" | "tag",
    action: "add" | "edit" | "delete",
    entityId: number,
    entityName: string,
    actorId: number,
    actorUsername: string,
    changelogNote: string
) {
    executeCommand("hisdoc", entityType, action, String(entityId), entityName, String(actorId), actorUsername, changelogNote);
}

/**
 * Actually execute the webhook and pipe output to console.
 * Note this will not wait for the webhook to finish.
 */
function executeCommand(...args: Array<string>) {
    if (!existsSync(WEBHOOKS_FILE)) throw new Error("Webhooks file does not exist");  // Ensure that it exists
    const proc = spawn(`${process.env.G_DEMMAIN_ROOT}/.venv/bin/python3`, [WEBHOOKS_FILE, ...args]);

    proc.stdout.on("data", (data) => console.log(`WEBHOOKS-STDOUT: ${data}`));
    proc.stderr.on("data", (data) => console.error(`WEBHOOKS-STDERR: ${data}`));
    proc.on("close", (code) => console.log(`Webhook file exited with code ${code}`));
}
