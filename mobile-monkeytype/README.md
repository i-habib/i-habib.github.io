# thumbtype

A React typing test with Monkeytype’s focused Serika Dark feel, rebuilt around the way people actually type on phones. The native textarea stays in charge, so autocorrect, suggestions, swipe typing, composition, smart punctuation, and sentence capitalization can participate normally.

## Run locally

```bash
npm install
npm run dev
```

Vite prints both a localhost URL and a network URL. Open the network URL on a phone connected to the same Wi-Fi to test a real mobile keyboard.
The app is served at `/mobile-monkeytype/`.

```bash
npm test
npm run build
```

## Deployment

The source is published in `i-habib/i-habib.github.io` under `mobile-monkeytype/`.
The Vercel project `mobile-typing-test` builds that directory with `npm run build`
and publishes `dist`. Its root URL redirects to `/mobile-monkeytype/`.
The repository's root README and GitHub Pages domain configuration are separate.

Build assets, the app manifest, and the install shortcut all use the same subpath.
Future changes pushed to this folder on `main` deploy through the Vercel GitHub connection.

## Included

- React 19 + TypeScript + Vite
- Serika Dark visual system and responsive Monkeytype-style layout
- Desktop segmented test configuration and mobile settings dialog
- Time, words, quote, zen, and custom modes with punctuation and number options
- Custom durations, custom word counts, and your own pasted passage
- Live progress bar: time remaining, passage completion, or zen elapsed time
- Persistent uncontrolled textarea with native autocorrect enabled
- Full-value reconciliation for suggestion taps, swipe input, and replacement edits
- Grapheme-aware alignment that recovers after inserted or missed characters
- WPM, raw WPM, accuracy, consistency, pace chart, and detected-fix results
- Private on-device progress: per-configuration personal bests, wpm/accuracy trends, daily streaks, a 14-day activity strip, lifetime totals, filters, and clear/reset controls
- Computer/mobile run labels with side-by-side averages and device filtering
- Thumbtype JSON backups and Monkeytype account CSV import
- Recent-run history and Web Share support
- Safe-area and `visualViewport` handling for mobile keyboards
- Vitest engine and React integration tests

## Input model

The rendered passage is only a mirror. A real, full-size, visually transparent textarea sits over it with:

```tsx
<textarea
  defaultValue=""
  autoCorrect="on"
  autoCapitalize="sentences"
  autoComplete="on"
  inputMode="text"
  spellCheck
/>
```

The textarea is intentionally uncontrolled during a run. Native `beforeinput`, `input`, and composition events are observed, and the textarea’s complete value after each input is authoritative. Nothing rewrites its value or selection while typing.

Phone browsers do not reliably say which edit came from autocorrect. “Detected fixes” therefore means a native replacement was observed and the changed text became closer to the target. Paste remains available but marks the run assisted.

## Real-device acceptance pass

Browser automation cannot run the actual iOS or Android keyboard. Before shipping, verify iPhone Safari and Android Chrome with Gboard:

1. Tap the passage and confirm the keyboard opens from that gesture.
2. Type a familiar typo and press space; confirm the rendered text follows the keyboard’s replacement.
3. Accept a suggestion, swipe a word, dictate, type a contraction, and edit an earlier word.
4. Dismiss/reopen the keyboard, rotate the phone, and finish a test.
5. Disable OS autocorrect and confirm the raw typo remains.

## Attribution

The layout and interaction behavior were independently recreated after studying the public [Monkeytype site](https://monkeytype.com/) and [official repository](https://github.com/monkeytypegame/monkeytype). Monkeytype is GPL-3.0; no Monkeytype source, CSS, logo, fonts, or other assets are copied into this project.
