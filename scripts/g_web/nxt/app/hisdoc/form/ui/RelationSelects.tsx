"use client";

import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import TextInput from "@/app/ui/TextInput";
import { TagChip } from "../../ui/TagChip";
import SmallPerson from "../../ui/SmallPerson";
import SmallerEvent from "../../ui/SmallerEvent";
import { colorToHex } from "../../lib/color";
import { searchEvents, searchPersons } from "../actions";
import type { TagOption, PersonOption, EventOption } from "../lib/optionTypes";
import { useFormChanged } from "./FormInputs";

// Same debounce as TimelineFilters' search box, so searching feels consistent across the app
const SEARCH_DEBOUNCE = 300;

// Where a section's options come from: a fully-preloaded list filtered client-side, or a server
// search returning matches (null meaning "too many — refine the query")
type RelationSource<T> =
    | { kind: "static", items: Array<T>, matches: (item: T, lowercaseQuery: string) => boolean }
    | { kind: "remote", search: (query: string) => Promise<Array<T> | null> };

/**
 * Generic multi-select over relation items, rendered as toggleable chips/buttons with a search box
 * on top. Chips keep the source's own ordering, with selected ones highlighted in place; a remote
 * source shows just the current selection while the search box is empty. Owns the selection as a
 * full id → item map (remote sources have no static list to look items up in later) and
 * serializes it into the surrounding form via hidden inputs.
 *
 * @param defaultSelected - Items selected when the form first renders.
 * @param source - Where the selectable options come from.
 * @param serialize - How the selection enters FormData: `repeated` emits one hidden input named
 *   `name` per selected id; `commaJoined` emits a single hidden input with a comma-joined id list.
 * @param placeholder - Placeholder text for the search box.
 * @param renderItem - Renders one item's toggle control; must set `key={item.id}`.
 */
function RelationSelect<T extends { id: number }>({ defaultSelected, source, serialize, placeholder, renderItem }: {
    defaultSelected: Array<T>,
    source: RelationSource<T>,
    serialize: { name: string, mode: "repeated" | "commaJoined" },
    placeholder: string,
    renderItem: (item: T, isSelected: boolean, toggle: () => void) => ReactElement
}) {
    const notifyChanged = useFormChanged();
    const [selected, setSelected] = useState<Map<number, T>>(() => new Map(defaultSelected.map(item => [item.id, item])));
    const [query, setQuery] = useState("");
    // Latest remote-search results: undefined = nothing fetched yet (blank query / still searching),
    // null = the search matched too many items
    const [remoteResults, setRemoteResults] = useState<Array<T> | null | undefined>(undefined);

    // Debounced remote search; the sequence counter discards results that arrive out of order
    const searchSeq = useRef(0);
    const remoteSearch = source.kind === "remote" ? source.search : null;
    useEffect(() => {
        if (!remoteSearch) return;
        const trimmed = query.trim();
        if (!trimmed) return;  // handleQueryChange has already cleared the results
        const seq = ++searchSeq.current;
        const timer = setTimeout(async () => {
            const results = await remoteSearch(trimmed);
            if (searchSeq.current === seq) setRemoteResults(results);
        }, SEARCH_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [query, remoteSearch]);

    // Clearing the results on emptying lives here (not in the effect) so the effect never has to
    // set state synchronously; bumping the sequence discards any search still in flight
    function handleQueryChange(value: string) {
        setQuery(value);
        if (!value.trim()) {
            searchSeq.current++;
            setRemoteResults(undefined);
        }
    }

    /** Toggles one item in or out of the selection and tells the form to re-check dirtiness. */
    function toggle(item: T) {
        setSelected(prev => {
            const next = new Map(prev);
            if (next.has(item.id)) next.delete(item.id); else next.set(item.id, item);
            return next;
        });
        notifyChanged();
    }

    const lowercaseQuery = query.trim().toLowerCase();

    // What's rendered in the chip row, in source order — selected items are highlighted in place
    // rather than pulled to the front; with a remote source and no query, only the selection shows
    let visible: Array<T> = [];
    let message: string | null = null;
    if (source.kind === "static") {
        visible = lowercaseQuery ? source.items.filter(item => source.matches(item, lowercaseQuery)) : source.items;
    } else if (!lowercaseQuery) {
        visible = Array.from(selected.values());
        message = "Type to search…";
    } else if (remoteResults === undefined) {
        message = "Searching…";
    } else if (remoteResults === null) {
        message = "Too many matches — refine your search";
    } else if (remoteResults.length === 0) {
        message = "No matches";
    } else {
        visible = remoteResults;
    }

    return (
        <div className="flex flex-col gap-2">
            <TextInput value={query} onChange={e => handleQueryChange(e.target.value)} placeholder={placeholder} />
            {visible.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {visible.map(item => renderItem(item, selected.has(item.id), () => toggle(item)))}
                </div>
            )}
            {message && <p className="text-sm text-gray-400">{message}</p>}
            {serialize.mode === "repeated"
                ? Array.from(selected.keys()).map(id => (
                    <input key={id} type="hidden" name={serialize.name} value={id} />
                ))
                // Sorted so re-toggling an item (which moves it to the end of the Map's insertion
                // order) doesn't change the serialized string — otherwise EntityForm's dirty check
                // would see a "change" even though the selected set is identical to the original
                : <input type="hidden" name={serialize.name} value={Array.from(selected.keys()).sort((a, b) => a - b).join(",")} />}
        </div>
    );
}

/** Multi-select of tags as toggleable TagChips, searchable by name, serialized as repeated `tag_ids` inputs. */
export function TagsSelect({ options, defaultSelectedIds }: { options: Array<TagOption>, defaultSelectedIds: Array<number> }) {
    return (
        <RelationSelect
            defaultSelected={options.filter(tag => defaultSelectedIds.includes(tag.id))}
            source={{ kind: "static", items: options, matches: (tag, q) => tag.name.toLowerCase().includes(q) }}
            serialize={{ name: "tag_ids", mode: "repeated" }}
            placeholder="Search tags…"
            renderItem={(tag, isSelected, toggle) => {
                const hexColor = colorToHex(tag.color);
                return (
                    <TagChip
                        key={tag.id}
                        id={tag.id}
                        name={tag.name}
                        description={tag.description}
                        bgColorCSS={isSelected ? hexColor : "#374151"}
                        holeColorCSS={isSelected ? "#111827" : hexColor}
                        onClick={toggle}
                    />
                );
            }}
        />
    );
}

/**
 * Multi-select of persons as toggleable SmallPerson pills, serialized as repeated `person_ids`
 * inputs. Display names aren't stored, so the full list isn't preloaded — persons are searched
 * server-side (searchPersons) as the user types, and only the current selection is shown while
 * the search box is empty.
 */
export function PersonsSelect({ defaultSelected }: { defaultSelected: Array<PersonOption> }) {
    return (
        <RelationSelect
            defaultSelected={defaultSelected}
            source={{ kind: "remote", search: searchPersons }}
            serialize={{ name: "person_ids", mode: "repeated" }}
            placeholder="Search persons…"
            renderItem={(person, isSelected, toggle) => (
                <button key={person.id} type="button" onClick={toggle} className="cursor-pointer">
                    <SmallPerson
                        id={person.id}
                        type={person.type}
                        playerdata={person.data}
                        name={person.displayName}
                        isLink={false}
                        bgColor={isSelected ? "bg-indigo-700" : undefined}
                    />
                </button>
            )}
        />
    );
}

/**
 * Multi-select of related events as toggleable SmallerEvent pills, serialized as a single
 * comma-joined `related_event_ids` input (parseEventFormFields splits on ','). There are too many
 * events to preload, so options are searched server-side (searchEvents) as the user types, and
 * only the current selection is shown while the search box is empty.
 *
 * @param excludeId - Optional event id filtered out of the search results — an event must not be
 *   relatable to itself (the gateway rejects it too).
 */
export function RelatedEventsSelect({ defaultSelected, excludeId }: { defaultSelected: Array<EventOption>, excludeId?: number }) {
    // Stable identity so RelationSelect's debounce effect doesn't re-arm on unrelated re-renders
    const search = useCallback(async (query: string) => {
        const results = await searchEvents(query);
        return results === null || excludeId === undefined
            ? results
            : results.filter(event => event.id !== excludeId);
    }, [excludeId]);

    return (
        <RelationSelect
            defaultSelected={defaultSelected}
            source={{ kind: "remote", search }}
            serialize={{ name: "related_event_ids", mode: "commaJoined" }}
            placeholder="Search events…"
            renderItem={(event, isSelected, toggle) => (
                <button key={event.id} type="button" onClick={toggle} className="cursor-pointer">
                    <SmallerEvent
                        id={event.id}
                        name={event.name}
                        isLink={false}
                        bgColor={isSelected ? "bg-indigo-700" : undefined}
                    />
                </button>
            )}
        />
    );
}
