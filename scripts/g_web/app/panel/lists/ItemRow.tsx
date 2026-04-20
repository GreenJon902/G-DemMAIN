"use client";

import { ListItem, List } from "./page";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import PlayerHead from "./PlayerHead";
import { removeFromListAction } from "./actions";
import ActionButton from "./ActionButton";


export default function ItemRow({ item, list }: { item: ListItem, list: List }) {
    const router = useRouter();

    return (
        <div className="flex justify-between p-1 first:rounded-t-md last:rounded-b-md odd:bg-gray-700 even:bg-gray-800">
            <div>
                <div className="flex items-center space-x-1">
                    {list.renderPlayerheads && 
                        <div className="relative size-6 overflow-hidden rounded-md">
                            <PlayerHead item={item} />
                        </div>}
                    <span title={(item.uniquename !== item.rendername) ? item.uniquename : undefined} 
                        className="leading-[100%]"> {item.rendername} </span>
                </div>
                {Object.keys(item.meta).length > 0 && (  // Only render if there is at least one piece of metadata
                    <div>
                        {Object.entries(item.meta).map(([key, value]) => (
                            <span className="block text-xs leading-none text-gray-400" key={key}>{key}: {value} </span>
                        ))}
                    </div>
                )}
            </div>
            <ActionButton
                action={() => removeFromListAction(list.filename, item.uniquename).then(router.refresh)} 
                confirm={() => window.confirm(`Are you sure you want to ${list.lang.remove} ${item.rendername}?`)}
                normalColor="bg-red-600" 
                effectColor="bg-red-800"
                className="size-6"
            >
                <XMarkIcon className="size-6 self-stretch stroke-2 text-white" />
            </ActionButton>
        </div>
    );
}

