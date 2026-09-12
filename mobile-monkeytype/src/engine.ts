import type { TestMode } from "./types";

export interface AlignmentOperation {
  type: "match" | "substitute" | "insert" | "delete";
  actual: string;
  expected: string;
  typedIndex: number;
  targetIndex: number;
}

export interface Alignment {
  operations: AlignmentOperation[];
  counts: Record<AlignmentOperation["type"], number>;
  distance: number;
  targetProgress: number;
  typedLength: number;
  targetLength: number;
  target: string[];
}

const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter("en", { granularity: "grapheme" })
  : null;

export function toGraphemes(value = "") {
  const normalized = value.normalize("NFC");
  if (!segmenter) return Array.from(normalized);
  return Array.from(segmenter.segment(normalized), ({ segment }) => segment);
}

export function normalizeForScoring(value = "") {
  return value
    .normalize("NFC")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n");
}

export function editDistance(leftValue: string | string[], rightValue: string | string[]) {
  const left = Array.isArray(leftValue) ? leftValue : toGraphemes(normalizeForScoring(leftValue));
  const right = Array.isArray(rightValue) ? rightValue : toGraphemes(normalizeForScoring(rightValue));
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const substitution = previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[right.length];
}

export function alignTypedToTarget(typedValue: string, targetValue: string, searchWindow = 28): Alignment {
  const typed = toGraphemes(normalizeForScoring(typedValue));
  const target = toGraphemes(normalizeForScoring(targetValue));
  const rows = typed.length;
  const maximumColumn = Math.min(target.length, typed.length + searchWindow);
  const minimumEnd = Math.min(maximumColumn, Math.max(0, typed.length - searchWindow));
  const band = Math.max(searchWindow, Math.abs(rows - maximumColumn));
  const moves: Array<Map<number, AlignmentOperation["type"]>> = Array.from(
    { length: rows + 1 },
    () => new Map(),
  );
  let previous = new Map<number, number>();
  for (let column = 0; column <= Math.min(maximumColumn, band); column += 1) {
    previous.set(column, column);
    if (column > 0) moves[0].set(column, "delete");
  }

  for (let row = 1; row <= rows; row += 1) {
    const current = new Map<number, number>();
    const columnStart = Math.max(0, row - band);
    const columnEnd = Math.min(maximumColumn, row + band);
    if (columnStart === 0) {
      current.set(0, row);
      moves[row].set(0, "insert");
    }
    for (let column = Math.max(1, columnStart); column <= columnEnd; column += 1) {
      const matches = typed[row - 1] === target[column - 1];
      const diagonal = (previous.get(column - 1) ?? Number.POSITIVE_INFINITY) + (matches ? 0 : 1);
      const insertion = (previous.get(column) ?? Number.POSITIVE_INFINITY) + 1;
      const deletion = (current.get(column - 1) ?? Number.POSITIVE_INFINITY) + 1;
      const best = Math.min(diagonal, insertion, deletion);
      if (!Number.isFinite(best)) continue;
      current.set(column, best);
      moves[row].set(column, diagonal === best ? (matches ? "match" : "substitute") : insertion === best ? "insert" : "delete");
    }
    previous = current;
  }

  let endColumn = minimumEnd;
  let endCost = previous.get(endColumn) ?? Number.POSITIVE_INFINITY;
  for (let column = minimumEnd; column <= maximumColumn; column += 1) {
    const candidate = previous.get(column) ?? Number.POSITIVE_INFINITY;
    if (candidate < endCost || (candidate === endCost && column > endColumn)) {
      endColumn = column;
      endCost = candidate;
    }
  }

  const operations: AlignmentOperation[] = [];
  let row = rows;
  let column = endColumn;
  while (row > 0 || column > 0) {
    const type = moves[row].get(column);
    if (type === "match" || type === "substitute") {
      operations.push({ type, actual: typed[row - 1], expected: target[column - 1], typedIndex: row - 1, targetIndex: column - 1 });
      row -= 1;
      column -= 1;
    } else if (type === "insert") {
      operations.push({ type, actual: typed[row - 1], expected: "", typedIndex: row - 1, targetIndex: column });
      row -= 1;
    } else {
      operations.push({ type: "delete", actual: "", expected: target[column - 1], typedIndex: row, targetIndex: column - 1 });
      column -= 1;
    }
  }
  operations.reverse();
  const counts = operations.reduce<Alignment["counts"]>((summary, operation) => {
    summary[operation.type] += 1;
    return summary;
  }, { match: 0, substitute: 0, insert: 0, delete: 0 });

  return {
    operations,
    counts,
    distance: endCost,
    targetProgress: endColumn,
    typedLength: typed.length,
    targetLength: target.length,
    target,
  };
}

export function calculateMetricsFromAlignment(alignment: Alignment, elapsedMs: number) {
  const attempted = alignment.counts.match + alignment.counts.substitute + alignment.counts.insert + alignment.counts.delete;
  const minutes = Math.max(0, elapsedMs) / 60_000;
  const wpm = minutes > 0 ? alignment.counts.match / 5 / minutes : 0;
  const rawWpm = minutes > 0 ? alignment.typedLength / 5 / minutes : 0;
  const accuracy = attempted > 0 ? (alignment.counts.match / attempted) * 100 : 100;
  return {
    alignment,
    wpm: Number.isFinite(wpm) ? wpm : 0,
    rawWpm: Number.isFinite(rawWpm) ? rawWpm : 0,
    accuracy,
    correct: alignment.counts.match,
    incorrect: alignment.counts.substitute,
    extra: alignment.counts.insert,
    missed: alignment.counts.delete,
    errors: alignment.counts.substitute + alignment.counts.insert + alignment.counts.delete,
  };
}

export function calculateMetrics(typedValue: string, targetValue: string, elapsedMs: number) {
  return calculateMetricsFromAlignment(alignTypedToTarget(typedValue, targetValue), elapsedMs);
}

export function calculateFreeTypingMetrics(typedValue: string, elapsedMs: number) {
  const typed = toGraphemes(normalizeForScoring(typedValue));
  const operations: AlignmentOperation[] = typed.map((character, index) => ({
    type: "match",
    actual: character,
    expected: character,
    typedIndex: index,
    targetIndex: index,
  }));
  const alignment: Alignment = {
    operations,
    counts: { match: typed.length, substitute: 0, insert: 0, delete: 0 },
    distance: 0,
    targetProgress: typed.length,
    typedLength: typed.length,
    targetLength: typed.length,
    target: typed,
  };
  return calculateMetricsFromAlignment(alignment, elapsedMs);
}

export function calculateSessionMetrics(typedValue: string, targetValue: string, elapsedMs: number, mode: TestMode) {
  return mode === "zen"
    ? calculateFreeTypingMetrics(typedValue, elapsedMs)
    : calculateMetrics(typedValue, targetValue, elapsedMs);
}

export function diffValues(beforeValue: string, afterValue: string) {
  const before = toGraphemes(beforeValue);
  const after = toGraphemes(afterValue);
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  return {
    start,
    removed: before.slice(start, beforeEnd).join(""),
    inserted: after.slice(start, afterEnd).join(""),
    beforeEnd,
    afterEnd,
  };
}

interface ReplacementOptions {
  inputType?: string;
  selectionCollapsed?: boolean;
  composing?: boolean;
}

export function detectHelpfulReplacement(
  beforeValue: string,
  afterValue: string,
  targetValue: string,
  options: ReplacementOptions = {},
) {
  if (options.composing) return null;
  if (options.inputType?.includes("Composition")) return null;
  const change = diffValues(beforeValue, afterValue);
  if (!change.removed && !change.inserted) return null;
  const strongSignal = options.inputType === "insertReplacementText";
  if (!strongSignal && (!change.removed || !change.inserted || options.selectionCollapsed === false)) return null;

  const prefix = toGraphemes(afterValue).slice(0, change.start).join("");
  const mappedStart = alignTypedToTarget(prefix, targetValue).targetProgress;
  const target = toGraphemes(normalizeForScoring(targetValue));
  const inserted = toGraphemes(normalizeForScoring(change.inserted));
  const comparisonLength = Math.max(inserted.length, toGraphemes(change.removed).length);
  const expected = target.slice(mappedStart, mappedStart + comparisonLength);
  const localBefore = editDistance(change.removed, expected);
  const localAfter = editDistance(change.inserted, expected);
  const changedWord = /[\p{L}\p{N}'’]/u.test(change.removed) && /[\p{L}\p{N}'’]/u.test(change.inserted);
  if (localAfter >= localBefore || (!strongSignal && !changedWord)) return null;

  return {
    ...change,
    expected: expected.join(""),
    strongSignal,
    improvement: localBefore - localAfter,
  };
}

export function calculateConsistency(samples: Array<{ wpm: number }>) {
  const values = samples.map(({ wpm }) => wpm).filter((value) => value > 0);
  if (values.length < 2) return 100;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  return Math.max(0, Math.min(100, 100 - (deviation / mean) * 100));
}
