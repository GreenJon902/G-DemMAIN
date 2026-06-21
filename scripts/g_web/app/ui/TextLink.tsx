import Link from "next/link";
import { ComponentProps } from "react";

export default function TextLink({ className="", ...props }: ComponentProps<typeof Link>) {
    return (
        <Link 
            className={`${className} underline decoration-dotted`}
            {...props}
        />
    );
}
