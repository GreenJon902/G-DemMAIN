"use client";

import AbstractErrorPage from "./ui/AbstractErrorPage";
import TextLink from "./ui/TextLink";
import { loginUrl } from "./login/util";
import { logoutAction } from "./account/actions";
import { usePathname, useSearchParams } from "next/navigation";

export default function Forbidden() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const next = pathname + (search ? `?${search}` : "");

    return (
        <AbstractErrorPage
            code="403"
            head="/b8nji.png"       
        >
            <span>
                You don&apos;t have permission to access this page.
            </span>
            <br />
            <TextLink href={loginUrl(next)} onNavigate={async (e) => { e.preventDefault(); await logoutAction(next); }}>
                <span>
                    Switch account?
                </span>
            </TextLink>
        </AbstractErrorPage>
    );
}
