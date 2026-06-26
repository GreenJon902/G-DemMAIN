import { patchConsole } from "@g/com/lib/logUtils";

export async function register() {
    patchConsole();

    // Preconnect to the database so we know it's working without any testing required, and so we don't need to wait for a connection later
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { default: prisma } = await import("@g/com/lib/prisma");
        try {
            console.log("Attempting to initiate primsa...")
            prisma();
            console.log("Prisma initiation succeeded")
        } catch (e) {
            console.error("Failed to initate prisma error:", e);
            process.exit(1);
        }
    }
}
