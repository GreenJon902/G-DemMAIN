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
