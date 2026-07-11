# NutriTrack AI

NutriTrack AI is a production-style nutrition and fitness SaaS web app built with React, Vite, TypeScript, Tailwind CSS, and LocalStorage persistence.

## Features

- Full onboarding with body metrics, goal setup, and automatic calculations: BMI, BMR, TDEE, calories, and macros.
- Internationalization support for English and Serbian (Latin).
- Dark mode by default with optional light mode.
- Dashboard with calorie progress, macro tracking, water, goal progress, streaks, AI recommendation, and charts.
- Food logging with manual entry, AI natural-language parser, photo analysis tool, favorites, duplication, and deletion.
- Built-in nutrition database for common foods and future-ready architecture for USDA, OpenFoodFacts, Nutritionix, and Edamam integrations.
- Meal planner with shopping list generation.
- Smart fridge ideas with missing ingredient detection.
- Trackers for water, weight, measurements, workouts, sleep, and supplements.
- Calendar-style history and statistics.
- AI coach panel (on-demand only) and AI daily review generation.
- Daily log continuity by date with persistent history.
- Export/import JSON and app reset.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Framer Motion
- LocalStorage state persistence

## Project Structure

- `src/App.tsx`: Main application shell and all feature sections.
- `src/components/ui.tsx`: Reusable UI primitives.
- `src/hooks/useLocalStorage.ts`: Generic LocalStorage hook.
- `src/hooks/useNutriTrack.ts`: App state management hook.
- `src/services/ai.ts`: Natural language meal parsing, coach replies, daily review generation.
- `src/data/nutritionDatabase.ts`: Built-in nutrition data catalog.
- `src/utils/nutrition.ts`: Calculations and nutrition math helpers.
- `src/utils/date.ts`: Date utilities for daily history.
- `src/i18n.ts`: Bilingual dictionary and localization helpers.
- `src/types.ts`: Application type system.

## Installation

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Build production bundle:

```bash
npm run build
```

## Notes for Future Backend Integration

- Current architecture isolates calculation logic, AI helper functions, and database data in dedicated modules.
- To integrate external nutrition APIs, replace lookups in `src/services/ai.ts` and add network service adapters.
- LocalStorage store schema is centrally maintained by `useNutriTrack`, making migration to API-backed state straightforward.
