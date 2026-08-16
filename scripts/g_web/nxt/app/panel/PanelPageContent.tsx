"use client";

import { ActionButton, BUTTON_GREEN, BUTTON_RED, BUTTON_YELLOW } from "./../ui/Button";
import PageSection from "../ui/PageSection";
import type { Unit } from "@g/com/lib/config";
import { loadPanelDataAction, unitAction } from "./actions";
import { CpuRamGraph, TpsHeapGraph } from "./ui/Graphs";
import { UnitStatus } from "@/lib/panelUtils";
import { latestDefined } from "@/lib/graphUtils";
import { makeAreaSudoGuard, useAuthContext } from "@/app/AuthContext";
import { useConfirmContext } from "@/app/ConfirmContext";
import { useErrorContext } from "@/app/ErrorContext";
import LabelDataMissing from "../ui/LabelDataMissing";

export default function PanelPageContent(
    { data }: { data: Awaited<ReturnType<typeof loadPanelDataAction>> }
) {
    const gd = data.graphData.timed ?? [];
    return (
        <>
            { /* Resource monitors -------------------------------------------------- */ }
            <PageSection title="Important Graphs">
                {data.graphData.timed === undefined && <LabelDataMissing />}
                <div className="flex w-full flex-wrap gap-4">
                    <TpsHeapGraph
                        data={gd.map(d => ({ time: d.time, tps: d.minecraft.tps, mem: d.minecraft.mem }))}
                        allocatedMem={latestDefined(gd, d => d.minecraft.mem?.total)}
                    />
                    <CpuRamGraph
                        data={gd.map(d => ({ time: d.time, cpu: d.sys_cpu?.agg, mem: d.sys_mem }))}
                        totMem={latestDefined(gd, d => d.sys_mem?.total)}
                        noCores={latestDefined(gd, d => d.sys_cpu?.ind.size)}
                        what="System"
                    />
                </div>
                {/* No min/mean/max resolution note here (unlike the Graphs page) - this page always loads the smallest retention interval, which is snapshot mode, so there's no aggregation to explain */}
            </PageSection>
            { /* Service status -------------------------------------------------- */ }
            <PageSection title="Units">
                <table className="w-full overflow-hidden rounded-md"><tbody>
                    {
                        data.unitsStatuses.map(({ unit, status }) => (
                            <tr className="odd:bg-gray-700 even:bg-gray-800" key={`${unit.name}.${unit.type}`}>
                                <td className="w-6 p-1">
                                    <StatusIndicator unit={unit} status={status} />
                                </td>
                                <td className="p-1">
                                    {unit.name}
                                    <span className="text-xs text-gray-400">
                                            .{unit.type}
                                    </span>
                                </td>
                                <td className="flex gap-1 p-1"> {/* All changing controls go into the same <td> as the frequent changing causes firefox to get confused and not render backgrounds correctly */}
                                    <UnitControls unit={unit} status={status} className="flex-1" />
                                </td>
                            </tr>
                        ))
                    }
                </tbody></table>
            </PageSection>
        </>
    );

}


/**
 * Get the color associated with this status.
 * If the status is unkown then it's logged to the console and set to transparent.
 * @param status - This should be the systemd SubState.
 */
function StatusIndicator({ unit, status }: { unit: Unit, status: UnitStatus | undefined }) {
    // Get the color
    const color = {
        "active": "bg-green-600",
        "inactive": unit.expectActive ? "bg-orange-600" : "bg-cyan-600",
        "failed": "bg-red-600",
        "activating": "bg-yellow-600",
        "deactivating": "bg-yellow-600",
        "reloading": "bg-yellow-600",
        "undefined": "bg-gray-600"
    }[String(status)];

    // If we have no color then we don't recognise this status
    if (color === undefined) {
        // Error and just display text
        console.error("Unrecognised status", status);
        return status;
    }

    // Create a circle with the first letter of status, with hover being full status name
    return <div className={`${color} aspect-square w-6 rounded-full text-center`} title={status}>
        {String(status)[0].toUpperCase()}
    </div>;
}

/**
 * Create the controls for the given unit.
 * @param className - This will be given to each child.
 */
function UnitControls({ unit, status, className="" }: { unit: Unit, status: UnitStatus | undefined, className?: string }) {
    const authCtx = useAuthContext();
    const isAdmin = authCtx.checkPermission("panel", "admin");
    const guard = makeAreaSudoGuard("panel", "admin", authCtx);
    const { requestConfirm } = useConfirmContext();
    const { showError } = useErrorContext();

    // Warn the user before acting on units that could interrupt panel access or require SSH to recover
    const confirm = unit.impactsPanel
        ? () => requestConfirm(`Stopping or restarting ${unit.name} may interrupt your access to this panel and could require SSH to recover. Are you sure?`)
        : undefined;

    // Bundled so it can be spread onto each button below instead of repeating every prop
    const btnProps = { unit, className, guard, confirm, onError: showError, disabled: !isAdmin };

    // Create buttons depending on current status and unit type
    if (
        status === "activating" ||
        status === "deactivating" ||
        !unit.controllable  // This needs to be first as the other clauses don't check for controllable-ness
    ) {
        return null; // No controls

    } else if (
        status === "active" &&
        unit.type === "service" || unit.type === "target"
    ) {
        return <><_Restart {...btnProps} /><_Stop {...btnProps} /></>;

    } else if (
        status === "active" &&
        unit.type === "timer"
    ) {
        return <_Stop {...btnProps} />;  // Restarting a timer doesn't make sense

    } else if (
        status === "failed" ||
        status === "inactive"
    ) {
        return <_Start {...btnProps} />;

    } else  {
        console.error("Unrecognised status", status, "for unit of type", unit.type);
        return  <div className="text-center"> Unkown! </div> ;
    }
}
// Macro functions to create buttons
type _BtnProps = { unit: Unit, className: string, guard: () => Promise<boolean>, confirm: (() => Promise<boolean>) | undefined, onError: (error: unknown) => void, disabled: boolean };
const _Stop = ({ unit, ...props }: _BtnProps) =>
    <ActionButton action={async () => await unitAction(unit, "stop")} color={BUTTON_RED} {...props}>Stop</ActionButton>;
const _Restart = ({ unit, ...props }: _BtnProps) =>
    <ActionButton action={async () => await unitAction(unit, "restart")} color={BUTTON_YELLOW} {...props}>Restart</ActionButton>;
const _Start = ({ unit, ...props }: _BtnProps) =>
    <ActionButton action={async () => await unitAction(unit, "start")} color={BUTTON_GREEN} {...props}>Start</ActionButton>;
