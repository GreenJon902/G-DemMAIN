import { ListItem } from "@gcom/lib/panelUtils";
import { List } from "./page";
import PlayerHead from "./PlayerHead";


export default function ItemRow({ item, list }: { item: ListItem, list: List }) {
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
        </div>
    );
}

