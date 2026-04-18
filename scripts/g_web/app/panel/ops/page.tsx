import fs from "fs/promises";
import AccountRow from "./AccountRow";
import AddAccountField from "./AddAccountField";

export type Account = {
    name: string,
    uuid: string  // TODO: Is this right?
}

export default async function Page() {
    const accounts = await loadAccounts();
    return (
        <>
            <h1 className="text-3xl font-bold underline decoration-4">Operators</h1>
            <div className="m-4 space-y-1">
                <div>
                    {accounts.map(acc => <AccountRow key={acc.uuid} account={acc}/>)}
                </div>
                <AddAccountField />
            </div>
        </>
    );
}


async function loadAccounts() {
    const file = await fs.readFile("ops.json", "utf-8");  // TODO: Find the correct file for this
    const data: Account[] = JSON.parse(file);
    return data;
}
