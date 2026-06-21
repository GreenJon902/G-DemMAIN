import { C } from "@/lib/environ";
import Console from "./Console";
import PanelPageSection from "../ui/PanelPageSection";
import RefreshingPage from "../../ui/RefreshingPage";
import LogDisplay from "./LogDisplay";
import { tailLatestAction } from "../actions";

export default function Page() {
    return (
        <>
            <PanelPageSection title="Console">
                <Console mccwss_port={C().MCCWSS_PORT} />
            </PanelPageSection>
            <PanelPageSection title="Log">
                <RefreshingPage
                    Component={LogDisplay}
                    refreshRate={3000}
                    loadNewDataAction={tailLatestAction}
                />
            </PanelPageSection>
        </>
    );
}
