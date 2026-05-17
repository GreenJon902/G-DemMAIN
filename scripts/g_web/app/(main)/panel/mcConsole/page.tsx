import { C } from "@/lib/environ";
import ClientConsole from "./ClientPage";

export default function Page() {
    return <ClientConsole mccwss_port={C().MCCWSS_PORT} />;
}
