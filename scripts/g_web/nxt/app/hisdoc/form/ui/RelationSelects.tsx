"use client";

import { ReactElement, useState } from "react";
import { TagChip } from "../../ui/TagChip";
import { colorToHex } from "../../lib/color";
import type { TagOption, PersonOption, EventOption } from "../lib/formFields";

/**
 * Generic multi-select over a list of relation items, rendered as toggleable chips/buttons.
 * Owns the selection set and serializes it into the surrounding form via hidden inputs.
 *
 * @param items - All selectable items.
 * @param defaultSelectedIds - Ids selected when the form first renders.
 * @param serialize - How the selection enters FormData: `repeated` emits one hidden input named
 *   `name` per selected id; `commaJoined` emits a single hidden input with a comma-joined id list.
 * @param renderItem - Renders one item's toggle control; must set `key={item.id}`.
 */
function RelationSelect<T extends { id: number }>({ items, defaultSelectedIds, serialize, renderItem }: {
    items: Array<T>,
    defaultSelectedIds: Array<number>,
    serialize: { name: string, mode: "repeated" | "commaJoined" },
    renderItem: (item: T, isSelected: boolean, toggle: () => void) => ReactElement
}) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(defaultSelectedIds));

    /** Toggles one id's selection state. */
    function toggle(id: number) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
                {items.map(item => renderItem(item, selectedIds.has(item.id), () => toggle(item.id)))}
            </div>
            {serialize.mode === "repeated"
                ? Array.from(selectedIds).map(id => (
                    <input key={id} type="hidden" name={serialize.name} value={id} />
                ))
                : <input type="hidden" name={serialize.name} value={Array.from(selectedIds).join(",")} />}
        </div>
    );
}

/** Multi-select of tags as toggleable TagChips, serialized as repeated `tag_ids` inputs. */
export function TagsSelect({ options, defaultSelectedIds }: { options: Array<TagOption>, defaultSelectedIds: Array<number> }) {
    return (
        <RelationSelect
            items={options}
            defaultSelectedIds={defaultSelectedIds}
            serialize={{ name: "tag_ids", mode: "repeated" }}
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

/** Multi-select of persons as toggle buttons, serialized as repeated `person_ids` inputs. */
export function PersonsSelect({ options, defaultSelectedIds }: { options: Array<PersonOption>, defaultSelectedIds: Array<number> }) {
    return (
        <RelationSelect
            items={options}
            defaultSelectedIds={defaultSelectedIds}
            serialize={{ name: "person_ids", mode: "repeated" }}
            renderItem={(person, isSelected, toggle) => (
                <button
                    key={person.id}
                    type="button"
                    onClick={toggle}
                    className={`flex items-center gap-2 rounded px-3 py-1 text-sm text-white ${isSelected ? "bg-indigo-700" : "bg-gray-700"}`}
                >
                    {person.displayName}
                    <span className="text-xs text-gray-300">{person.type}</span>
                </button>
            )}
        />
    );
}

/**
 * Multi-select of related events as toggle buttons, serialized as a single comma-joined
 * `related_event_ids` input (parseEventFormFields splits on ',').
 */
export function RelatedEventsSelect({ options, defaultSelectedIds }: { options: Array<EventOption>, defaultSelectedIds: Array<number> }) {
    return (
        <RelationSelect
            items={options}
            defaultSelectedIds={defaultSelectedIds}
            serialize={{ name: "related_event_ids", mode: "commaJoined" }}
            renderItem={(event, isSelected, toggle) => (
                <button
                    key={event.id}
                    type="button"
                    onClick={toggle}
                    className={`rounded px-3 py-1 text-sm text-white ${isSelected ? "bg-indigo-700" : "bg-gray-700"}`}
                >
                    {event.name}
                </button>
            )}
        />
    );
}
