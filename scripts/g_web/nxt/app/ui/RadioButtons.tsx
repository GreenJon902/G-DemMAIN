/**
 * Radio buttons with the given choices.
 * Selected is selected by default, this is expected to be a valid choice.
 * The setter is called when the option is changed, however this does not optimistically update what is checked.
 * NameConv maps from the choice-value to the text to put on the button.
 * The optional className is for the container node.
 */
export default function RadioButtons<T>({
    choices, selected, setter, nameConv, className=""
}: {
    choices: T[],
    selected: T,
    setter: (opt: T) => void,
    nameConv: (opt: T) => string,
    className?: string
}) {
    const selectedCName = nameConv(selected);

    return (
        <div className={`flex ${className}`}>
            {
                choices
                    .map(c => ({c: c, cname: nameConv(c)}))
                    .map((({c, cname}) => (
                        <button 
                            // Compare cnames as we can't compare objects
                            className={`flex-1 first:rounded-l-md last:rounded-r-md ${(cname === selectedCName) ? "border border-white bg-gray-700" : "border-gray-700 bg-gray-800 not-last:border-r"} cursor-pointer p-1 hover:bg-gray-700`}
                            key={cname}
                            onClick={() => setter(c)}
                        >
                            {cname}
                        </button>
                    )))
            }
        </div>
    );
}
