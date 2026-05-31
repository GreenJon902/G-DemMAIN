import { inspect } from "util";

/**
 * Prints the given data compactly.
 * @param message - Optional message to print before the object.
 * @param obj - The object to print, this will go on one line.
 * @param stream - An function like console.log/console.error.
 */
export function compactOutput({
    message,
    obj,
    stream = console.log
}: {
    message?: string
    obj: any,
    stream?: (...stuff: Array<any>) => void
}) {
    const inspected = inspect(obj, { depth: null, compact: true, breakLength: Infinity })
        .replaceAll(/\s*\n\s*/g, "");  // Remove newlines (and starting whitespace)

    stream(message, inspected);
}

/**
 * Override console.(log,error,warn) to prepend the log level beforehand.
 */ 
export function patchConsole() {
    console.log("Patching log functions...");  
    const oldLog = console.log;
    const oldWarn = console.warn;
    const oldError = console.error;
    console.log = (...args: Array<any>) => oldLog("INFO:", ...args);
    console.warn = (...args: Array<any>) => oldWarn("WARN:", ...args);
    console.error = (...args: Array<any>) => oldError("ERRO:", ...args);
}
