export type TestMode = "time" | "words" | "quote" | "zen" | "custom";
export type QuoteLength = "short" | "medium" | "long";
export type DeviceType = "computer" | "mobile";
export type SessionPhase = "ready" | "focused" | "running" | "settling" | "interrupted";

export interface TestSettings {
  mode: TestMode;
  duration: number;
  wordCount: number;
  quoteLength: QuoteLength;
  punctuation: boolean;
  numbers: boolean;
  customText: string;
}

export interface PaceSample {
  second: number;
  wpm: number;
  raw: number;
  errors: number;
}

export interface FixRecord {
  at: number;
  removed: string;
  inserted: string;
  expected: string;
  strongSignal: boolean;
}

export interface RunResult {
  id: number;
  date: string;
  device: DeviceType;
  settings: TestSettings;
  elapsedMs: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  fixes: number;
  assisted: boolean;
  samples: PaceSample[];
  targetText: string;
  typedText: string;
  inputHistory: Array<{ value: string; inputType: string; at: number }>;
}
