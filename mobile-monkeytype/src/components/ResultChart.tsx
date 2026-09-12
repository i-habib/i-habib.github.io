import type { PaceSample } from "../types";

export function ResultChart({ samples }: { samples: PaceSample[] }) {
  const points = samples.length > 1 ? samples : [{ second: 0, wpm: 0, raw: 0, errors: 0 }, ...samples];
  const width = 700;
  const height = 230;
  const max = Math.max(20, ...points.flatMap((sample) => [sample.wpm, sample.raw]));
  const makePath = (key: "wpm" | "raw") => points.map((point, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
    const y = height - (point[key] / max) * (height - 34) - 8;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const wpmPath = makePath("wpm");
  const rawPath = makePath("raw");

  return (
    <div className="result-chart-wrap">
      <svg className="result-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Words per minute over the test">
        <path className="chart-grid" d="M0 40H700 M0 98H700 M0 156H700 M0 214H700" />
        <path className="chart-raw" d={rawPath} />
        <path className="chart-wpm" d={wpmPath} />
        {points.map((point, index) => point.errors > 0 && (
          <circle
            key={`${point.second}-${index}`}
            className="chart-error"
            cx={points.length <= 1 ? 0 : (index / (points.length - 1)) * width}
            cy={height - 5}
            r={3.5}
          />
        ))}
      </svg>
      <div className="chart-legend"><span className="wpm">wpm</span><span className="raw">raw</span><span className="errors">errors</span></div>
    </div>
  );
}
