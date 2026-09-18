# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Kotonoha Tango solver - a word puzzle solver application for Japanese 5-letter word games (similar to Wordle but for Japanese katakana words). The app suggests the most likely word based on constraints provided by the user.

## Commands

### Development
- `npm run dev` or `bun run dev` - Start local dev server at `localhost:4321`
- `npm run build` or `bun run build` - Build production site to `./dist/`
- `npm run preview` or `bun run preview` - Preview production build locally
- `npm run astro ...` - Run Astro CLI commands (e.g., `astro check` for type checking)
- `bun test` - Run unit tests ([src/stores/solver.test.ts](src/stores/solver.test.ts))
- `bun run simulate [games]` - Measure solver strength by simulating games against the whole dictionary (default 200). Run this after any change to the solver and check that average turns / 6-turn clear rate did not regress.
- `bun run evaluate:history [games]` - Evaluate against the last completed daily answers from the public analysis CSV (default 200). The parser excludes the latest row even when it contains an answer, so today's answer is never used.

Note: This project uses `bun.lock`, indicating Bun is the preferred package manager, though npm commands also work. `astro check` requires TypeScript 6.x - TypeScript 7's native compiler does not yet expose the API the Astro language server needs.

## Architecture

### Tech Stack
- **Framework**: Astro 5.x with React integration
- **State Management**: Nanostores (lightweight atomic state management)
- **Language**: TypeScript with strict mode
- **Styling**: Vanilla CSS (no CSS framework)

### Application Flow

1. **Data Loading** ([src/stores/dictionarySource.ts](src/stores/dictionarySource.ts), [src/stores/Dictionary.ts](src/stores/Dictionary.ts))
   - `dictionarySource.ts` owns the CSV URL and `fetchDictionary()`; both the app and `scripts/simulate.ts` go through it, so the one external dependency has one home
   - CSV columns are `表記,読み`; only the reading is used
   - Hiragana characters are automatically converted to katakana
   - Entries that are not exactly 5 characters are dropped, and homophones are de-duplicated (the raw CSV has ~10.7k rows but only ~7.9k distinct readings; keeping duplicates skews frequency counts)
   - `$dictionary` starts **empty** and is filled asynchronously; `$dictionaryError` holds a load failure. Do not reintroduce a top-level `await` here — `client:load` cannot hydrate until the module finishes evaluating, so it would block first paint on the fetch and a network failure would stop the component mounting at all.

2. **Solver Algorithm** ([src/stores/solver.ts](src/stores/solver.ts))
   - State is the **history of guesses and their colors**, not a set of constraints:
     `Guess = { word, marks }` where each mark is `hit` (green) / `blow` (yellow) / `miss` (gray)
   - `computeFeedback(guess, answer)` reproduces the game's coloring, including duplicate-character
     counting (greens consume occurrences first, extra copies come back as `miss`)
   - `filterCandidates` keeps words `w` such that `computeFeedback(guess, w) === marks` for every past
     turn. Because scoring and filtering share one function, they can never disagree — a set-based
     `included`/`excluded` model cannot express "exactly one of this character" and silently drops the
     true answer when a character appears both green/yellow and gray in one guess.
   - `rankGuesses` scores every pooled word by the **expected number of remaining candidates**
     (`Σ bucket² / N` over feedback patterns) and returns them sorted. `suggest` takes `[0]` as the
     recommendation and the best candidates from the same ranking as `likely` — one ranking, so the
     alternatives shown are ordered by the same metric as the recommendation.
   - With 10 or fewer candidates, `rankEndgame` instead minimizes expected turns to solve,
     assuming equally likely answers. It memoizes candidate subsets and merges equivalent feedback
     partitions. Solved branches cost no additional guesses; non-progressing guesses are excluded.
     Expected remaining candidates breaks ties. This avoids choosing equally informative probes
     solely by CSV order when their later branches have different solution costs.
   - With 11–70 candidates, `rankTwoTurns` compares the five best immediate guesses by splitting
     each feedback outcome and finding the best second guess from the 100 best probes plus every
     candidate. It minimizes expected remaining candidates after two guesses. At most 10 candidates
     the exact endgame search above takes over; above 70 the original single-step score applies.
   - Words that cannot be the answer are allowed in the guess pool: when candidates share four
     characters, one word that splits them beats guessing them one at a time.
   - Pool width comes from `WORK_BUDGET / candidates.length`, not a candidate-count threshold, so
     cost per turn is bounded and monotonic. When the computed width reaches the dictionary size the
     pool *is* the whole dictionary, so full-probe behaviour falls out without a branch.
   - The empty-history ranking is memoized per dictionary (`WeakMap`) rather than hardcoded. The CSV is
     unpinned and refetched every load, so a baked-in opener would silently rot when it changes.
   - Words are encoded to numeric arrays (`encode`) before the hot loops; string indexing in the inner
     loop is ~20x slower and pushes a turn past several seconds. The positional frequency table is a
     flat `Int32Array` indexed by char id for the same reason (~12x faster than `Map<string, number>`).

3. **UI Component** ([src/components/Dictionary.tsx](src/components/Dictionary.tsx))
   - React component using nanostores hooks (`useStore`)
   - Displays the recommended word, the turn number, and the remaining candidate count
   - For each character position, provides three buttons matching the game's colors:
     - 確定 (hit) - character is in correct position
     - 含む (blow) - character exists but wrong position
     - 除外 (miss) - character does not appear (at this position / any more)
   - Each position is recorded **independently**. Do not force other positions with the same character
     to the same mark: that is exactly the information that identifies duplicate characters.
   - "次へ" (Next) appends `{ word, marks }` to the history; "戻る" pops the last turn
   - Positions already confirmed by a past `hit` are pre-filled and locked
   - If the history admits no candidate, an error card tells the user to undo

### File Structure
```
scripts/
└── simulate.ts              # Solver strength measurement
src/
├── pages/
│   └── index.astro          # Entry point, renders Dictionary component
├── layouts/
│   └── Layout.astro         # Base HTML layout
├── components/
│   └── Dictionary.tsx       # Main UI component (React)
└── stores/
    ├── Dictionary.ts        # Dictionary state (nanostores atoms)
    ├── dictionarySource.ts  # CSV URL + fetch
    ├── solver.ts            # Pure solver logic (no dependencies, no I/O)
    └── solver.test.ts       # Unit tests
```

### Key Implementation Details

- **Astro Islands**: The `Dictionary` component uses `client:load` directive in [index.astro](src/pages/index.astro) to hydrate immediately on page load
- **Pure Core**: [solver.ts](src/stores/solver.ts) has no imports and does no I/O, so it is testable and runnable standalone. Keep fetching in [dictionarySource.ts](src/stores/dictionarySource.ts) and nanostores in [Dictionary.ts](src/stores/Dictionary.ts), and do not re-export solver through them — an `import { suggest } from './Dictionary'` would drag the network layer into a pure-function import.
- **External Dependency**: Dictionary data source is hardcoded to a GitHub raw URL in [dictionarySource.ts](src/stores/dictionarySource.ts). The path contains `refs/heads/main`, so it is unpinned and can change under the app.

### Current Solver Strength

Measured with `bun run simulate` (200 games, seeded, 2026-09-18): **4.760 turns on average, 95.0% solved within 6 turns, 0 unsolved.** The preceding one-step version measured 4.775 turns and 96.0% within six, so the average improved while that six-turn metric declined on the random sample. Timing on the development machine: 195ms for the opening ranking, then at most 239ms per turn. These sampled results are a regression baseline, not a guarantee for every answer. `チョウレイ` still takes 6 turns.

The solve still runs synchronously on the main thread, so those milliseconds are UI jank. `solver.ts` is import-free and I/O-free specifically so it can move into a Web Worker when that becomes worth doing.

The public `analysis.csv` lists historical answers and also has a row for the current day. Never use its last row for training, evaluation, or a user-facing suggestion. Past answers can repeat, so do not remove them from the candidate pool. In a chronological test of the last 200 completed days (days 1502–1701), the new two-step solver averaged **4.910 turns with 95.0% solved within six**, versus 4.960 turns and 92.0% for the preceding one-step solver. An experimental bonus for answers seen on earlier days performed worse (4.995 turns and 91.0%), so it is not part of the product.
