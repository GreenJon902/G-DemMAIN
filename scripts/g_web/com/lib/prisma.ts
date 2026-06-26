import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import C from "./environ";

/**
 * Creates a new prisma adapter and client. Returns the client.
 */
function createPrismaClient() {
    // Create connection to the database
    const adapter = new PrismaMariaDb({
        user: C().G_WEB_DATABASE_USER,
        password: C().G_WEB_DATABASE_PASSWORD,
        host: C().G_WEB_DATABASE_HOST,
        port: C().G_WEB_DATABASE_PORT,
        database: "g_web",
        connectionLimit: 5
    });
    const prisma = new PrismaClient({ adapter });

    return prisma;
}


let _prisma: PrismaClient;
/**
 * Gets an instance of the PrismaClient connection to the database.
 */
export default function prisma() {
    // Create new instance if not cached
    if (_prisma === undefined) {
        _prisma = createPrismaClient();
    }

    // Return cached instance
    return _prisma;
};

