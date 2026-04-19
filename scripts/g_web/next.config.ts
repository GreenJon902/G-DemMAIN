import type { NextConfig } from "next";
import * as os from "os";

// Find local ip address for use in dev-origins
const env = process.env.NODE_ENV;
const allowedDevOrigins: string[] = [];
if (env == "development") {
    const networkInterfaces = os.networkInterfaces();
    Object.values(networkInterfaces).filter(v => v !== undefined).forEach(v => v.forEach(w => allowedDevOrigins.push(w.address)));
    console.log("Detected in development mode, allowing dev origins", allowedDevOrigins);
}



const nextConfig: NextConfig = {
    /* config options here */
    reactCompiler: true,
    images: {
        remotePatterns: [new URL("https://api.mcheads.org/head/**/256/hat")]
    },
    allowedDevOrigins: allowedDevOrigins
};

export default nextConfig;
