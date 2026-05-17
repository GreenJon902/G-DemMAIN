import zod from "zod";

export const MCCWSS_PORT = zod.string().regex(/^\d+$/).transform(Number).pipe(zod.number().int().min(0).max(65535)).parse(process.env.NEXT_PUBLIC_MCCWSS_PORT);
