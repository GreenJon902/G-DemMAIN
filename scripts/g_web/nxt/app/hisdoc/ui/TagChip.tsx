import Link from "next/link";


/**
 * A pill-shaped chip that links to a tag's page.
 * The background colour is derived from a packed RGB integer stored in the database.
 *
 * @param id - The tag's unique identifier, used to build the href.
 * @param name - The display name of the tag.
 * @param color - RGB value packed as a signed 32-bit integer (e.g. 16711680 = #FF0000).
 */
export function TagChip({ id, name, color }: { id: number; name: string; color: number }) {
    // >>> 0 coerces to unsigned 32-bit so negative signed integers produce a valid hex string
    const hexColor = "#" + (color >>> 0).toString(16).padStart(6, "0");

    return (
        <Link
            href={"/hisdoc/tag/" + id}
            className="inline-block rounded-full px-3 py-1 text-sm text-white bg-gray-600 flex flex-row text-no-wrap flex-no-wrap gap-2 align-center"

        >
            <div className="size-4 rounded-full inline-block mr-1" style={{ backgroundColor: hexColor }}/> 
            {name}
        </Link>
    );
}
