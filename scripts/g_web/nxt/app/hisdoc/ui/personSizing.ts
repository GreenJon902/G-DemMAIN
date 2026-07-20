// Shared sizing constants so LargePerson's box (and its skin canvas) line up as an exact multiple
// of SmallPerson's box, including the gaps between them, when the persons page packs them together
// into a multi-column brick-wall layout.

// SmallPerson's rendered height (h-8): a 24px (size-6) playerhead plus 4px (py-1) padding on top and bottom
export const SMALL_PERSON_HEIGHT = 32;

// Gap (px) left between adjacent tiles in the brick-wall layout
export const PERSON_GAP = 16;

// How many SmallPerson rows (plus the gaps between them) LargePerson's height should match
export const LARGE_PERSON_STACK = 5;

export const LARGE_PERSON_HEIGHT = LARGE_PERSON_STACK * SMALL_PERSON_HEIGHT + (LARGE_PERSON_STACK - 1) * PERSON_GAP;

// Chrome inside LargePerson's box, around the skin canvas: px-2 py-1 padding (4px top, 4px bottom)
// plus gap-1 (4px) before the text-sm name row (20px line-height)
const LARGE_PERSON_VERTICAL_CHROME = 4 + 4 + 4 + 20;

export const SKIN_HEIGHT = LARGE_PERSON_HEIGHT - LARGE_PERSON_VERTICAL_CHROME;
export const SKIN_WIDTH = Math.round(SKIN_HEIGHT * 0.6);
