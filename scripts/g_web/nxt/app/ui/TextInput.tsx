import { ComponentProps } from "react";

/**
 * A standardly-styled text input element.
 * @param name - Optional value for the html "name" and "id" tags.
 * @param label - Optional label value to be placed before the text. This label will be given "flex and gap-2 flex-wrap", and if a name is given then it will be passed to the label too.
 * @param password - Is this a password field.
 * @param props - Any extra props to be given to the input element.
 */
export default function TextInput({
    // If not given then defaults to undefined
    name,
    label,
    password=false,
    ...props
}: {
    name?: string,
    label?: string,
    password?: boolean
} & Omit<ComponentProps<"input">, "text" | "id" | "type" | "className">) {
    const input = (<input
        type={password ? "password" : "text"}
        className="flex-1 rounded-md bg-gray-600 px-1 outline-none focus:bg-gray-700" 

        name={name}
        id={name}
        {...props}
    />);

    if (label) {
        return (
            <label 
                className="flex flex-wrap gap-2" 
                htmlFor={name}
            >
                {label}: {input}
            </label>
        );
    } else {
        return input;
    }
}
