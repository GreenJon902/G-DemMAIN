/**
 * This file provides the UI for viewing and updating the various player-lists for the minecraft server (e.g. whitelist.json).
 */

import ItemRow from "./ItemRow";
import AddItemField from "./AddItemField";
import PanelPageSection from "../ui/PanelPageSection";
import { ListType, queryList } from "@/lib/panelUtils";

// Define or generic list item, this is what gets passed around and rendered
export type ListItem = {
    rendername: string,  // This is the name/identifier to be shown to the user
    uniquename: string,  // A unqiue identifier for this list item (e.g. player uuid), this can match rendername
    meta: { [key: string]: string }  // Optional metadata to be rendered along-side the list item
}

// Define the lists (e.g. whitelist or banned-players) that we want to render
export type List = {
    what: ListType,  // What this is (e.g. whitelist vs bans)
    rendername: string,  // The name of this list that is displayed to the user
    renderPlayerheads: boolean,  // Should we render playerheads, aka does ListItem.uniquename correspond to a minecraft account
    lang: {
        remove: string,  // The list specific term for removing an item
        addButton: string,  // The list specific text to put on the add new item button
        addPrompt: string  // The example text to put in the text box

    }
}

const LISTS: List[] = [
    { what: "operators", rendername: "Operators", renderPlayerheads: true, lang: { remove: "de-op", addButton: "Add operator", addPrompt: "GamerGirl67..." } }, 
    { what: "bans", rendername: "Banned Players", renderPlayerheads: true, lang: { remove: "un-ban", addButton: "Ban player", addPrompt: "OllieBlitzz..." } },
    { what: "ipbans", rendername: "Banned IPs", renderPlayerheads: false, lang: { remove: "un-ban", addButton: "Ban IP", addPrompt: "127.0.0.1" } },
    { what: "whitelist", rendername: "Whitelist", renderPlayerheads: true, lang: { remove: "un-whitelist", addButton: "Add to whitelist", addPrompt: "KingDave..." } }
];


export default function Page() {
    return (
        <>
            {
                LISTS.map(async (list) => (
                    <PanelPageSection title={list.rendername} key={list.what} >
                        <div className="space-y-1">
                            <div> 
                                {(await queryList(list.what)).map(item => (
                                    <ItemRow item={item as ListItem} list={list} />
                                ))}
                            </div>
                            <AddItemField list={list} />
                        </div>
                    </PanelPageSection>
                ))
            }
        </>
    );
}


