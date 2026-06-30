import "@/app/globals.css";
import GlobalNav from "./GlobalNav";
import { AuthContextProvider } from "./AuthContext";
import { ConfirmContextProvider } from "./ConfirmContext";
import { NS } from "@/lib/session";

export const dynamic = "force-dynamic";  // TODO: Find a better fix this

export default async function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    const isLoggedIn = await NS.hasSession();
    const { sudoVerifiedAt, tfaEnabled } = isLoggedIn
        ? await NS.getSudoActiveStatus()
        : { sudoVerifiedAt: null, tfaEnabled: false };

    return (
        <html>
            <head>
            </head>
            <body className="flex min-h-dvh flex-col bg-gray-900 text-white">
                <AuthContextProvider
                    initialIsLoggedIn={isLoggedIn}
                    initialSudoVerifiedAt={sudoVerifiedAt}
                    initialTfaEnabled={tfaEnabled}
                >
                    <ConfirmContextProvider>
                        <header><nav> <GlobalNav /> </nav></header>
                        {children}
                    </ConfirmContextProvider>
                </AuthContextProvider>
            </body>
        </html>
    );
}
