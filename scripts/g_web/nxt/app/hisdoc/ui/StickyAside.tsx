"use client";

import { ReactNode, RefObject, useEffect, useRef } from "react";

/**
 * Pins the top of the given element to the lower of the top of the page or the bottom of the nav.
 * Pins the bottom of the given element to the bottom of the page.
 */
function useStickyFillHeight(ref: RefObject<HTMLElement | null>) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let rafId = 0;
        const update = () => {
            rafId = 0;
            el.style.height = `calc(100dvh - ${el.getBoundingClientRect().top}px)`;
        };
        const scheduleUpdate = () => {
            if (rafId === 0) rafId = requestAnimationFrame(update);
        };

        update();
        window.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);
        return () => {
            window.removeEventListener("scroll", scheduleUpdate);
            window.removeEventListener("resize", scheduleUpdate);
            if (rafId !== 0) cancelAnimationFrame(rafId);
        };
    }, [ref]);
}

/**
 * A sticky, height-filling, independently-scrollable aside — used for the timeline's sidebar so
 * it scrolls on its own rather than growing the whole page.
 *
 * @param className - Extra classes appended after the fixed structural styling (e.g. a gap).
 */
export default function StickyAside({ children, className = "" }: { children: ReactNode; className?: string }) {
    const asideRef = useRef<HTMLElement>(null);
    useStickyFillHeight(asideRef);

    return (
        <aside
            ref={asideRef}
            className={`sticky top-0 flex w-64 flex-shrink-0 flex-col overflow-y-auto overscroll-contain ${className}`}
        >
            {children}
        </aside>
    );
}
