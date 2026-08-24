"use client";

import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { ReactNode, useState } from "react";

/**
 * A numbered, collapsible rule section. Expands/collapses with a CSS height animation.
 *
 * @param index - The section's display number (e.g. 1 for the first section).
 * @param title - The section heading, shown after the number.
 * @param children - The rule content shown when expanded.
 */
export default function RuleSection({
    index, title, children
}: {
    index: number, title: string, children: ReactNode
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="scroll-mt-4">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg bg-gray-800 p-3 text-left hover:bg-gray-700"
            >
                <h3 className="text-xl leading-none font-bold underline decoration-4">
                    {index}. {title}
                </h3>
                <ChevronDownIcon className={`size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <div
                className="grid rounded-lg bg-gray-950 transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="space-y-3 p-3">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
