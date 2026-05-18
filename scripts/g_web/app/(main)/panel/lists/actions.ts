"use server";

import { addToList, ListType } from "@/lib/panelUtils";


// TODO: Make lists page routinely refresh using an action?

/**
 * Adds an operator to operaters.
 * // TODO: REturn values
 */
export async function addToListAction(list: ListType, name: string) {  // name could be uuid too
    console.log("Attempting to add", name, "to the", list, "list...");
    await addToList(list, name);
}

// TODO: CLean this
export async function removeFromListAction(list: ListType, itemuniquename: string) {
    console.log("Attempting to remove", itemuniquename, "from the", list, "list...");
    //removefromList(list, itemuniquename);
    throw "Not implemented";
}
