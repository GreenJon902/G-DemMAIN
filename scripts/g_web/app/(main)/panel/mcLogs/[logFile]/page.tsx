import { loadLogContent } from "@/lib/mcLogs";
import { notFound } from "next/navigation";
import PanelPageSection from "../../ui/PanelPageSection";
import Link from "next/link";

export default async function Page({
    params
}: {
    params: Promise<{ logFile: string }>
}) {
    const { logFile } = await params;
    const logContents = await loadLogContent(logFile);

    // If log is not found then go to 404 page
    if (logContents === undefined) notFound();  // TODO: This doesn't use the correct not found page

    return (
        <>
            <Link 
                href="/panel/mcLogs" 
                className="mb-2 block text-gray-300 underline decoration-gray-500 decoration-dotted"
            >
                Return to log list...
            </Link>
            <PanelPageSection title={logFile}>
                <div className="min-w-150 rounded-md bg-gray-950 p-1">
                    <pre className="text-wrap break-all">
                        {logContents.split("\n").map((line, i, a) => (
                            <span 
                                key={i}
                                className="block"
                            >
                                <span className="text-gray-700">
                                    {String(i).padStart(String(a.length).length)}.
                                </span>
                                {line}
                            </span>
                        ))}
                    </pre>
                </div>
            </PanelPageSection>
        </>
    );
}
