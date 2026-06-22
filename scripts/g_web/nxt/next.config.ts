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
        remotePatterns: [new URL("https://api.mcheads.org/head/**/256/hat")]
    },
    allowedDevOrigins: allowedDevOrigins,
    output: "standalone",
    experimental: {
        authInterrupts: true,  // Allow forbidden() and unauthorised()
        externalDir: true /* Folder organisation stuff */
    },
    turbopack: { /* Folder organisation stuff */
        resolveAlias: {
            "@/lib": path.resolve(__dirname, "../com/lib")
        }
    }
};

export default nextConfig;
