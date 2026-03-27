# Pool Simulator — React Native

## Project structure

- `engine/` — Pure TypeScript physics engine, game reducer, rules, scenarios (no React)
- `contexts/` — React context providers (thin wrappers over engine logic)
- `components/` — React Native UI components
- `app/` — Expo Router screens
- `constants/strings.ts` — All user-facing text (i18n)

## Rules

### Testing
- Logic code in `engine/` must have unit tests for core cases.
- Tests live in `engine/__tests__/` and use Jest with `ts-jest`.
- Run tests: `npx jest`

### Internationalization
- All user-facing text must live in `constants/strings.ts`.
- Components import from `strings` — never hardcode display text in JSX.
- Use template functions in `strings` for dynamic text (e.g. `strings.history.goToShot(n)`).

### Code organisation
- Keep React out of `engine/` — it should be pure, testable TypeScript.
- The game reducer and state types live in `engine/game-reducer.ts`.
- `contexts/GameContext.tsx` is a thin React wrapper; avoid putting logic there.
