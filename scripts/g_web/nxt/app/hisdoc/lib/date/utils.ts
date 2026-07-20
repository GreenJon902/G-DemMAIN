/** Pads a number to two digits with a leading zero if needed. */
export function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/**
 * Floor-divides two bigints (rounds toward negative infinity, unlike `/` which truncates toward
 * zero). `b` must be positive.
 */
export function floorDivBigInt(a: bigint, b: bigint): bigint {
    const q = a / b;
    const r = a % b;
    return r !== 0n && r < 0n ? q - 1n : q;
}
