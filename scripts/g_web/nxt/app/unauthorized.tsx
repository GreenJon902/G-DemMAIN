"use client";

import AbstractErrorPage from "./ui/AbstractErrorPage";
import { loginUrl } from "./login/util";
import TextLink from "./ui/TextLink";
import { usePathname, useSearchParams } from "next/navigation";

export default function Unauthorized() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const next = pathname + (search ? `?${search}` : "");

    return (
        <AbstractErrorPage
            code="401"
            head="/ollieblitzz.png"
        >
            <span>
                You must be <TextLink href={loginUrl(next)}>logged in</TextLink> to view this page.
            </span>
        </AbstractErrorPage>
    );
}
