"use client";

import AbstractErrorPage from "./ui/AbstractErrorPage";
import ollieblitzz from "@/public/ollieblitzz.png";
import TextLink from "./ui/TextLink";
import { loginUrl } from "./login/util";
import { logoutAction } from "./account/actions";

export default function Forbidden() {
    const next = window.location.pathname + window.location.search + window.location.hash;

    return (
        <AbstractErrorPage
            code="403"
            head={ollieblitzz}        
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
