"use client";

import { useEffect, useState } from "react";
import { List } from "./page";
import PlayerHead from "./PlayerHead";
import { addToListAction } from "./actions";
import { useRouter } from "next/navigation";
import { ActionButton, BUTTON_GREEN } from "../ui/Button";


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

export default function AddAccountField({ list }: { list: List }) {
    const [imageFound, setImageFound] = useState(false);  // Was the playerhead associated with currentName found?
    const [currentName, setCurrentName] = useState("");

    const router = useRouter();

    // Debounce so we don't load an image for every key the user presses
    const debouncedCurrentName = useDebounce(currentName, 250);

    // When we are currently debouncing, or if the image is not found, then we should not show the image
    const displayImage = imageFound && currentName == debouncedCurrentName;

    // TODO: Validate input on client side
    return (
        <div className="flex h-6 flex-wrap space-x-1">
            <input 
                type="text" 
                name="name"  
                placeholder={list.lang.addPrompt} 
                className="flex-1 rounded-md bg-gray-600 px-1 outline-none focus:bg-gray-700" 
                value={currentName} 
                onChange={e => {
                    setCurrentName(e.target.value);
                    setImageFound(false);  // The new image (for this name) hasn't been found, so hide
                }}
            />
            {list.renderPlayerheads && (
                <div className={`relative flex-none ${displayImage ? "w-6 opacity-100" : "mr-0! w-0 opacity-0"} h-6 overflow-hidden rounded-md transition-all`}>
                    <PlayerHead  
                        name={debouncedCurrentName}  
                        onUpdate={found => setImageFound(found)}
                    />
                </div>
            )}
            <ActionButton action={() => addToListAction(list.filename, currentName).then(router.refresh)} color={BUTTON_GREEN}>
                <span> {list.lang.addButton} </span> 
            </ActionButton> 
        </div>
    );
}
