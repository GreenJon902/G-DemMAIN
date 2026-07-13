import { loadLogContent } from "@/lib/panelUtils";
import { notFound } from "next/navigation";
import PageSection from "../../../ui/PageSection";
import TextLink, { TEXT_LINK_GRAY } from "../../../ui/TextLink";
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
            <TextLink
                href="/panel/mcLogs"
                color={TEXT_LINK_GRAY}
                className="mb-2 block"
            >
                Return to log list...
            </TextLink>
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
