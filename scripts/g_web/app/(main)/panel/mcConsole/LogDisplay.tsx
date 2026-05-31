"use client";
import { tailLatest } from "@/lib/panelUtils";
import LogView from "../ui/LogView";

export default function LogDisplay({
    data
}: {
    data: Awaited<ReturnType<typeof tailLatest>>
}) {
    return (
        <LogView
            lines={data.contents}
            className="flex-1 max-h-[30dvh] overflow-scroll"
            lineNoStart={-data.contents.length}
        />
    );
}
