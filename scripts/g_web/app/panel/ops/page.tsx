import fs from "fs/promises";
import AccountRow from "./AccountRow";
import AddAccountField from "./AddAccountField";
import * as z from "zod";

const Account = z.object({
    name: z.string(),
    uuid: z.uuid()
});

export type Account = z.infer<typeof Account>;

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
    const data = z.array(Account).parse(JSON.parse(file));  // Parse an array of accounts. This will ignore any extra properties
    return data;
}
