import type { QuoteLength, TestSettings } from "./types";

export const DEFAULT_CUSTOM_TEXT = "A good typing rhythm feels relaxed, accurate, and repeatable. Paste your own text in settings whenever you want a different challenge.";

const SENTENCES = [
  "A quiet morning can make the whole day feel more spacious.",
  "We took the long way home and found a tiny bookstore near the station.",
  "Please remember to bring the blue jacket if the weather turns cold.",
  "The best ideas often arrive while you are doing something ordinary.",
  "Maya left a note on the fridge so nobody would forget the picnic.",
  "There is enough coffee for everyone, but the last cup is probably mine.",
  "After the rain stopped, every window reflected a different piece of sky.",
  "Send me the address when you have a minute, and I will meet you there.",
  "A good plan leaves a little room for luck, laughter, and a change of mind.",
  "The train was late, so we traded stories and watched the city wake up.",
  "I thought the recipe looked difficult, but it came together in ten minutes.",
  "Small habits become surprisingly powerful when they are easy to repeat.",
  "You can put the keys by the door, next to the plant with the yellow pot.",
  "Our favorite table is beside the window where the afternoon light lands.",
  "Do not worry about being perfect; clear and thoughtful is usually enough.",
  "The dog heard the delivery truck before anyone else in the house did.",
  "We should check the calendar tonight and choose a weekend that works.",
  "Fresh bread, warm soup, and a familiar song can fix a difficult evening.",
  "Her message said she would arrive around seven, depending on traffic.",
  "Every neighborhood has a shortcut that only the people nearby seem to know.",
  "I will save you a seat near the front unless you would rather stand.",
  "The package is under the desk, wrapped in paper with little green stars.",
  "Take a breath before you answer; the extra second may change what you say.",
  "Someone opened the balcony door, and suddenly the room smelled like summer.",
];

const NUMBER_SENTENCES = [
  "The next train arrives at 7:45, just 12 minutes after the first one.",
  "Room 204 has space for 18 people and a screen on the north wall.",
  "We walked 3 miles, took 2 breaks, and made it home before 6:30.",
  "The recipe needs 4 apples, 2 cups of flour, and exactly 1 lemon.",
];

const QUOTES: Record<QuoteLength, string[]> = {
  short: [
    "The future depends on what you do today.",
    "Great things are done by a series of small things brought together.",
    "Nothing is worth more than laughter. It is strength to laugh and to abandon oneself.",
  ],
  medium: [
    "There are years that ask questions and years that answer. The trick is to listen closely enough to notice which kind you are living through.",
    "It is not the mountain we conquer, but ourselves. Every difficult step teaches us something that the easy road could never explain.",
    "You cannot use up creativity. The more you use, the more you have, and the more clearly you begin to recognize it everywhere.",
  ],
  long: [
    "We are what we repeatedly do. Excellence, then, is not an act but a habit. It grows quietly through ordinary mornings, patient decisions, and the courage to begin again after a difficult day.",
    "There is a curious comfort in returning to a familiar place and discovering that you have changed. The streets are the same, the light falls through the same windows, but you notice details that once passed without a second thought.",
    "The important work is rarely announced by a trumpet. More often it looks like paying attention, keeping a promise, asking one better question, and leaving enough silence for an honest answer to arrive.",
  ],
};

function mulberry32(seed: number) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function applyOptions(value: string, settings: TestSettings) {
  let text = value;
  if (!settings.punctuation) {
    text = text
      .replace(/[.,;:!?“”"()]/g, "")
      .replace(/[’]/g, "'")
      .toLowerCase();
  }
  return text.replace(/\s+/g, " ").trim();
}

export function buildPassage(settings: TestSettings, seed = Math.floor(Math.random() * 2 ** 31)) {
  const random = mulberry32(seed);
  if (settings.mode === "zen") return "";
  if (settings.mode === "custom") return applyOptions(settings.customText.trim() || DEFAULT_CUSTOM_TEXT, settings);
  if (settings.mode === "quote") {
    const choices = QUOTES[settings.quoteLength];
    let quote = choices[Math.floor(random() * choices.length)];
    if (settings.numbers && !/\d/.test(quote)) {
      quote = `${NUMBER_SENTENCES[Math.floor(random() * NUMBER_SENTENCES.length)]} ${quote}`;
    }
    return applyOptions(quote, settings);
  }

  const source = settings.numbers ? [...SENTENCES, ...NUMBER_SENTENCES, ...NUMBER_SENTENCES] : SENTENCES;
  const pool = shuffle(source, random);
  const requiredWords = settings.mode === "words"
    ? Math.max(1, Math.round(settings.wordCount))
    : Math.max(90, Math.ceil(Math.min(settings.duration, 600) * 3.1));
  const sentences: string[] = [];
  let wordTotal = 0;
  let cursor = 0;
  while (wordTotal < requiredWords) {
    const sentence = pool[cursor % pool.length];
    sentences.push(sentence);
    wordTotal += sentence.split(/\s+/).length;
    cursor += 1;
  }

  let passage = sentences.join(" ");
  if (settings.mode === "words") {
    passage = passage.split(/\s+/).slice(0, settings.wordCount).join(" ");
  }
  if (settings.numbers && !/\d/.test(passage)) {
    const numberSentence = NUMBER_SENTENCES[Math.floor(random() * NUMBER_SENTENCES.length)];
    if (settings.mode === "words") {
      const words = passage.split(/\s+/);
      const numberedWords = numberSentence.split(/\s+/);
      const replacementLength = Math.min(numberedWords.length, words.length);
      passage = [...numberedWords.slice(0, replacementLength), ...words.slice(replacementLength)].join(" ");
    } else {
      passage = `${numberSentence} ${passage}`;
    }
  }
  return applyOptions(passage, settings);
}

export { QUOTES, SENTENCES };
