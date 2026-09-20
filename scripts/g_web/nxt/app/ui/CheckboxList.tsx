/**
 * Checkboxes for multi-selecting from the given choices.
 * Selected is the current array of chosen values, compared by nameConv (as with RadioButtons) since choices may not be reference-comparable.
 * The setter is called with the full new selection array whenever a checkbox is toggled.
 * NameConv maps from the choice-value to the text (and id/name attribute) for its checkbox.
 * The optional className is for the container node.
 */
export default function CheckboxList<T>({
    choices, selected, setter, nameConv, className = ""
}: {
    choices: T[],
    selected: T[],
    setter: (opts: T[]) => void,
    nameConv: (opt: T) => string,
    className?: string
}) {
    const selectedNames = selected.map(nameConv);

    return (
        <div className={className}>
            {
                choices.map(c => {
                    const cname = nameConv(c);
                    return (
                        <div key={cname}>
                            <input
                                type="checkbox"
                                id={cname}
                                name={cname}
                                checked={selectedNames.includes(cname)}
                                onChange={event => (event.currentTarget.checked) ?
                                    setter([...selected, c])
                                    :
                                    setter(selected.filter(s => nameConv(s) !== cname))
                                }
                            />
                            <label htmlFor={cname}> {cname} </label>
                        </div>
                    );
                })
            }
        </div>
    );
}
