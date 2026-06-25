import { PrismaClient } from "@/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import C from "./environ";
import { spawnSync } from "child_process";
import path from "path";
/**
 * Creates a new prisma adapter and client. Returns the client.
 * It also checks that the mariadb database schema is the same as the prisma database schema.
 */
function createPrismaClient() {
    // Check that database-schema and prisma-schema are the same
    console.log("Checking database synchronisation...");
    const result = spawnSync("npx", ["prisma", "migrate", "diff", "--from-schema", "prisma/schema.prisma", "--to-config-datasource", "--exit-code"], {
        stdio: "inherit",
        cwd: path.dirname(process.cwd()) // Put in the g_web folder, this has the prisma config
    });
    if (result.status === 0) {
        console.log("MariaDB and Prisma agree!");
    }
    else if (result.status === 1) {
        throw "An error occured, npx returned exit status 1";
    }
    else if (result.status === 2) {
        throw "MariaDB and Prisma do not agree! Npx returned exit statue 2";
    }
    else {
        console.warn("Unknown exit status from npx, " + result.status);
    }
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
let _prisma;
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
}
;
