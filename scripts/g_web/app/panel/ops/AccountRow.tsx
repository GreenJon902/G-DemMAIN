"use client";

import { Account } from "./page";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import PlayerHead from "./PlayerHead";
import { removeOperator } from "./actions";
import { useTransition } from "react";

async function openConfirmRemoveUserModal(account: Account, callback: () => void) {
    if (window.confirm(`Are you sure you want to de-op ${account.name}?`)) {
        callback();
    }
}

export default function AccountRow({ account } : { account: Account }) {
    const router = useRouter();

    // Function to make the change on server and refresh page afterwards
    const [isPending, startTransition] = useTransition();  // Is pending is true when we've sent the change to the server and are waiting for a response
    const handleConfirm = () => {
        startTransition(async () => {
            await removeOperator(account.uuid);
            router.refresh();
        });
    };

    return (
        <div className="flex h-8 justify-between p-1 first:rounded-t-md last:rounded-b-md odd:bg-gray-700 even:bg-gray-800">
            <div className="flex space-x-1">
                <div className="relative size-6 overflow-hidden rounded-md"><PlayerHead account={account} /></div>
                <span> {account.name} </span>
            </div>
            <button type="button" className="size-6 cursor-pointer rounded-md bg-red-600 hover:bg-red-800" 
                onClick={() => openConfirmRemoveUserModal(account, () => handleConfirm())}
            >
                {isPending ?
                    (<ArrowPathIcon className="size-6 animate-spin self-stretch stroke-2 text-white" />) :
                    (<XMarkIcon className="size-6 self-stretch stroke-2 text-white" />)
                }
            </button>
        </div>
    );
}

