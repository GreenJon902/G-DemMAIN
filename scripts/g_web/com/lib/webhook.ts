/**
 * This is a wrapper for the python webhooks utility.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import { C } from "./environ";

const WEBHOOKS_FILE = "/opt/infra/scripts/webhooks.py";  // Path to the webhooks python file

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
 * Send a notification that a new HisDoc event was added.
 * Note this will not wait for the webhook to finish.
 * @param eventName - The name of the newly added event.
 * @param authorUsername - The g_web username of the user who added it.
 */
export function sendHisDocEventAddedWebhook(eventName: string, authorUsername: string) {
    executeCommand("hisdoc_event_added", eventName, authorUsername);
}

/**
 * Send a notification that an existing HisDoc event was edited.
 * Note this will not wait for the webhook to finish.
 * @param eventName - The name of the edited event.
 * @param authorUsername - The g_web username of the user who made the edit.
 * @param changelogNote - The human-written summary of what changed.
 */
export function sendHisDocEventEditedWebhook(eventName: string, authorUsername: string, changelogNote: string) {
    executeCommand("hisdoc_event_edited", eventName, authorUsername, changelogNote);
}

/**
 * Actually execute the webhook and pipe output to console.
 * Note this will not wait for the webhook to finish.
 */
function executeCommand(...args: Array<string>) {
    if (!C().DONT_REQUIRE_WEBHOOKS_FILE && !existsSync(WEBHOOKS_FILE)) throw new Error("Webhooks file does not exist");  // Ensure that it exists
    const proc = spawn("python3", [WEBHOOKS_FILE, ...args]);

    proc.stdout.on("data", (data) => console.log(`WEBHOOKS-STDOUT: ${data}`));
    proc.stderr.on("data", (data) => console.error(`WEBHOOKS-STDERR: ${data}`));
    proc.on("close", (code) => console.log(`Webhook file exited with code ${code}`));
}
