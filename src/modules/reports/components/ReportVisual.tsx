import type {ReportChart} from '../../../api'

export default function ReportVisual({
  chart,
  onDrill,
}: {
  chart: ReportChart;
  onDrill: (field: string, value: string) => void;
}) {
  const series = chart.series || [],
    max = Math.max(
      1,
      ...series.flatMap((item) => [
        Number(item.value || 0),
        Number(item.received || 0),
        Number(item.completed || 0),
      ]),
    );
  if (!series.length)
    return (
      <div className="report-no-data">
        No data available for the selected reporting period.
      </div>
    );
  if (chart.type === "donut") {
    const total = series.reduce(
      (sum, item) => sum + Number(item.value || 0),
      0,
    );
    return (
      <div className="report-donut-layout">
        <div
          className="report-donut"
          style={{
            background: `conic-gradient(${series.map((_, index) => `var(--report-${index % 6}) ${(series.slice(0, index).reduce((n, row) => n + Number(row.value || 0), 0) * 100) / Math.max(1, total)}% ${(series.slice(0, index + 1).reduce((n, row) => n + Number(row.value || 0), 0) * 100) / Math.max(1, total)}%`).join(",")})`,
          }}
        >
          <b>{total}</b>
          <span>Total</span>
        </div>
        <div>
          {series.map((item, index) => (
            <button
              key={item.label}
              onClick={() =>
                chart.drillField && onDrill(chart.drillField, item.label)
              }
            >
              <i style={{ background: `var(--report-${index % 6})` }} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (chart.type === "line") {
    const points = series
      .map(
        (item, index) =>
          `${series.length === 1 ? 50 : (index * 100) / (series.length - 1)},${100 - (Number(item.value ?? item.completed ?? 0) * 90) / max}`,
      )
      .join(" ");
    return (
      <div className="report-line">
        <svg viewBox="0 0 100 110" role="img" aria-label={chart.title}>
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          {series.map((item, index) => (
            <circle
              key={item.label}
              cx={
                series.length === 1 ? 50 : (index * 100) / (series.length - 1)
              }
              cy={100 - (Number(item.value ?? item.completed ?? 0) * 90) / max}
              r="2.3"
            />
          ))}
        </svg>
        <div>
          {series.map((item) => (
            <span key={item.label}>
              {item.label}
              <b>
                {item.value ?? `${item.received || 0}/${item.completed || 0}`}
              </b>
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`report-bars ${chart.type}`}>
      {series.map((item) => (
        <button
          key={item.label}
          onClick={() =>
            chart.drillField && onDrill(chart.drillField, item.label)
          }
        >
          <span>{item.label}</span>
          <i>
            <b style={{ width: `${(Number(item.value || 0) * 100) / max}%` }} />
          </i>
          <strong>{item.value}</strong>
        </button>
      ))}
    </div>
  );
}
