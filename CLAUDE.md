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

Note: This project uses `bun.lock`, indicating Bun is the preferred package manager, though npm commands also work.

## Architecture

### Tech Stack
- **Framework**: Astro 5.x with React integration
- **State Management**: Nanostores (lightweight atomic state management)
- **Language**: TypeScript with strict mode
- **Styling**: Vanilla CSS (no CSS framework)

### Application Flow

1. **Data Loading** ([src/stores/Dictionary.ts](src/stores/Dictionary.ts))
   - Dictionary is fetched from external CSV on initialization
   - CSV contains Japanese words in kana format
   - Hiragana characters are automatically converted to katakana
   - Data is stored in a nanostores atom (`$dictionary`)

2. **Solver Algorithm** ([src/stores/Dictionary.ts:30-86](src/stores/Dictionary.ts#L30-L86))
   - `computeMostLikelyKana` takes three constraint types:
     - `confirmed`: Characters in known positions (e.g., position 2 is 'カ')
     - `included`: Characters that exist somewhere in the word
     - `excluded`: Characters that don't appear in the word
   - Algorithm filters dictionary by constraints, then:
     - Counts character frequency across matching words
     - Tries combinations of most frequent characters
     - Returns first valid word with all unique characters

3. **UI Component** ([src/components/Dictionary.tsx](src/components/Dictionary.tsx))
   - React component using nanostores hooks (`useStore`)
   - Displays most likely word suggestion
   - For each character position, provides radio buttons:
     - 確定 (confirmed) - character is in correct position
     - 含む (included) - character exists but wrong position
     - 含まない (excluded) - character doesn't appear in word
   - "次へ" (Next) button processes selections and updates constraints
   - Once a character is confirmed, its position locks (no more radio buttons)

### File Structure
```
src/
├── pages/
│   └── index.astro          # Entry point, renders Dictionary component
├── layouts/
│   └── Layout.astro         # Base HTML layout
├── components/
│   └── Dictionary.tsx       # Main UI component (React)
└── stores/
    └── Dictionary.ts        # State management & solver logic
```

### Key Implementation Details

- **Astro Islands**: The `Dictionary` component uses `client:load` directive in [index.astro](src/pages/index.astro) to hydrate immediately on page load
- **State Synchronization**: Radio selections are tracked separately from constraint state to handle UI transitions when clicking "Next"
- **Character Uniqueness**: The solver filters for words with all unique characters (no repeated katakana)
- **External Dependency**: Dictionary data source is hardcoded to GitHub raw URL: `https://raw.githubusercontent.com/plumchloride/tango/refs/heads/main/kotonoha-tango/public/data/Q_fil_ippan.csv`
