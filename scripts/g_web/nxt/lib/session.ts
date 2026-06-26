import { SessionAccessor } from "@g/com/lib/auth";
import { cookies } from "next/headers";

// This only needs instantiating once, and a macro makes dev easier to
export const NS = new SessionAccessor(cookies);
