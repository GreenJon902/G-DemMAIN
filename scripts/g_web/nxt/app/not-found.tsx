"use client";

import { useEffect } from "react";
import AbstractErrorPage from "./ui/AbstractErrorPage";

export default function NotFound() {
    // notFound() (called from many pages, e.g. an invalid/missing entity id) is a mid-render
    // interrupt, not a real route navigation, so Next doesn't always re-run metadata resolution for
    // this boundary — a `metadata` export here is unreliable, hence setting the title directly
    useEffect(() => {
        document.title = "Not Found | G-Dem SMP";
    }, []);

    return (
        <AbstractErrorPage
            code="404"
            head="/omegadestroy400.png"
        >
            This page could not be found.
        </AbstractErrorPage>
    );
}
