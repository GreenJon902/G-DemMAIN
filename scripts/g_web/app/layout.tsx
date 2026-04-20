import "@/app/globals.css";

export default function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    return (
        <html>
            <body className="bg-gray-900 text-white">
                {children}
            </body>
        </html>
    );
}
