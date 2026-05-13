import { loadPanelDataAction } from "../actions";
import RefreshingPage from "../ui/RefreshingPage";
import GraphsPageContent from "./GraphsPageContent";

export default async function Page() {
    return (
        <RefreshingPage
            loadNewDataAction={loadPanelDataAction}
            refreshRate={6000}
            Component={GraphsPageContent}
        />
    );
}

