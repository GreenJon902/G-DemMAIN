"use client";

import { UserCircleIcon as UserCircleIconOutline } from "@heroicons/react/24/outline";
import { UserCircleIcon as UserCircleIconSolid } from "@heroicons/react/24/solid";
import Link from "next/link";
import TextLink, { TEXT_LINK_WHITE } from "./ui/TextLink";
import { useEffect, useState } from "react";
import { useAuthContext } from "./AuthContext";
import { SUDO_WINDOW_MS } from "@g/com/lib/authConstants";

const SUDO_WARN_MS = 5 * 60 * 1000;  // How long before sudo expiry the indicator turns yellow

function AccountButton() {
    const { isLoggedIn, sudoVerifiedAt } = useAuthContext();
    const [warnFiredAt, setWarnFiredAt] = useState<number | null>(null);  // The sudoVerifiedAt value for which the warn timer fired; used to trigger a colour change re-render without synchronous setState in an effect.

    // Managing warnFiredAt
    useEffect(() => {
        if (sudoVerifiedAt === null) return;
        const remaining = Math.max(0, SUDO_WINDOW_MS - (Date.now() - sudoVerifiedAt));
        // Set timer to fire when the colour should change to the warning colour.
        // If already in the warn window, delay of 0 fires next tick (avoids synchronous setState in effect).
        const timeUntilWarn = Math.max(0, remaining - SUDO_WARN_MS);
        const timer = setTimeout(() => setWarnFiredAt(sudoVerifiedAt), timeUntilWarn);
        return () => clearTimeout(timer);
    }, [sudoVerifiedAt]);

    let colorClass: string;
    if (!isLoggedIn) {
        colorClass = "text-gray-400";
    } else if (sudoVerifiedAt === null) {
        colorClass = "text-white";
    } else {
        colorClass = warnFiredAt === sudoVerifiedAt ? "text-yellow-400" : "text-green-400";
    }

    return (
        <div className={`relative float-right size-6 hover:opacity-50 ${colorClass}`}>
            {isLoggedIn ? (
                <Link href="/account">
                    <UserCircleIconSolid className="size-full" />
                </Link>
            ) : (
                <Link href="/login?next=account">
                    <UserCircleIconOutline className="size-full stroke-1" />
                </Link>
            )}
        </div>
    );
}

/**
 * The nav bar that should be shown at the top of any page.
 * This is NOT wrapped in <header> or <nav> or any other tag.
 */
export default function GlobalNav() {
    return (
        <>
            <div className="flex flex-row flex-wrap bg-gray-700 p-1">
                <Link href="/" className="size-6">
                    <img
                        src="/icon.png"
                        className="size-full hover:opacity-50"
                        alt={"Logo"}
                    />
                </Link>
                <TextLink href="/rules" color={TEXT_LINK_WHITE} constantColor className="ml-1 border-x border-gray-500 px-1 hover:bg-gray-600">
                    Rules
                </TextLink>
                <TextLink href="/hisdoc" color={TEXT_LINK_WHITE} constantColor className="border-r border-gray-500 px-1 hover:bg-gray-600">
                    HisDoc
                </TextLink>
                <TextLink href="/map" color={TEXT_LINK_WHITE} constantColor className="border-r border-gray-500 px-1 hover:bg-gray-600">
                    Dynmap
                </TextLink>
                <TextLink href="/panel" color={TEXT_LINK_WHITE} constantColor className="border-r border-gray-500 px-1 hover:bg-gray-600">
                    Panel
                </TextLink>
                <div className="flex-1">
                    <AccountButton />
                </div>
            </div>
        </>
    );
}
