import { diffWordsWithSpace } from "diff";

/** Renders a word-level diff over two strings: insertions green, deletions red+strikethrough, unchanged plain. */
export default function RenderedWordDiff({ before, after }: { before: string; after: string }) {
    const parts = diffWordsWithSpace(before, after);
    return (
        <>
            {parts.map((part, i) => {
                if (part.added) return <ins key={i} className="bg-green-900/60 text-green-200 no-underline">{part.value}</ins>;
                if (part.removed) return <del key={i} className="bg-red-900/60 text-red-200 line-through">{part.value}</del>;
                return <span key={i}>{part.value}</span>;
            })}
        </>
    );
}
