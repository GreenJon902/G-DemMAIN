import { loadLogContent } from "@/lib/panelUtils";
import { notFound } from "next/navigation";
import PageSection from "../../../ui/PageSection";
import Link from "next/link";
import { AutoLabelSinceLastRefresh } from "@/app/ui/LabelSinceLastRefresh";
import LogView from "../../ui/LogView";

export default async function Page({
    params
}: {
    params: Promise<{ logFile: string }>
}) {
    const { logFile } = await params;
    const logContents = await loadLogContent(logFile);

    // If log is not found then go to 404 page
    if (logContents === undefined) notFound();  

    return (
        <>
            <Link 
                href="/panel/mcLogs" 
                className="mb-2 block text-gray-300 underline decoration-gray-500 decoration-dotted"
            >
                Return to log list...
            </Link>
            <PageSection title={logFile}>
                <LogView 
                    lines={logContents.split("\n")} 
                    className="min-w-150"
                />
            </PageSection>
            <AutoLabelSinceLastRefresh />
        </>
    );
}
