import MapStack from "./MapStack";
import { loadMarkersData } from "./markersData";

/**
 * This page renders the rendered dynmap internally in nextjs.
 * This is a server component which loads the default settings and marker data, see MapStack for the client side container of all map contents.
 */
export default async function MapPage() {
    const markersData = await loadMarkersData();
    return (
        <MapStack
            defaultEnabledMarkers={["markers", "bases"]}
            markersData={markersData}
            defaultSelectedMap={"flat"}
            mapOptions={["flat", "iso"]}  // TODO: Get real data for this
        />
    );
}
