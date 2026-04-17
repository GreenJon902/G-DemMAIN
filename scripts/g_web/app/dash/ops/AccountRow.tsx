"use client";

import { Account } from "./page";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";

async function openConfirmRemoveUserModal(account: Account, reloadCallback: () => void) {
    if (window.confirm(`Are you sure you want to de-op ${account.name}?`)) {
        fetch("/api/dash/updateList", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "action": "remove",
                "uuid": account.uuid
            })
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error - ${res.status}`);
                return res;
            })
            .catch(err => { console.log(err); window.alert("An error occured") })  // Inform user
            .finally(() => reloadCallback());

    }
}

export default function AccountRow({ account } : { account: Account }) {
    const router = useRouter();

    return (
        <div className="flex justify-between p-1 first:rounded-t-md last:rounded-b-md odd:bg-gray-700 even:bg-gray-800">
            <span> {account.name} </span>
            <button type="button" className="rounded-md bg-red-600 hover:bg-red-800" 
                onClick={() => openConfirmRemoveUserModal(account, () => router.refresh())}
            >
                <XMarkIcon className="size-5 stroke-2 text-white" />
            </button>
        </div>
    );
}

