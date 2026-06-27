import "@/app/globals.css";
import GlobalNav from "./ui/GlobalNav";
import { SudoModalProvider } from "./ui/SudoModal";

export const dynamic = "force-dynamic";  // TODO: Find a better fix this

export default async function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    return (
        <html>
            <head>
            </head>
            <body className="flex min-h-dvh flex-col bg-gray-900 text-white">
                <header><nav> <GlobalNav /> </nav></header>
                <SudoModalProvider>
                    {children}
                </SudoModalProvider>
            </body>
        </html>
    );
}
