import "@/app/globals.css";
import GlobalNav from "./ui/GlobalNav";

export const dynamic = "force-dynamic";  // TODO: Find a better fix this

export default async function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    return (
        <html>
            <head>
                <link rel="icon" type="image/png" href="favicon.png" />
            </head>
            <body className="bg-gray-900 text-white flex min-h-dvh flex-col">
                <header><nav> <GlobalNav /> </nav></header>
                {children}
            </body>
        </html>
    );
}
