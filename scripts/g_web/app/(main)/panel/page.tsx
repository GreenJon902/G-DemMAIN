import { loadPanelDataAction } from "./actions";
import PanelPageContent from "./PanelPageContent";
import RefreshingPage from "../ui/RefreshingPage";


export default async function Page() {
    return (
        <RefreshingPage
            loadNewDataAction={loadPanelDataAction}
            refreshRate={6000}
            Component={PanelPageContent}
        />
    );
}


