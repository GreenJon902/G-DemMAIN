"use server";


/**
 * Adds an operator to operaters.
 * // TODO: REturn values
 */
export async function addOperatorAction(name: string) {  // name could be uuid too
    console.log("Adding", name, "to the operators list");
    await new Promise(r => setTimeout(r, 500));
}

// TODO: CLean this
export async function removeOperatorAction(uuid: string) {
    console.log("Removing", uuid, "from the operators list");
    await new Promise(r => setTimeout(r, 500));
}
