"use client";

import AbstractErrorPage from "./ui/AbstractErrorPage";
import b8nji from "@/public/b8nji.png";
import { loginUrl } from "./login/util";
import TextLink from "./ui/TextLink";

export default function Unauthorized() {
    const next = window.location.pathname + window.location.search + window.location.hash;

    return (
        <AbstractErrorPage
            code="401"
            head={b8nji}        
        >
            <span>
                You must be <TextLink href={loginUrl(next)}>logged in</TextLink> to view this page.
            </span>
        </AbstractErrorPage>
    );
}
