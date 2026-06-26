import { patchConsole } from "@g/com/lib/logUtils";

export async function register() {
    patchConsole();

    // Preconnect to the database (which also checks the database schema) so we know it's working without any testing required
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { default: prisma } = await import("@g/com/lib/prisma");
        prisma();
    }
}
