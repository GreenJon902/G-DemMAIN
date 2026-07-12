/**
 * Radio buttons with the given choices.
 * Selected is selected by default, this is expected to be a valid choice.
 * The setter is called when the option is changed, however this does not optimistically update what is checked.
 * NameConv maps from the choice-value to the text to put on the button.
 * The optional titleConv maps from the choice-value to a tooltip (html "title") for its button.
 * The optional className is for the container node.
 * The optional lightBg bumps the whole colour scheme one shade brighter, for use against a
 * lighter container background where the default colours would otherwise blend in.
 */
export default function RadioButtons<T>({
    choices, selected, setter, nameConv, titleConv, className="", lightBg=false
}: {
    choices: T[],
    selected: T,
    setter: (opt: T) => void,
    nameConv: (opt: T) => string,
    titleConv?: (opt: T) => string,
    className?: string,
    lightBg?: boolean
}) {
    const selectedCName = nameConv(selected);
    const selectedClass = lightBg ? "border border-white bg-gray-600" : "border border-white bg-gray-700";
    const unselectedClass = lightBg
        ? "border-gray-600 bg-gray-700 not-last:border-r hover:bg-gray-600"
        : "border-gray-700 bg-gray-800 not-last:border-r hover:bg-gray-700";

    return (
        <div className={`flex ${className}`}>
            {
                choices
                    .map(c => ({c: c, cname: nameConv(c)}))
                    .map((({c, cname}) => (
                        <button
                            // Compare cnames as we can't compare objects
                            className={`flex-1 first:rounded-l-md last:rounded-r-md cursor-pointer p-1 ${(cname === selectedCName) ? selectedClass : unselectedClass}`}
                            key={cname}
                            title={titleConv?.(c)}
                            onClick={() => setter(c)}
                        >
                            {cname}
                        </button>
                    )))
            }
        </div>
    );
}
