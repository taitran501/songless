# Songless test topology

The deterministic gate runs from the smallest contracts to the full browser journey:

1. `tests/unit/` — pure domain, selection, persistence, and adapter behavior. These tests do not call external providers.
2. `tests/integration/` — route handlers, Redis snapshot semantics, fixture contracts, and session/state flows using injected fakes.
3. `tests/e2e/` — Playwright journeys. `smoke/` starts modes from Home, `modes/` completes all four run types, `recovery/` covers refresh/provider/audio failures, and `sharing/` covers the result contract.
4. `tests/live/` — explicitly opt-in provider checks. They are not part of the default CI gate because YouTube, Apple Music, LRCLIB, and Redis are external dependencies.

Run the deterministic release gate with:

```bash
npm run verify
```

Run an individual layer while iterating:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:live:unit
```

Provider-dependent tests must be reported separately from the deterministic gate.
