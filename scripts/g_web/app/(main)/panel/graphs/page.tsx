import { loadGraphDataAction } from "./actions";
import RefreshingPage from "../../ui/RefreshingPage";
import GraphsPageContent from "./GraphsPageContent";

export default async function Page() {
    return (
        <RefreshingPage
            loadNewDataAction={loadGraphDataAction}
            refreshRate={6000}
            Component={GraphsPageContent}
        />
    );
}

