"use client";

import { UserCircleIcon as UserCircleIconOutline } from "@heroicons/react/24/outline";
import { UserCircleIcon as UserCircleIconSolid } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthContext } from "./AuthContext";
import { SUDO_WINDOW_MS } from "@g/com/lib/authConstants";

const SUDO_WARN_MS = 5 * 60 * 1000;  // How long before sudo expiry the indicator turns yellow

/** Account icon shown in the global nav; colour reflects login/sudo state and links to /account or /login. */
export default function AccountButton() {
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
