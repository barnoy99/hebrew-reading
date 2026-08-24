# אליה קוראת — Hebrew reading practice

A letter-and-syllable reading app for Eliya (5). Static site, vanilla JS, no build step.

## Running it

**Live: <https://barnoy99.github.io/hebrew-reading/>**

On the tablet, open that link and use the browser menu → "Add to Home screen" to install it
as a fullscreen app.

Locally on Windows, from this folder:

```bash
python -m http.server 8044
```

Then open <http://localhost:8044>. For the Android tablet, push the folder to a GitHub
Pages repo (same as the other apps) and add it to the home screen.

## How it adapts

Everything is stored in `localStorage` under `eliyaReading_state`.

- **Per-pair mastery.** Each letter+vowel combination (`בּ+קמץ` separately from `בּ+חיריק`)
  carries a 0–1 score. Correct answers raise it gently, a miss drops it by 0.30.
  Weak pairs get up to 5× the airtime — verified at ~3× concentration on a weak letter.
- **Self-escalating distractors.** Below 0.6 mastery the wrong answers differ in exactly
  one dimension and actively *avoid* look-alikes. Above 0.6 the confusable letters start
  appearing instead. Measured: ר shows up as a distractor for ד **0%** of the time while
  ד is weak, **100%** once it is mastered.
- **Gated unlocks.** After each round, if average mastery > 0.72 **and** at least 60% of
  combinations have been practised twice, a new letter opens — or every third time, a new
  vowel group. Simulated: a child guessing at chance unlocks *nothing*; a child at 80%
  accuracy reaches 12 letters in 40 rounds.
- **Longer words.** 2-syllable pseudo-words below 0.65 average mastery, 3 above it.
- Real words appear only once every required letter and vowel is unlocked.

## Modes

| Mode | What it does | Graded by |
|---|---|---|
| מעבדת הקסם | Tap a letter, tap a נקודה, hear the result. No score. | — |
| שומעת ובוחרת | Hear a syllable, pick it from 3. | app |
| ציד אותיות | Find every ב in a grid of look-alikes. | app |
| קוראת בקול | Read a word aloud, tap 👂 to check yourself. | herself |

## Scope decisions

- **ניקוד**: קמץ, פתח, חיריק, חולם, שורוק, צירה, סגול only. No חטפים, no פתח גנובה,
  no קמץ קטן, no שווא.
- **דגש**: v1 always renders the plosive form (בּ כּ פּ). The fricative voices are a
  later unlock — teaching both at once makes every ב ambiguous.
- **Silent letters**: א and ע may only *open* a pseudo-word. Mid-word they produce an
  unreadable vowel-vowel run like `רַאָ`.
- **Homophone safety**: no question ever offers two identically-pronounced options.
  This matters more than it sounds — בָּ/בַּ, אָ/עָ, כָּ/קָ and טָ/תָ are all traps.
  Options are keyed on the *spoken* form, verified over 4000 generated questions.

## Font

`Rubik`, chosen by rendering the confusable pairs side by side against Heebo, Assistant,
Noto Sans Hebrew and Varela Round. Rubik keeps the ד tag and the ב foot crisp while
staying friendly. Varela Round is cuter but its universal rounding flattens the ס/ם
contrast — the wrong trade for a reading app.

## Recording your own voice

TTS is the fallback, not the goal. To use your own voice for a syllable:

1. Record a short clip, e.g. `ba.mp3` → save as `audio/bet_kamatz.mp3`
2. Add `'bet_kamatz'` to the `CLIPS` set at the top of `audio.js`

Naming: syllables are `<letterId>_<vowelId>`, letter names are `name_<letterId>`, prompts
use their `SAY` key. Anything not in `CLIPS` falls back to TTS, so you can add clips a few
at a time. Letter ids are in `data.js`.

## Parent panel

Long-press the top-left corner for 3 seconds. Shows per-letter mastery bars and practice
counts, lets you unlock or re-lock any letter or vowel by hand, and resets progress.

## Files

- `data.js` — letters, vowels, real words, theme, spoken prompts. Edit content here.
- `engine.js` — generation, mastery, distractors, progression. No DOM. Live at `window.__engine`.
- `audio.js` — recorded clip → TTS fallback.
- `app.js` — screens and round loop. Live at `window.__app`.
