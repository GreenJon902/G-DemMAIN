import MapStack from "./MapStack";
import { loadMarkersData } from "./markersData";
import { loadMaps } from "./mapsData";

/**
 * This page renders the rendered dynmap internally in nextjs.
 * This is a server component which loads the default settings, map list and marker data, see MapStack for the client side container of all map contents.
 */
export default async function MapPage() {
    const [markersData, maps] = await Promise.all([loadMarkersData(), loadMaps()]);
    return (
        <MapStack
            defaultEnabledMarkers={["markers", "bases"]}
            markersData={markersData}
            defaultSelectedMap={maps[0].name}
            mapOptions={maps}
        />
    );
}
