"use server";


/**
 * Adds an operator to operaters.
 * // TODO: REturn values
 */
export async function addToListAction(filename: string, name: string) {  // name could be uuid too
    console.log("Adding", name, "to the", filename, "list");
    await new Promise(r => setTimeout(r, 500));
}

// TODO: CLean this
export async function removeFromListAction(filename: string, itemuniquename: string) {
    console.log("Removing", itemuniquename, "from the", filename, "list");
    await new Promise(r => setTimeout(r, 500));
}
