"use client";

import { useEffect } from "react";
import AbstractErrorPage from "./ui/AbstractErrorPage";
import TextLink, { TEXT_LINK_WHITE } from "./ui/TextLink";
import { loginUrl } from "./login/util";
import { logoutAction } from "./account/actions";
import { usePathname, useSearchParams } from "next/navigation";

export default function Forbidden() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const next = pathname + (search ? `?${search}` : "");

    // forbidden() is a mid-render interrupt, not a real route navigation, so Next never re-runs
    // metadata resolution for this boundary — a `metadata` export here is silently ignored, hence
    // setting the title directly
    useEffect(() => {
        document.title = "Forbidden | G-Dem SMP";
    }, []);

    return (
        <AbstractErrorPage
            code="403"
            head="/b8nji.png"
            reloadOnPermission
        >
            <span>
                You don&apos;t have permission to access this page.
            </span>
            <br />
            <TextLink href={loginUrl(next)} color={TEXT_LINK_WHITE} onNavigate={async (e) => { e.preventDefault(); await logoutAction(next); }}>
                <span>
                    Switch account?
                </span>
            </TextLink>
        </AbstractErrorPage>
    );
}
