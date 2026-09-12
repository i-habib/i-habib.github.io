import { describe, expect, it } from "vitest";
import { buildPassage } from "../corpus";
import {
  alignTypedToTarget,
  calculateConsistency,
  calculateFreeTypingMetrics,
  calculateMetrics,
  detectHelpfulReplacement,
  diffValues,
  normalizeForScoring,
  toGraphemes,
} from "../engine";
import type { TestSettings } from "../types";

const settings: TestSettings = {
  mode: "time",
  duration: 30,
  wordCount: 25,
  quoteLength: "medium",
  punctuation: true,
  numbers: false,
  customText: "custom practice text",
};

describe("typing engine", () => {
  it("normalizes mobile smart punctuation without changing display input", () => {
    expect(normalizeForScoring("I’m “ready”\u00a0now\r\n")).toBe('I\'m "ready" now\n');
  });

  it("segments combined characters and emoji as graphemes", () => {
    expect(toGraphemes("A👍🏽é")).toEqual(["A", "👍🏽", "é"]);
  });

  it("recovers after an inserted or missed character", () => {
    const inserted = alignTypedToTarget("the qquick", "the quick fox");
    const missed = alignTypedToTarget("the quck", "the quick fox");
    expect(inserted.counts.insert).toBe(1);
    expect(inserted.counts.substitute).toBe(0);
    expect(missed.counts.delete).toBe(1);
  });

  it("stays finite when input greatly exceeds a short target", () => {
    const alignment = alignTypedToTarget("x".repeat(40), "abc");
    expect(Number.isFinite(alignment.distance)).toBe(true);
    expect(alignment.targetProgress).toBeLessThanOrEqual(alignment.targetLength);
    expect(alignment.counts.insert).toBeGreaterThan(0);
  });

  it("keeps metrics finite at zero time and uses exact matched characters", () => {
    expect(calculateMetrics("hello", "hello world", 0).wpm).toBe(0);
    const metrics = calculateMetrics("hello world", "hello world today", 60_000);
    expect(metrics.correct).toBe(11);
    expect(metrics.wpm).toBe(2.2);
  });

  it("scores zen input as free typing without target errors", () => {
    const metrics = calculateFreeTypingMetrics("hello world", 60_000);
    expect(metrics.wpm).toBe(2.2);
    expect(metrics.accuracy).toBe(100);
    expect(metrics.errors).toBe(0);
  });

  it("captures an atomic native replacement", () => {
    expect(diffValues("teh ", "the ")).toEqual({
      start: 1,
      removed: "eh",
      inserted: "he",
      beforeEnd: 3,
      afterEnd: 3,
    });
    expect(detectHelpfulReplacement("teh ", "the ", "the quick fox", {
      inputType: "insertReplacementText",
      selectionCollapsed: true,
    })?.strongSignal).toBe(true);
  });

  it("counts a strong smart-apostrophe correction but rejects harmful changes", () => {
    expect(detectHelpfulReplacement("dont ", "don't ", "don't worry", {
      inputType: "insertReplacementText",
    })?.inserted).toBe("'");
    expect(detectHelpfulReplacement("the ", "teh ", "the quick fox", {
      inputType: "insertReplacementText",
    })).toBeNull();
  });

  it("accepts an Android-style generic replacement only for a collapsed edit", () => {
    expect(detectHelpfulReplacement("recieve ", "receive ", "receive the note", {
      inputType: "insertText",
      selectionCollapsed: true,
    })?.strongSignal).toBe(false);
    expect(detectHelpfulReplacement("recieve ", "receive ", "receive the note", {
      inputType: "insertText",
      selectionCollapsed: false,
    })).toBeNull();
  });

  it("does not call ordinary insertion, deletion, or composition a fix", () => {
    expect(detectHelpfulReplacement("th", "the", "the quick fox", { inputType: "insertText" })).toBeNull();
    expect(detectHelpfulReplacement("teh", "te", "the quick fox", { inputType: "deleteContentBackward" })).toBeNull();
    expect(detectHelpfulReplacement("teh ", "the ", "the quick fox", { inputType: "insertReplacementText", composing: true })).toBeNull();
    expect(detectHelpfulReplacement("teh ", "the ", "the quick fox", { inputType: "insertFromComposition" })).toBeNull();
  });

  it("calculates stable consistency boundaries", () => {
    expect(calculateConsistency([{ wpm: 50 }, { wpm: 50 }])).toBe(100);
    expect(calculateConsistency([])).toBe(100);
    expect(calculateConsistency([{ wpm: 10 }, { wpm: 100 }])).toBeGreaterThanOrEqual(0);
  });

  it("builds natural, correctly sized passages for every mode", () => {
    expect(buildPassage(settings, 42).split(/\s+/).length).toBeGreaterThanOrEqual(93);
    expect(buildPassage({ ...settings, mode: "words", wordCount: 10 }, 42).split(/\s+/)).toHaveLength(10);
    expect(buildPassage({ ...settings, mode: "quote", quoteLength: "short" }, 42)).toMatch(/[.!?]$/);
    expect(buildPassage({ ...settings, mode: "words", wordCount: 10, numbers: true }, 42)).toMatch(/\d/);
    expect(buildPassage({ ...settings, mode: "custom", customText: "My own words." }, 42)).toBe("My own words.");
    expect(buildPassage({ ...settings, mode: "zen" }, 42)).toBe("");
  });
});
