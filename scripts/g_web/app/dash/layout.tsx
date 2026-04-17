import "@/app/globals.css";

export default function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    return (
        <html>
            <body>
                <main className="h-dvh bg-gray-900 p-4 text-white">
                    {children}
                </main>
            </body>
        </html>
    );
}
