type SizePartition = { size: number, width?: never, height?: never };
type DimensionsPartition = { width: number, height: number, size?: never };

export type CheckeredTextureOptions = (SizePartition | DimensionsPartition) & {
    squareSize?: number,
    superSample?: number
};

const textureCache = new Map<string, string>();

/**
 * Generates a checkered black/pink fallback texture, as a data URI, for use when a remote skin or
 * head image fails to load.
 *
 * @param options - Either the side length of a square texture, or a full options object.
 * @param options.size - Side length of a square texture in pixels, before supersampling. Mutually
 *   exclusive with `width`/`height`.
 * @param options.width - Width of the texture in pixels, before supersampling. Mutually exclusive with `size`.
 * @param options.height - Height of the texture in pixels, before supersampling. Mutually exclusive with `size`.
 * @param options.squareSize - Side length of each checkered square in pixels, before supersampling. Defaults to 4.
 * @param options.superSample - Factor to render the texture larger by internally (scaling width, height and
 *   squareSize together), so it can be displayed larger with hard-edged squares instead of a blurry upscale.
 *   Defaults to 1.
 * @returns A data URI for the generated PNG texture. Cached per distinct set of options.
 */
export function getCheckeredTextureDataUri(options: number | CheckeredTextureOptions): string {
    const normalized = typeof options === "number" ? { size: options } : options;
    const hasSize = normalized.size !== undefined;
    const hasDimensions = normalized.width !== undefined || normalized.height !== undefined;
    if (hasSize && hasDimensions) throw new Error("getCheckeredTextureDataUri: cannot specify both `size` and `width`/`height`");

    const width = hasSize ? normalized.size! : normalized.width!;
    const height = hasSize ? normalized.size! : normalized.height!;
    const { squareSize = 4, superSample = 1 } = normalized;

    const cacheKey = `${width}x${height}x${squareSize}x${superSample}`;
    const cached = textureCache.get(cacheKey);
    if (cached) return cached;

    const scaledWidth = width * superSample;
    const scaledHeight = height * superSample;
    const scaledSquareSize = squareSize * superSample;

    const canvas = document.createElement("canvas");
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext("2d")!;

    for (let i = 0; i < Math.ceil(scaledWidth / scaledSquareSize); i += 1) {  // x index
        for (let j = 0; j < Math.ceil(scaledHeight / scaledSquareSize); j += 1) {  // y index
            ctx.fillStyle = (i % 2) ^ (j % 2) ? "black" : "#ff00f6";
            ctx.fillRect(i * scaledSquareSize, j * scaledSquareSize, scaledSquareSize, scaledSquareSize);
        }
    }

    const dataUri = canvas.toDataURL();
    textureCache.set(cacheKey, dataUri);
    return dataUri;
}
