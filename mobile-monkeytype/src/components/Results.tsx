import { BarChart3, Clipboard, FastForward, RotateCcw, Share2, Sparkles } from "lucide-react";
import type { RunResult } from "../types";
import { ResultChart } from "./ResultChart";

interface ResultsProps {
  result: RunResult;
  bestWpm: number | null;
  isNewBest: boolean;
  onNext: () => void;
  onRepeat: () => void;
  onProgress: () => void;
}

function formatTestType(result: RunResult) {
  const { settings } = result;
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

export function Results({ result, bestWpm, isNewBest, onNext, onRepeat, onProgress }: ResultsProps) {
  const share = async () => {
    const text = `thumbtype ${result.settings.mode} — ${result.wpm} wpm — ${result.accuracy}% acc — ${result.fixes} detected fixes`;
    try {
      if (navigator.share) await navigator.share({ title: "thumbtype result", text });
      else await navigator.clipboard.writeText(text);
    } catch (error) {
      if ((error as Error).name !== "AbortError") console.warn("Could not share result", error);
    }
  };
  const characters = [result.correct, result.incorrect, result.extra, result.missed].join("/");
  return (
    <section className="results-page" aria-labelledby="results-title">
      <h1 id="results-title" className="sr-only">Typing test result</h1>
      <div className="result-primary">
        <div className="hero-stats">
          <div className="hero-stat"><span>wpm</span><strong>{result.wpm}</strong></div>
          <div className="hero-stat"><span>acc</span><strong>{result.accuracy}%</strong></div>
          {bestWpm != null && <p>{isNewBest ? "new personal best" : `${bestWpm} personal best for this test`}</p>}
        </div>
        <ResultChart samples={result.samples} />
      </div>

      <div className="result-secondary">
        <div><span>test type</span><strong>{formatTestType(result)}</strong><small>english</small></div>
        <div><span>device</span><strong>{result.device}</strong><small>run source</small></div>
        <div><span>raw</span><strong>{result.rawWpm}</strong></div>
        <div><span>characters</span><strong className="character-count"><i>{characters}</i></strong><small>correct/incorrect/extra/missed</small></div>
        <div><span>consistency</span><strong>{result.consistency}%</strong></div>
        <div><span>time</span><strong>{(result.elapsedMs / 1000).toFixed(1)}s</strong><small>{result.assisted ? "assisted" : "native input"}</small></div>
        <div className="fix-result"><span>autocorrected</span><strong><Sparkles /> {result.fixes}</strong><small>detected fixes</small></div>
      </div>

      <div className="result-actions">
        <button className="next-test" type="button" onClick={onNext}><FastForward /> next test</button>
        <button type="button" onClick={onRepeat} aria-label="Repeat test"><RotateCcw /></button>
        <button type="button" onClick={share} aria-label="Share result"><Share2 /></button>
        <button type="button" onClick={() => navigator.clipboard?.writeText(`${result.wpm} wpm`)} aria-label="Copy result"><Clipboard /></button>
        <button type="button" onClick={onProgress} aria-label="View progress"><BarChart3 /></button>
      </div>

      <p className="result-note">
        {result.fixes > 0
          ? `your keyboard made ${result.fixes} likely ${result.fixes === 1 ? "correction" : "corrections"}.`
          : "no keyboard corrections were detected in this run."}
      </p>
    </section>
  );
}
