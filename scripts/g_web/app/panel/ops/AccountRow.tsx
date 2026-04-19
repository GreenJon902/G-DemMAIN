"use client";

import { Account } from "./page";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import PlayerHead from "./PlayerHead";
import { removeOperatorAction } from "./actions";
import ActionButton from "./ActionButton";


export default function AccountRow({ account } : { account: Account }) {
    const router = useRouter();

    return (
        <div className="flex h-8 justify-between p-1 first:rounded-t-md last:rounded-b-md odd:bg-gray-700 even:bg-gray-800">
            <div className="flex space-x-1">
                <div className="relative size-6 overflow-hidden rounded-md"><PlayerHead account={account} /></div>
                <span title={account.uuid}> {account.name} </span>
            </div>
            <ActionButton
                action={() => removeOperatorAction(account.uuid).then(router.refresh)} 
                confirm={() => window.confirm(`Are you sure you want to de-op ${account.name}?`)}
                normalColor="bg-red-600" 
                effectColor="bg-red-800"
                className="size-6"
            >
                <XMarkIcon className="size-6 self-stretch stroke-2 text-white" />
            </ActionButton>
        </div>
    );
}

