import { useMemo, useState } from "react";
import { Activity, ArrowLeft, CalendarDays, Clock3, Download, Flame, Keyboard, Laptop2, RotateCcw, Smartphone, Sparkles, Trash2, Trophy, Upload } from "lucide-react";
import { selectOverview, selectStreak } from "../progress";
import type { DeviceType } from "../types";
import type { ProgressStore, RunSummary } from "../progress";
import { ProgressChart } from "./ProgressChart";

interface ProgressPageProps {
  progress: ProgressStore;
  storageError: string | null;
  transferError: string | null;
  onNewTest: () => void;
  onClearHistory: () => void;
  onResetAll: () => void;
  onExport: () => void;
  onImport: (file: File) => Promise<void> | void;
}

function formatVariant(settings: RunSummary["settings"]) {
  if (settings.mode === "zen") return "zen";
  const amount = settings.mode === "time"
    ? `${settings.duration}s`
    : settings.mode === "words"
      ? `${settings.wordCount}`
      : settings.mode === "quote"
        ? settings.quoteLength
        : "";
  return [settings.mode, amount, settings.punctuation ? "punctuation" : "", settings.numbers ? "numbers" : ""]
    .filter(Boolean)
    .join(" ");
}

function isCompetitiveRun(run: RunSummary) {
  return !run.assisted && run.variantKey !== "";
}

function formatDuration(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function metricAverage(runs: RunSummary[], key: "wpm" | "accuracy" | "consistency") {
  if (!runs.length) return 0;
  return runs.reduce((sum, run) => sum + run[key], 0) / runs.length;
}

function shortDay(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ProgressPage({ progress, storageError, transferError, onNewTest, onClearHistory, onResetAll, onExport, onImport }: ProgressPageProps) {
  const [filter, setFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState<"all" | DeviceType>("all");
  const [metric, setMetric] = useState<"wpm" | "accuracy">("wpm");
  const [visibleRuns, setVisibleRuns] = useState(8);
  const [dangerAction, setDangerAction] = useState<"clear" | "reset" | null>(null);
  const overview = selectOverview(progress);
  const streak = selectStreak(progress);
  const recent = useMemo(
    () => progress.runs.filter((run) => (filter === "all" || run.variantKey === filter)
      && (deviceFilter === "all" || run.device === deviceFilter)),
    [deviceFilter, filter, progress.runs],
  );
  const comparable = useMemo(() => recent.filter(isCompetitiveRun), [recent]);
  const personalBests = useMemo(
    () => Object.values(progress.personalBests).sort((left, right) => right.wpm - left.wpm),
    [progress.personalBests],
  );
  const filterOptions = useMemo(() => {
    const options = new Map<string, string>();
    progress.runs.forEach((run) => {
      if (isCompetitiveRun(run) && run.variantKey) options.set(run.variantKey, formatVariant(run.settings));
    });
    return [...options.entries()];
  }, [progress.runs]);
  const deviceComparison = useMemo(() => (["computer", "mobile"] as const).map((device) => {
    const runs = progress.runs.filter((run) => run.device === device && isCompetitiveRun(run));
    return { device, tests: runs.length, wpm: metricAverage(runs, "wpm"), accuracy: metricAverage(runs, "accuracy") };
  }), [progress.runs]);
  const best = comparable.reduce((highest, run) => Math.max(highest, run.wpm), 0);
  const filtered = filter !== "all" || deviceFilter !== "all";
  const averageWpm = filtered ? metricAverage(comparable, "wpm") : overview.averageWpm;
  const averageAccuracy = filtered ? metricAverage(comparable, "accuracy") : overview.averageAccuracy;
  const averageConsistency = filtered ? metricAverage(comparable, "consistency") : overview.averageConsistency;
  const activityDays = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (13 - offset));
    const key = shortDay(date);
    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      initial: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      tests: progress.days[key]?.tests ?? 0,
    };
  });
  const maximumDaily = Math.max(1, ...activityDays.map((day) => day.tests));

  const confirm = (action: "clear" | "reset") => {
    if (dangerAction !== action) {
      setDangerAction(action);
      return;
    }
    if (action === "clear") onClearHistory();
    else onResetAll();
    setDangerAction(null);
  };

  return (
    <section className="progress-page" aria-labelledby="progress-title">
      <div className="progress-heading">
        <div>
          <span><Activity /> local profile</span>
          <h1 id="progress-title">your progress</h1>
          <p>private, on-device stats for every completed run.</p>
        </div>
        <button type="button" onClick={onNewTest}><Keyboard /> new test</button>
      </div>

      {storageError && <div className="storage-warning" role="status">progress is available now, but this browser could not save it: {storageError}</div>}
      {transferError && <div className="storage-warning" role="status">{transferError}</div>}

      {!progress.lifetime.tests ? (
        <div className="progress-empty">
          <Trophy />
          <h2>your results will appear here</h2>
          <p>Finish a time, words, or quote test to start comparing runs. Zen and custom runs still count toward activity.</p>
          <button type="button" onClick={onNewTest}>start typing</button>
        </div>
      ) : (
        <>
          <div className="progress-filter-row">
            <div className="progress-filter-selects">
              <label>
                <span>test</span>
                <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">all standard tests</option>
                  {filterOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>device</span>
                <select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value as "all" | DeviceType)}>
                  <option value="all">computer + mobile</option>
                  <option value="computer">computer</option>
                  <option value="mobile">mobile</option>
                </select>
              </label>
            </div>
            <div className="metric-toggle" aria-label="Chart metric">
              <button type="button" className={metric === "wpm" ? "active" : ""} onClick={() => setMetric("wpm")}>wpm</button>
              <button type="button" className={metric === "accuracy" ? "active" : ""} onClick={() => setMetric("accuracy")}>accuracy</button>
            </div>
          </div>

          <div className="progress-hero">
            <div className="progress-hero-values">
              <div><span>personal best</span><strong>{Math.round(best)}</strong><small>wpm</small></div>
              <div><span>average</span><strong>{Math.round(averageWpm)}</strong><small>wpm</small></div>
              <div><span>accuracy</span><strong>{Math.round(averageAccuracy)}%</strong><small>average</small></div>
              <div><span>streak</span><strong>{streak.current}</strong><small>{streak.current === 1 ? "day" : "days"}</small></div>
            </div>
            <ProgressChart runs={comparable} metric={metric} />
          </div>

          <div className="progress-stats">
            <div><Keyboard /><span>tests</span><strong>{overview.tests}</strong><small>{overview.validTests} comparable</small></div>
            <div><Clock3 /><span>typing time</span><strong>{formatDuration(overview.timeMs)}</strong><small>{overview.typedChars.toLocaleString()} characters</small></div>
            <div><Sparkles /><span>autocorrections</span><strong>{overview.fixes}</strong><small>{overview.fixesPerHundredWords.toFixed(1)} per 100 words</small></div>
            <div><Activity /><span>consistency</span><strong>{Math.round(averageConsistency)}%</strong><small>average</small></div>
          </div>

          <section className="device-comparison" aria-labelledby="device-comparison-title">
            <div className="section-title"><div><Laptop2 /><span id="device-comparison-title">computer vs mobile</span></div><small>standard, unassisted runs</small></div>
            <div className="device-comparison-grid">
              {deviceComparison.map((item) => (
                <article className="device-card" key={item.device}>
                  <div className="device-card-title">{item.device === "mobile" ? <Smartphone /> : <Laptop2 />}<strong>{item.device}</strong></div>
                  <div><strong>{item.tests ? Math.round(item.wpm) : "—"}</strong><span>avg wpm</span></div>
                  <div><strong>{item.tests ? `${Math.round(item.accuracy)}%` : "—"}</strong><span>avg accuracy</span></div>
                  <small>{item.tests ? `${item.tests} ${item.tests === 1 ? "run" : "runs"}` : "no runs yet"}</small>
                </article>
              ))}
            </div>
          </section>

          <div className="activity-section">
            <div className="section-title"><div><CalendarDays /><span>last 14 days</span></div><small>best streak {streak.best}d</small></div>
            <div className="activity-strip">
              {activityDays.map((day) => (
                <div key={day.key} title={`${day.label}: ${day.tests} tests`}>
                  <span style={{ opacity: day.tests ? .28 + (day.tests / maximumDaily) * .72 : .1 }} />
                  <small>{day.initial}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="progress-columns">
            <section className="pb-section" aria-labelledby="pb-title">
              <div className="section-title"><div><Trophy /><span id="pb-title">personal bests</span></div><small>best across devices</small></div>
              {personalBests.length ? personalBests.slice(0, 8).map((item) => (
                <article className="pb-row" key={item.variantKey}>
                  <div><strong>{formatVariant(item.settings)}</strong><small>{new Date(item.achievedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small></div>
                  <div><strong>{item.wpm}</strong><span>wpm</span></div>
                  <div><strong>{item.accuracy}%</strong><span>acc</span></div>
                </article>
              )) : <p className="section-empty">standard, unassisted tests create personal bests.</p>}
            </section>

            <section className="recent-section" aria-labelledby="recent-title">
              <div className="section-title"><div><Flame /><span id="recent-title">recent tests</span></div><small>{recent.length} saved</small></div>
              {recent.slice(0, visibleRuns).map((run) => (
                <article className="recent-row" key={run.id}>
                  <div><strong>{run.wpm}</strong><span>wpm</span></div>
                  <div><strong>{run.accuracy}%</strong><span>acc</span></div>
                  <div className="recent-description"><strong>{formatVariant(run.settings)}</strong><span>{run.device} · {new Date(run.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{run.assisted ? " · assisted" : ""} · {run.fixes} fixes</span></div>
                </article>
              ))}
              {!recent.length && <p className="section-empty">no recent tests match this filter.</p>}
              {visibleRuns < recent.length && <button className="show-more" type="button" onClick={() => setVisibleRuns((value) => value + 12)}>show more</button>}
            </section>
          </div>
        </>
      )}

      <section className="progress-transfer" aria-labelledby="transfer-title">
        <div className="section-title"><div><Download /><span id="transfer-title">data</span></div><small>move it between browsers</small></div>
        <p>Export a Thumbtype backup, or import a Thumbtype JSON or Monkeytype account CSV.</p>
        <div className="transfer-actions">
          <button type="button" onClick={onExport}><Download /> export data</button>
          <label className="import-button"><Upload /> import data<input type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); event.target.value = ""; }} /></label>
        </div>
      </section>

      <div className="progress-danger">
        <button type="button" onClick={() => confirm("clear")}><Trash2 /> {dangerAction === "clear" ? "tap again to clear the visible run list" : "clear recent history"}</button>
        <button type="button" onClick={() => confirm("reset")}><RotateCcw /> {dangerAction === "reset" ? "tap again to reset every stat" : "reset all progress"}</button>
        {dangerAction && <button className="danger-cancel" type="button" onClick={() => setDangerAction(null)}><ArrowLeft /> cancel</button>}
      </div>
    </section>
  );
}
