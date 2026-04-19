"use client";

import { useEffect, useState, useTransition } from "react";
import PlayerHead from "./PlayerHead";
import { addOperator } from "./actions";
import { useRouter } from "next/navigation";
import { ArrowPathIcon } from "@heroicons/react/20/solid";


/**
 * Apply a debounce to the given value.
 * So changes will only apply after the given delay, and any changes made in the mean-time will reset the timer.
 *
 * @param value - The variable to be debounced (a state).
 * @param delay - How long to wait after the last value change (in ms).
 */
function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timeout);  // Reset the timer before this runs again
    }, [value, delay]);

    return debounced;
}

export default function AddAccountField() {
    const [imageFound, setImageFound] = useState(false);  // Was the playerhead associated with currentName found?
    const [currentName, setCurrentName] = useState("");

    const router = useRouter();

    // Function to make change on server and refresh page afterwards
    // TODO: This transition thing can be moved to a until and generalised
    const [isPending, startTransition] = useTransition();  // Is pending is true when we've sent the change to the server and are waiting for a response
    const triggerAction = () => {
        startTransition(async () => {
            await addOperator(currentName);
            router.refresh();
        });
    };

    // Debounce so we don't load an image for every key the user presses
    const debouncedCurrentName = useDebounce(currentName, 250);

    // When we are currently debouncing, or if the image is not found, then we should not show the image
    const displayImage = imageFound && currentName == debouncedCurrentName;

    return (
        <div className="flex h-6 flex-wrap space-x-1">
            <input 
                type="text" 
                name="name"  // This could also be a UUID
                placeholder="GamerGirl67..." 
                className="flex-1 rounded-md bg-gray-600 px-1 outline-none focus:bg-gray-700" 
                value={currentName} 
                onChange={e => {
                    setCurrentName(e.target.value);
                    setImageFound(false);  // The new image (for this name) hasn't been found, so hide
                }}
            />
            <div className={`relative flex-none m-r-0 ${displayImage ? "w-6 opacity-100" : "w-0 opacity-0 mr-0!"} h-6 overflow-hidden rounded-md transition-all`}>
                <PlayerHead  
                    account={debouncedCurrentName}  
                    onUpdate={found => setImageFound(found)}
                />
            </div>
            <button type="button" onClick={triggerAction} className="relative flex justify-center rounded-md bg-green-600 px-1 text-nowrap hover:bg-green-800 focus-visible:bg-green-800 outline-none cursor-pointer">
                { /* Render both at same time so size remains constant, but hide the one we don't need */ }
                <ArrowPathIcon className={`size-6 animate-spin self-stretch stroke-2 text-white ${isPending ? "" : "invisible"} absolute`} />
                <span className={`${isPending ? "invisible" : ""}`}> Add operator </span> 

            </button> 
        </div>
    );

}
