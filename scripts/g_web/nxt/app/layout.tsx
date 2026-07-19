import "@/app/globals.css";
import GlobalNav from "./GlobalNav";
import { AuthContextProvider } from "./AuthContext";
import { ConfirmContextProvider } from "./ConfirmContext";
import { ErrorContextProvider } from "./ErrorContext";
import { NS } from "@/lib/session";
import TextLink, { TEXT_LINK_GRAY } from "./ui/TextLink";
import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";  // TODO: Find a better fix this

// Site-wide title template — pages set their own short title and get "| G-Dem SMP" appended.
// HisDoc/Panel override this with their own template for everything under their own layout.
export const metadata: Metadata = {
    title: {
        template: "%s | G-Dem SMP",
        default: "G-Dem SMP"
    }
};

// Without this, iOS Safari lays the page out at a fixed ~980px width and never matches
// Tailwind's mobile breakpoints, so responsive (e.g. md:) classes never trigger there
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1
};

export default async function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    const [isLoggedIn, initialPermissions] = await Promise.all([NS.hasSession(), NS.getOptimisticPermissions()]);
    const { sudoVerifiedAt, tfaEnabled } = isLoggedIn
        ? await NS.getSudoActiveStatus()
        : { sudoVerifiedAt: null, tfaEnabled: false };

    return (
        <html>
            <body className="flex min-h-screen flex-col bg-gray-900 text-white">
                <AuthContextProvider
                    initialIsLoggedIn={isLoggedIn}
                    initialSudoVerifiedAt={sudoVerifiedAt}
                    initialTfaEnabled={tfaEnabled}
                    initialPermissions={initialPermissions}
                >
                    <ErrorContextProvider>
                        <ConfirmContextProvider>
                            <header><nav> <GlobalNav /> </nav></header>
                            {/* Grows to absorb any leftover space in body's min-h-screen column, so
                                footer always sits at the true bottom of the viewport on short pages
                                instead of leaving a gap below it, while still flowing normally below
                                taller content. Also a flex column itself (not just a flex item), so a
                                child that fills available height (e.g. AbstractErrorPage's flex-1
                                background) has an actual flex container to grow inside */}
                            <div className="flex flex-1 flex-col">{children}</div>
                            <footer className="bottom-0 h-fit w-full bg-gray-950 p-2 text-gray-500">
                                <ul>
                                    <li>
                                        Website built by <TextLink color={TEXT_LINK_GRAY} href="https://github.com/GreenJon902">GreenJon902</TextLink> for the G-Dem SMP.
                                    </li>
                                    <li>
                                        Playerheads and skins supplied from <TextLink color={TEXT_LINK_GRAY} href="https://github.com/thejacedev/McHeads-API">mcheads.org</TextLink>.
                                    </li>
                                </ul>
                            </footer>
                        </ConfirmContextProvider>
                    </ErrorContextProvider>
                </AuthContextProvider>
            </body>
        </html>
    );
}
