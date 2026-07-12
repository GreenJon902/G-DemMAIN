/**
 * A single on/off switch.
 * Checked is the current state, setter is called with the flipped state when clicked.
 * The optional label is shown before the switch; title is an optional tooltip for the whole control.
 * The optional className is for the container node.
 */
export default function ToggleButton({
    checked, setter, label, title, className = ""
}: {
    checked: boolean,
    setter: (checked: boolean) => void,
    label?: string,
    title?: string,
    className?: string
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            title={title}
            onClick={() => setter(!checked)}
            className={`flex cursor-pointer items-center gap-2 ${className}`}
        >
            {label && <span className="flex-1 text-left">{label}</span>}
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-green-600" : "bg-gray-700"}`}>
                <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
            </span>
        </button>
    );
}
