import type { RunSummary } from "../progress/types";

interface ProgressChartProps {
  runs: RunSummary[];
  metric: "wpm" | "accuracy";
}

export function ProgressChart({ runs, metric }: ProgressChartProps) {
  const points = runs.slice(0, 30).reverse();
  if (!points.length) {
    return (
      <div className="progress-chart-empty">
        <span>—</span>
        <p>complete a standard test to draw your trend.</p>
      </div>
    );
  }

  const width = 700;
  const height = 210;
  const values = points.map((run) => metric === "wpm" ? run.wpm : run.accuracy);
  const rolling = values.map((_, index) => {
    const window = values.slice(Math.max(0, index - 4), index + 1);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
  const floor = metric === "accuracy" ? Math.max(0, Math.min(...values, ...rolling) - 5) : 0;
  const ceiling = metric === "accuracy" ? 100 : Math.max(20, ...values, ...rolling) * 1.08;
  const pointAt = (value: number, index: number) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - 14 - ((value - floor) / Math.max(1, ceiling - floor)) * (height - 28);
    return { x, y };
  };
  const path = (series: number[]) => series.map((value, index) => {
    const point = pointAt(value, index);
    return `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="progress-chart-wrap">
      <svg className="progress-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${metric} across your last ${points.length} comparable tests`}>
        <path className="chart-grid" d="M0 14H700 M0 105H700 M0 196H700" />
        {points.length > 1 && <path className="progress-average" d={path(rolling)} />}
        {points.length > 1 && <path className="progress-series" d={path(values)} />}
        {points.map((run, index) => {
          const point = pointAt(values[index], index);
          return <circle className="progress-dot" key={run.id} cx={point.x} cy={point.y} r={points.length === 1 ? 6 : 3.5} />;
        })}
      </svg>
      <div className="chart-legend"><span className="wpm">{metric}</span><span className="average">5-test average</span></div>
    </div>
  );
}
