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
 * Actually execute the webhook and pipe output to console.
 * Note this will not wait for the webhook to finish.
 */
function executeCommand(...args: Array<string>) {
    if (!C().DONT_REQUIRE_WEBHOOKS_FILE && !existsSync(WEBHOOKS_FILE)) throw "Webhooks file does not exist";  // Ensure that it exists
    const proc = spawn("python3", [WEBHOOKS_FILE, ...args]);

    proc.stdout.on("data", (data) => console.log(`WEBHOOKS-STDOUT: ${data}`));
    proc.stderr.on("data", (data) => console.error(`WEBHOOKS-STDERR: ${data}`));
    proc.on("close", (code) => console.log(`Webhook file exited with code ${code}`));
}
