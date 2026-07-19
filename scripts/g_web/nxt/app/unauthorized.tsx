"use client";

import { useEffect } from "react";
import AbstractErrorPage from "./ui/AbstractErrorPage";
import { loginUrl } from "./login/util";
import TextLink, { TEXT_LINK_WHITE } from "./ui/TextLink";
import { usePathname, useSearchParams } from "next/navigation";

export default function Unauthorized() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const next = pathname + (search ? `?${search}` : "");

    // unauthorized() is a mid-render interrupt, not a real route navigation, so Next never re-runs
    // metadata resolution for this boundary — a `metadata` export here is silently ignored, hence
    // setting the title directly
    useEffect(() => {
        document.title = "Unauthorized | G-Dem SMP";
    }, []);

    return (
        <AbstractErrorPage
            code="401"
            head="/ollieblitzz.png"
            reloadOnPermission
        >
            <span>
                You must be <TextLink href={loginUrl(next)} color={TEXT_LINK_WHITE}>logged in</TextLink> to view this page.
            </span>
        </AbstractErrorPage>
    );
}
