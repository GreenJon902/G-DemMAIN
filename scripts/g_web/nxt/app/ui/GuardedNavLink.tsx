"use client";

import { ReactNode } from "react";
import { Url } from "next/dist/shared/lib/router/router";
import TextLink, { TEXT_LINK_WHITE } from "./TextLink";
import { useAuthContext } from "@/app/AuthContext";
import type { Area } from "@g/com/lib/authConstants";

/**
 * A nav TextLink that greys itself out when the user lacks at least viewer access to `area`.
 * @param area - The permission area to check "viewer" access for.
 */
export default function GuardedNavLink({
    area, href, className = "", children
}: {
    area: Area, href: Url, className?: string, children: ReactNode
}) {
    const { checkPermission } = useAuthContext();
    return (
        <TextLink href={href} color={TEXT_LINK_WHITE} constantColor className={className} disabled={!checkPermission(area, "viewer")}>
            {children}
        </TextLink>
    );
}
