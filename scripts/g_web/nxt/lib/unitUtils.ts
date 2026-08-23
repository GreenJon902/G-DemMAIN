export type BaseUnit = { [value: number]: string, 1: string };  // <value> of this baseunit map to 1 of the value for that key (e.g. if the baseUnit is B and {1000: "MB"} then that means 1000B maps to 1MB). This must have the key 1
export const BYTES = { 1: "B", [10**3]: "KB", [10**6]: "MB", [10**9]: "GB", [10**12]: "TB", [10**15]: "PB"};
export const SECONDS = { 1: "s", 60: "m", [60*60]: "h", [60*60*24]: "d"};
export const PERCENTAGE = { 1: "%" };
export const TPS = { 1: "tps" };
export const PLAYERS = { 1: "" };

/**
 * Change the base unit of the given baseunit to a higher value.
 * This is useful if you have data in e.g. MB, but only a B base unit.
 * The new base must be a key in the give BaseUnit.
 */
export function rebase(baseUnit: BaseUnit, newBase: number): BaseUnit {
    const rebased = Object.fromEntries(
        Object.entries(baseUnit).map(([key, value]) => [parseFloat(key), value] as const)
            .map(([key, value]) => [key / newBase, value] as const)
            .filter(([key]) => key >= 1)
    );
        
    // Confirm rebased contains key 1
    if (!Object.keys(rebased).map(parseInt).includes(1)) throw `Expected key 1, ${rebased}`;
    const castRebased = rebased as ((typeof rebased) & { 1: string });

    return castRebased;
}

/**
 * Finds the most appropriate unit for rendering the given data.
 * All data will be scaled to have that same unit applied to it. Then the numbers will be rounded to the same number of decimal places. 
 * This will attempt to give data to 3 significant figures.
 * The returned unit will have the suffix (if given) (e.g. /s) appended to it.
 *
 * @param data - The data to humanize, this can be a single value or an array.
 * @param baseUnit - The unit information. This is the unit that the data is currently in.
 * @param unitSuffix - A suffix to append to the base unit.
 * @param baseInteger - If the data is kept as the base unit, should it be kept as an integer.
 * @param percentageMax - If this is given then a percentage will be shown. The percentage is the percentage of the data point of this value.
 */
export function humanize(data: number[] | number, baseUnit: BaseUnit, 
    { 
        unitSuffix = "",
        baseInteger = false,
        percentageMax 
    } : {
                            unitSuffix?: string,
                            baseInteger?: boolean,
                            percentageMax?: number
                         } = {}
) {
    const xs = Array.isArray(data) ? data : [data];

    const unitEntries = Object.entries(baseUnit).map(([key, value]) => [parseFloat(key), value] as const);

    // Find largest unit where at least one abs-volue of converted `x` is greater than or equal to 1
    // Sign does not matter as we care only about magnatude
    // We default to the smallest unit (should only happen when the given values are all too small)
    const [newUnitKey, newUnitValue] = unitEntries
        .filter(([key]) => xs.map(x => x / key).filter(y => Math.abs(y) >= 1).length > 0)  // Filter out units where converted `x` is less than 1
        .sort(([aKey], [bKey]) => aKey - bKey)  // Sort by whoever has the largest value
        .at(-1)  // Largest such unit
        ??
        unitEntries.sort(([aKey], [bKey]) => aKey - bKey)[0];  // Find smallest unit

    // Scale data to the new unit
    const ys = xs.map(x => x / newUnitKey);

    // Now we round the data to the same number of decimal places
    const highestExpo = Math.max(...ys.map(y => Math.log10(Math.abs(y)))); 
    const dp = (newUnitKey === 1 && baseInteger) ? 0 :
        (
            (isFinite(highestExpo)) ?
                Math.max(0, 3 - Math.floor(highestExpo) - 1)  // We want three sig figs, if this would require rounding pre-decimal-point numbers then just keep everything before the point
                :
                0
        );  // Round to no decimal places cause idk what else to do
    const zs = ys.map(y => y.toFixed(dp));
    
    // Append unit to text and return
    return zs.map((z, i) => z + newUnitValue + unitSuffix + ((percentageMax === undefined) ? "" : ` - ${(xs[i] / percentageMax! * 100).toFixed(0)}%`));
}

