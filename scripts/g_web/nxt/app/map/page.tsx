import MapStack from "./MapStack";

/**
 * This page renders the rendered dynmap internally in nextjs.
 * This is a server component which just loads the default settings, see MapStack for the client side container of all map contents.
 */
export default function MapPage() {
    return <MapStack defaultEnabledMarkers={["foo"]} markerOptions={["foo", "bar"]} defaultSelectedMap={"flat"} mapOptions={["flat", "iso"]} />  // TODO: Get real data for this
}
