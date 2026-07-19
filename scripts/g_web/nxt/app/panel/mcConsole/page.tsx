import "server-only";
import type { Metadata } from "next";
import { C } from "@g/com/lib/environ";
import Console from "./Console";
import PageSection from "../../ui/PageSection";
import RefreshingPage from "../../ui/RefreshingPage";
import LogDisplay from "./LogDisplay";
import { tailLatestAction } from "../actions";

// TODO: Update how permissions are managed. Viewer can see live console, admin can view and send commands

export const metadata: Metadata = { title: "Console | Panel" };

export default function Page() {
    return (
        <>
            <PageSection title="Console">
                <Console mccwss_port={C().MCCWSS_PORT} />
            </PageSection>
            <PageSection title="Log">
                <RefreshingPage
                    Component={LogDisplay}
                    refreshRate={3000}
                    loadNewDataAction={tailLatestAction}
                />
            </PageSection>
        </>
    );
}
