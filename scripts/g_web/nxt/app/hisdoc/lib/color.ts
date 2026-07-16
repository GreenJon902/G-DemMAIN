/** Formats a raw hd_tag.color int as a "#rrggbb" CSS color string. */
export function colorToHex(color: number): string {
    // >>> 0 coerces to unsigned 32-bit so negative signed integers produce a valid hex string
    return "#" + (color >>> 0).toString(16).padStart(6, "0");
}
