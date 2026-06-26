import { defineConfig } from "prisma/config";

const { G_WEB_DATABASE_USER, G_WEB_DATABASE_PASSWORD, G_WEB_DATABASE_HOST, G_WEB_DATABASE_PORT } = process.env;

let datasourceUrl: string | undefined;
if (!G_WEB_DATABASE_USER || !G_WEB_DATABASE_PASSWORD || !G_WEB_DATABASE_HOST || !G_WEB_DATABASE_PORT) {
    console.log("At least one of the G_WEB_DATABASE_* environment variables is unset. Omitting datasource url from config!");
} else {
    const encoded_G_WEB_DATABASE_USER = encodeURIComponent(G_WEB_DATABASE_USER);
    const encoded_G_WEB_DATABASE_PASSWORD = encodeURIComponent(G_WEB_DATABASE_PASSWORD);

    datasourceUrl = `mysql://${encoded_G_WEB_DATABASE_USER}:${encoded_G_WEB_DATABASE_PASSWORD}@${G_WEB_DATABASE_HOST}:${G_WEB_DATABASE_PORT}/g_web`;
    console.log(`Datasource url is 'mysql://${encoded_G_WEB_DATABASE_USER}:****@${G_WEB_DATABASE_HOST}:${G_WEB_DATABASE_PORT}/g_web'`);
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url: datasourceUrl
    }
});
