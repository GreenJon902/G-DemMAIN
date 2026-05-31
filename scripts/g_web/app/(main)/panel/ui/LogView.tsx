/**
 * @param lineNoStart - The line number of the first item in `lines`.
 */
export default function LogView({
    lines,
    className = "",
    lineNoStart = 1
}: {
    lines: string[],
    className?: string,
    lineNoStart?: number,
}) {
    return (
        <div className={`rounded-md bg-gray-950 p-1 ${className}`}>
            <pre className="text-wrap break-all">
                {lines.map((line, i, a) => (
                    <span 
                        key={i}
                        className="block"
                    >
                        <span className="text-gray-700">
                            {String(lineNoStart + i).padStart(String(a.length).length)}.
                        </span>
                        &nbsp;
                        {line}
                    </span>
                ))}
            </pre>
        </div>
    );
}
