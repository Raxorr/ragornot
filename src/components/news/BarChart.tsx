interface BarChartDatum {
  label: string;
  value: number;
  displayValue: string;
}

interface BarChartProps {
  title: string;
  unitLabel: string;
  data: BarChartDatum[];
}

// Hand-rolled horizontal bar chart for a single measure across a handful of
// named categories. Per dataviz guidance: this is a magnitude comparison
// (one series across nominal categories, not several series to tell apart),
// so it takes the sequential/one-hue treatment — every bar is the same
// accent fill, identity comes from the row label, and the value is always
// printed as text so nothing depends on color alone.
export default function BarChart({ title, unitLabel, data }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 0.0001);
  const rowHeight = 40;
  const chartHeight = data.length * rowHeight;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold text-text">{title}</figcaption>
      {/* Decorative — the sr-only table below is the accessible data source. */}
      <svg
        aria-hidden="true"
        viewBox={`0 0 100 ${chartHeight}`}
        preserveAspectRatio="none"
        className="h-auto w-full"
      >
        {data.map((d, i) => {
          const y = i * rowHeight;
          // Reserve enough room after the longest possible bar for an
          // 8-9 character mono value label — a bar at 100% of barMaxWidth
          // still leaves ~30 viewBox units for its label before the edge.
          const barMaxWidth = 38;
          const width = Math.max((d.value / max) * barMaxWidth, 1.5);
          return (
            <g key={d.label}>
              <line
                x1={30}
                y1={y + rowHeight - 8}
                x2={30}
                y2={y + 6}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
              <rect x={30} y={y + 10} width={width} height={10} rx={3} fill="var(--accent)" />
              <text x={28} y={y + 18} textAnchor="end" fontSize={4.2} fill="var(--text)">
                {d.label}
              </text>
              <text
                x={30 + width + 2}
                y={y + 18}
                textAnchor="start"
                fontSize={4.2}
                fill="var(--text)"
                fontFamily="var(--font-jetbrains-mono)"
              >
                {d.displayValue}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Mode</th>
            <th scope="col">{unitLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.displayValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
