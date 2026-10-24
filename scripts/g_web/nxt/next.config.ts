import type { NextConfig } from "next";
import * as os from "os";
import * as path from "path";

// Find local ip address for use in dev-origins
const env = process.env.NODE_ENV;
const allowedDevOrigins: string[] = [];
if (env == "development") {
    const networkInterfaces = os.networkInterfaces();
    Object.values(networkInterfaces).filter(v => v !== undefined).forEach(v => v.forEach(w => allowedDevOrigins.push(w.address)));
    console.log("Detected in development mode, allowing dev origins", allowedDevOrigins);
}



const nextConfig: NextConfig = {
    reactCompiler: true,
    images: {
        remotePatterns: [new URL("https://api.mcheads.org/head/**/256/hat"), new URL("https://api.mcheads.org/skin/**")]
    },
    allowedDevOrigins: allowedDevOrigins,
    turbopack: {
        root: path.join(import.meta.dirname, "..")  // The app is installed in the home directory of g_web, which NextJS blocks bydefault, so we need to explictly tell it this
    },
    experimental: {
        authInterrupts: true,  // Allow forbidden() and unauthorised()
        externalDir: true /* Folder organisation stuff */
    }
};

export default nextConfig;
