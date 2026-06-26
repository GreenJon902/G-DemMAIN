"use client";
import { tailLatest } from "@g/com/lib/panelUtils";
import LogView from "../ui/LogView";

export default function LogDisplay({
    data
}: {
    data: Awaited<ReturnType<typeof tailLatest>>
}) {
    return (
        <LogView
            lines={data.contents}
            className="max-h-[30dvh] flex-1 overflow-scroll"
            lineNoStart={-data.contents.length}
        />
    );
}
