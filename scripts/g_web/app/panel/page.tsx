import { loadPanelDataAction } from "./actions";
import ActualPage from "./ActualPage";


export default async function Page() {
    const initialData = await loadPanelDataAction();
    return <ActualPage initialData={initialData} />;
}


