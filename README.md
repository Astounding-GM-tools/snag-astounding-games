# Steamboat Snag Poker

A silent-film poker duel prototype. Design: [docs/design.md](docs/design.md).

```bash
npm install
npm run dev      # play at http://localhost:5173
npm test         # engine tests
npm run sim      # balance simulation per preset (SIM_GAMES=10 SIM_PRESETS=kansas npm run sim)
```

- `src/engine` — pure, framework-free rules engine (seeded, serializable state).
- `src/ui` — Svelte 5 UI. The game plays the default rules; try variants in the balance simulation.
- `src/i18n` — all UI text.
