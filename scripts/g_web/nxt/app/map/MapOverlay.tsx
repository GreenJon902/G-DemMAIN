import { Dispatch, SetStateAction, useState, ReactNode } from "react";
import { BeakerIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/20/solid";
import RadioButtons from "../ui/RadioButtons";
import CheckboxList from "../ui/CheckboxList";

/**
 *  A component of the overlay, so one specific option.
 *  This sets pointer-events-auto for its children.
 *  @param position - Where it should be placed, e.g. "left-0".
 */
function OverlayElement({
    title, position, children
}: {
    title: string,
    position: string,
    children: ReactNode
}) {
    return (
        <div className={`absolute size-fit rounded-md border border-gray-500 bg-gray-700 p-1 ${position} pointer-events-auto top-0`}>
            <h3 className="underline">{title}</h3>
            {children}
        </div>
    );
}

/**
 * A small icon button pinned to a bottom corner of the overlay. It stays hidden until hovered,
 * unless `active` is true, in which case it stays visible. When active, this has a background if `hasBackground` is true. When innactive, this does not have a background.
 * @param position - Where it should be placed, e.g. "left-0".
 */
function CornerToggle({
    title, position, active, hasBackground, onClick, children
}: {
    title: string,
    position: string,
    active: boolean,
    hasBackground: boolean,
    onClick: () => void,
    children: ReactNode
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`pointer-events-auto absolute bottom-0 rounded-md p-1 ${position} ${(active && hasBackground) ? "border border-gray-500 bg-gray-700 hover:bg-gray-600" : "border border-transparent "} ${active ? "" : "opacity-0 hover:opacity-100"}`}
        >
            {children}
        </button>
    );
}

/**
 * The map overlay - settings for which map you're looking at and which markers are selected.
 */
export default function MapOverlay({
    className, markerState, markerOptions, mapState, mapOptions, debugState  // TODO: Document these two
}: {
    className: string,
    markerState: [ Array<string>, Dispatch<SetStateAction<Array<string>>> ],
    markerOptions: Array<string>,
    mapState: [ string, Dispatch<SetStateAction<string>> ],
    mapOptions: Array<string>,
    debugState: [ boolean, Dispatch<SetStateAction<boolean>> ]
}) {
    const [enabledMarkers, setEnabledMarkers] = markerState;
    const [selectedMap, setSelectedMap] = mapState;
    const [debugMode, setDebugMode] = debugState;
    const [visible, setVisible] = useState(true);

    return (
        // pointer-events-none so empty space in this overlay doesn't block the map's own wheel/pointer
        // listeners underneath - pointer-events-auto is restored on the actual interactive elements below
        <div className={`${className} pointer-events-none p-1`}>
            <div className="relative size-full">
                {/** Overlay visibility toggle */}
                <CornerToggle
                    title={visible ? "Hide overlay" : "Show overlay"}
                    position="right-0"
                    active={visible}
                    hasBackground={true}
                    onClick={() => setVisible(!visible)}
                >
                    {visible ? <EyeIcon className="size-5" /> : <EyeSlashIcon className="size-5" />}
                </CornerToggle>

                {/** Debug mode toggle */}
                <CornerToggle
                    title={debugMode ? "Disable debug mode" : "Enable debug mode"}
                    position="left-0"
                    active={debugMode && visible} 
                    hasBackground={false}
                    onClick={() => setDebugMode(!debugMode)}
                >
                    <BeakerIcon className="size-5" />
                </CornerToggle>

                {visible && (
                    <>
                        {/** Marker selector */}
                        <OverlayElement title="Markers" position="left-0">
                            <CheckboxList
                                choices={markerOptions}
                                selected={enabledMarkers}
                                setter={setEnabledMarkers}
                                nameConv={m => m}
                            />
                        </OverlayElement>
                        {/** Map selector */}
                        <OverlayElement title="Map" position="right-0">
                            <RadioButtons
                                choices={mapOptions}
                                selected={selectedMap}
                                setter={setSelectedMap}
                                nameConv={m => m}
                            />
                        </OverlayElement>
                    </>
                )}
            </div>
        </div>
    );
}
