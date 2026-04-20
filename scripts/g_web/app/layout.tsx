import "@/app/globals.css";

export default function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    return (
        <html>
            <body className="p-4 bg-gray-900 text-white">
                {children}
            </body>
        </html>
    );
}
