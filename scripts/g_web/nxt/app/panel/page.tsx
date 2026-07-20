import type { Metadata } from "next";
import { loadPanelDataAction } from "./actions";
import PanelPageContent from "./PanelPageContent";
import RefreshingPage from "../ui/RefreshingPage";

export const metadata: Metadata = { title: "Panel" };

export default async function Page() {
    return (
        <RefreshingPage
            loadNewDataAction={loadPanelDataAction}
            refreshRate={6000}
            Component={PanelPageContent}
        />
    );
}


