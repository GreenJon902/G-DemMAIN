/**
 * A label indicating that some data is missing (e.g. the underlying file or folder doesn't exist yet).
 * @param prefix - What's missing, prepended to "data is missing!" (e.g. "CGroup process" -> "CGroup process data is missing!"). Omit for a generic "Data missing!".
 */
export default function LabelDataMissing({ prefix }: { prefix?: string }) {
    return (
        <span className="block text-base text-white italic">
            {prefix ? `${prefix} data is missing!` : "Data missing!"}
        </span>
    );
}
