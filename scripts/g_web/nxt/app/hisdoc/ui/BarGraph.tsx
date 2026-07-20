type Bar = { label: string; value: number; color: string };  // color is a CSS hex string, e.g. "#ff0000"


/**
 * An SVG bar chart for displaying event-count-per-tag data.
 * Bar colours are dynamic hex values sourced from the database at request time, so Tailwind
 * colour classes cannot be used for bar fills — inline SVG fill attributes are used instead.
 *
 * @param bars - The data to render. If empty, a "No data" placeholder is shown instead of the chart.
 * @param graphClassName - className applied to the SVG element; should specify a height (e.g. "h-48").
 * @param containerClassName - className applied to the outer wrapper div.
 */
export function BarGraph({
    bars,
    graphClassName = "",
    containerClassName = ""
}: {
    bars: Bar[];
    graphClassName?: string;
    containerClassName?: string;
}) {
    if (bars.length === 0) {
        return <p className="text-gray-400">No data</p>;
    }

    // SVG coordinate space constants
    const leftMargin = 30;   // space reserved for y-axis tick labels
    const topPadding = 10;
    const chartHeight = 100; // vertical extent of the bar area
    const labelArea = 20;    // space below bars for bar labels
    const barWidth = 50;     // horizontal units allocated to each bar
    const totalWidth = leftMargin + barWidth * bars.length;
    const totalHeight = topPadding + chartHeight + labelArea;

    const maxValue = Math.ceil(Math.max(...bars.map(b => b.value), 1));
    const gridLines = Array.from({ length: maxValue + 1 }, (_, i) => i);

    /** Maps a data value to its y coordinate in SVG space (top-anchored). */
    const toY = (value: number) => topPadding + chartHeight * (1 - value / maxValue);

    return (
        <div className={containerClassName}>
            <svg
                viewBox={`0 0 ${totalWidth} ${totalHeight}`}
                preserveAspectRatio="none"
                className={graphClassName}
                width="100%"
            >
                {/* Full background */}
                <rect x={0} y={0} width={totalWidth} height={totalHeight} fill="#1f2937" />

                {/* Horizontal grid lines at each integer step on the y-axis */}
                {gridLines.map(i => (
                    <line
                        key={i}
                        x1={leftMargin}
                        y1={toY(i)}
                        x2={totalWidth}
                        y2={toY(i)}
                        stroke="#374151"
                        strokeWidth={0.5}
                    />
                ))}

                {/* Y-axis integer tick labels */}
                {gridLines.map(i => (
                    <text
                        key={i}
                        x={leftMargin - 3}
                        y={toY(i) + 3}
                        textAnchor="end"
                        fill="#9ca3af"
                        fontSize={8}
                    >
                        {i}
                    </text>
                ))}

                {/* Bars and their labels */}
                {bars.map((bar, index) => {
                    const barH = chartHeight * (bar.value / maxValue);
                    const barX = leftMargin + index * barWidth + 3;
                    const barY = toY(bar.value);
                    const labelX = leftMargin + index * barWidth + barWidth / 2;
                    const labelY = topPadding + chartHeight + labelArea - 5;

                    return (
                        <g key={index}>
                            <rect
                                x={barX}
                                y={barY}
                                width={barWidth - 6}
                                height={barH}
                                fill={bar.color}
                            />
                            <text
                                x={labelX}
                                y={labelY}
                                textAnchor="middle"
                                fill="#9ca3af"
                                fontSize={8}
                            >
                                {bar.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
