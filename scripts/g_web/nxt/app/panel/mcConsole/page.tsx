import "server-only";
import type { Metadata } from "next";
import { C } from "@g/com/lib/environ";
import Console from "./Console";
import PageSection from "../../ui/PageSection";
import TextLink, { TEXT_LINK_GRAY } from "../../ui/TextLink";

export const metadata: Metadata = { title: "Console | Panel" };

export default function Page() {
    return (
        <PageSection title="Console">
            <Console mccwss_port={C().MCCWSS_PORT} />
            <TextLink
                href="/panel/mcLogs/latest.log"
                color={TEXT_LINK_GRAY}
                className="mt-2 block"
                target="_blank"
            >
                View latest.log
            </TextLink>
        </PageSection>
    );
}
