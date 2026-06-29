"use client";

import { useState } from "react";

interface Tag {
    id: number;
    /** Display name shown on the button. */
    name: string;
    /** Packed RGB integer, e.g. 0xFF8800 for orange. */
    color: number;
}

/**
 * A tag multi-selector for use inside an HTML <form>.
 *
 * Each tag is rendered as a toggleable button. Selected tag IDs are serialised
 * as hidden fields named `tag_ids`, so `formData.getAll('tag_ids')` returns the
 * full selection as an array of numeric strings on submission.
 *
 * @param tags - The full list of available tags to display.
 * @param defaultSelected - Tag IDs that should be pre-selected (e.g. when editing a record).
 */
export default function TagSelector({
    tags,
    defaultSelected
}: {
    tags: Tag[];
    defaultSelected?: number[];
}) {
    const [selected, setSelected] = useState<Set<number>>(
        () => new Set(defaultSelected ?? [])
    );

    function toggle(id: number) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    return (
        <div className="flex flex-wrap gap-2">
            {tags.map(tag => {
                const hexColor = "#" + (tag.color >>> 0).toString(16).padStart(6, "0");
                const isSelected = selected.has(tag.id);

                return (
                    <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggle(tag.id)}
                        className={
                            isSelected
                                ? "rounded border border-transparent px-3 py-1 text-sm font-medium text-white"
                                : "rounded border-l-4 border-transparent bg-gray-700 px-3 py-1 text-sm font-medium text-gray-400"
                        }
                        style={
                            isSelected
                                ? { backgroundColor: hexColor }
                                : { borderLeftColor: hexColor }
                        }
                    >
                        {tag.name}
                    </button>
                );
            })}

            {/* One hidden field per selected tag — formData.getAll('tag_ids') collects them all */}
            {Array.from(selected).map(id => (
                <input key={id} type="hidden" name="tag_ids" value={id.toString()} />
            ))}
        </div>
    );
}
