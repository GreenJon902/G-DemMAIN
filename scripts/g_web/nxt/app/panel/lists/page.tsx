/**
 * This file provides the UI for viewing and updating the various player-lists for the minecraft server (e.g. whitelist.json).
 */

import ItemRow from "./ItemRow";
import PageSection from "../../ui/PageSection";
import { BANNEDIP_LIST, BANNEDPLAYER_LIST, loadListItems, OPERATOR_LIST, List as PUList, WHITELIST_LIST } from "@/lib/panelUtils";
import { AutoLabelSinceLastRefresh } from "../../ui/LabelSinceLastRefresh";


// Define the lists (e.g. whitelist or banned-players) that we want to render
export type List = {
    list: PUList
    rendername: string,  // The name of this list that is displayed to the user
    renderPlayerheads: boolean,  // Should we render playerheads, aka does ListItem.uniquename correspond to a minecraft account
}
const LISTS: List[] = [
    { list: OPERATOR_LIST, rendername: "Operators", renderPlayerheads: true }, 
    { list: BANNEDPLAYER_LIST, rendername: "Banned Players", renderPlayerheads: true } ,
    { list: BANNEDIP_LIST, rendername: "Banned IPs", renderPlayerheads: false },
    { list: WHITELIST_LIST, rendername: "Whitelist", renderPlayerheads: true }
];


export default function Page() {
    return (
        <>
            {
                LISTS.map(async (list, i) => (
                    <PageSection title={list.rendername} key={i} >
                        <div className="space-y-1">
                            <div> 
                                {(await loadListItems(list.list))?.map(item => (
                                    <ItemRow key={item.uniquename} item={item} list={list} />
                                )) ?? <span className="italic">Data missing!</span>}
                            </div>
                        </div>
                    </PageSection>
                ))
            }
            <AutoLabelSinceLastRefresh />
        </>
    );
}


