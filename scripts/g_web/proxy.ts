/**
 * We use a proxy to check if users are allowed to access given pages.
 * This performs optimistic checks only.
 */

import { NextRequest, NextResponse } from "next/server"
import { optimisticCheckUser } from "./lib/auth";


// The checks for whether a user is allowed to access each route
// Routes are matched if they start with the given path
const routeChecks: Array<[string, () => Promise<boolean>]> = [
    ["/panel", async () => await optimisticCheckUser("panel")]
];

export default async function proxy(req: NextRequest) {

    // Check if user is authorised to view route
    const path = req.nextUrl.pathname;
    for (let i=0; i<routeChecks.length; i++) {
        if (path.startsWith(routeChecks[i][0]) && await routeChecks[i][1]() !== true) {
            const redirect = new URL("/login", req.nextUrl);
            redirect.searchParams.append("next", req.nextUrl.pathname);
            return NextResponse.redirect(redirect);
        }
    }

    return NextResponse.next();
}

// Routes Proxy should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico$).*)'],
}
