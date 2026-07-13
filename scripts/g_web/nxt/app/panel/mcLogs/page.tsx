import { listLogs } from "@/lib/panelUtils";
import PageSection from "../../ui/PageSection";
import { AutoLabelSinceLastRefresh } from "../../ui/LabelSinceLastRefresh";
import TextLink, { TEXT_LINK_WHITE } from "@/app/ui/TextLink";

export default async function Page() {
    const logNames = await listLogs();

    return (
        <>
            <PageSection title="Minecraft Logs">
                {
                    logNames.sort().reverse().map(name => (  // Latest.log should always be first after this
                        <TextLink
                            key={name}
                            href={`/panel/mcLogs/${name}`}
                            color={TEXT_LINK_WHITE}
                            prefetch={false}  // Disable prefetching so we don't load all the logs at once nooooooo
                            className="block px-2 first:rounded-t-md last:rounded-b-md odd:bg-gray-700 even:bg-gray-800"
                            target="_blank"  // Open in new tab
                        >
                            {name}
                        </TextLink>
                    ))
                }
            </PageSection>
            <AutoLabelSinceLastRefresh />
        </>
    );
}
