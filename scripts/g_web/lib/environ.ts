import zod from "zod";

export const SESSION_PASSWORD = zod.string().trim().min(32).parse(process.env.SESSION_PASSWORD);
export const PANEL_USER = zod.string().trim().parse(process.env.PANEL_USER).split(",");
export const PANEL_PASSWORD = zod.array(zod.string()).length(PANEL_USER.length).parse(zod.string().trim().parse(process.env.PANEL_PASSWORD).split(",")); 
