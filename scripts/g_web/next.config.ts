import type { NextConfig } from "next";

// Find local ip address for use in dev-origins
var os = require('os');
var networkInterfaces = os.networkInterfaces();
const allowedDevOrigins = [];
Object.values(networkInterfaces).forEach(v => v.forEach(w => allowedDevOrigins.push(w.address)));
console.log("Allowing dev origins", allowedDevOrigins);


const nextConfig: NextConfig = {
    /* config options here */
    reactCompiler: true,
    images: {
        remotePatterns: [new URL("https://api.mcheads.org/head/**/256/hat")]
    },
    allowedDevOrigins: allowedDevOrigins
};

export default nextConfig;
