"use client";

import ToggleButton from "@/app/ui/ToggleButton";
import { FilterContainer } from "./TimelineFilters";
import { useTimelinePreferences } from "../TimelinePreferencesContext";

/**
 * The timeline sidebar's "Show tags"/"Show persons" display toggles, backed directly by
 * {@link useTimelinePreferences} rather than props, so both this and EventCard (which reads the
 * same context) stay in sync without prop-drilling through the page.
 */
export default function ShowToggles() {
    const { showTags, showPersons, setShowTags, setShowPersons } = useTimelinePreferences();

    return (
        <FilterContainer title="Show">
            <ToggleButton checked={showTags} setter={setShowTags} label="Show tags" className="text-sm" />
            <ToggleButton checked={showPersons} setter={setShowPersons} label="Show persons" className="text-sm" />
        </FilterContainer>
    );
}
