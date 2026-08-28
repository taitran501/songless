# SonglessUnlimited

Guess songs from tiny audio clips, challenge your friends with the same daily set, or play without headphones using lyric clues.

## Game Modes

### Daily Challenge

- Guess 3 popular songs each day (1 VPop, 1 USUK, and 1 Rap).
- Everyone gets the same songs each day, making scores easy to compare.
- Come back tomorrow for a new daily challenge set.
- Share your score and emoji result without revealing the answers.

### Partial Lyrics Mode

- Play anywhere without audio or headphones.
- Each Quick Mix contains exactly 5 songs with a deterministic `2–2–1` genre balance.
- Recent songs are avoided when the catalog allows it, and replay creates a new order and clue selection.
- Each wrong guess reveals a deterministic superset of the previous clue.
- The final clue reveals every non-title word plus the artist and genre; the title stays hidden until the answer is shown.

### Guest Playlist Mode

- Jump straight into playlist guessing without signing in.
- Paste a YouTube playlist or a public Spotify playlist URL to get started.

### Practice by Genre

- Pick VPop, USUK, or Rap and play exactly 5 approved audio tracks per run.
- Tracks do not repeat within a run, and replay creates a new order.
- Best score, best streak, completed runs, and total solved are saved locally per genre.

## Gameplay

Audio modes use six clip stages:

| Stage | Clip | Score |
| ---: | ---: | ---: |
| 1 | `0.5s` | 100 |
| 2 | `1s` | 80 |
| 3 | `2s` | 60 |
| 4 | `4s` | 40 |
| 5 | `8s` | 25 |
| 6 | `15s` | 10 |

1. Play the current clip or read the current lyric clue.
2. Enter a guess and choose a matching suggestion.
3. A wrong guess or skip unlocks the next stage and lowers the available score.
4. A correct guess reveals the result and advances to the next song.
5. In Lyrics mode, the sixth stage becomes the final clue and `Give up & reveal answer` ends the round with no points.

Your progress and score are saved automatically in the browser. The homepage offers `Continue Run` when it finds a valid unfinished session and asks before replacing it with a new mode.
Starting a new Lyrics Quick Mix remembers up to 10 recent tracks locally. Genre best scores and streaks also remain on the current device.

Completing all three Daily tracks records a local UTC-day streak, personal best, and a rolling 90-day history. Replaying the same day can improve the best score but cannot increment the streak twice.

Daily's three-track snapshot is immutable per UTC date and is stored in managed Redis. A missing snapshot is generated behind a short date-scoped lock; Redis errors fail closed with a retryable `503` instead of silently serving another date or an in-memory substitute. The browser never creates a Daily session until the response passes the snapshot/date/genre/audio contract.

Production emits metadata-safe `DailyMetric` logs for snapshot hits, publication latency, lock races, and rejected genre/audio candidates. No title, artist, guess, or playlist identifier is included. Set `DAILY_METRICS_LOG=1` locally when you need the same diagnostic stream outside Production.

Run summaries can be copied as a six-cell emoji row per track. Shared results contain mode, score, solved count, and streak only; song titles, artists, playlist identifiers, and typed guesses are excluded.

Game exits are mode-aware: Daily, Lyrics, and Genre return home, while custom playlists return to Playlist Setup. Leaving a run after making progress asks for confirmation before clearing it.

## Adding Daily Songs

Daily tracks use YouTube, but the game starts from a reviewed point in the music instead of silently assuming that every video starts with audio.

The catalog is split into:

- `lib/curated-song-seeds.ts`: song, artist, genre, YouTube video ID, source type, and lyric clues.
- `lib/curated-track-analysis.ts`: detected start time, confidence, review status, audio-first evidence, and optional manual override.
- `lib/curated-tracks.ts`: merges both sources into runtime tracks and selects the daily mix.

Audio-start analysis metadata is committed in `lib/curated-track-analysis.ts` and is required for a track to be marked `approved`. A `0` second start is accepted only when the manifest explicitly confirms an audio-first source. Runtime code does not download audio or run an analyzer. When adding a track, update the seed and reviewed analysis metadata together; unreviewed tracks remain out of Daily and Genre selection.

## Local Setup

Install dependencies:

```bash
npm install
```

Create local environment values from the example:

```bash
cp env.example .env.local
```

Public Spotify playlists use server-side client credentials. Spotify OAuth and private playlists are not supported.

| Variable | Required | Description |
| --- | --- | --- |
| `SPOTIFY_CLIENT_ID` | For public Spotify playlists | Spotify application client ID |
| `SPOTIFY_CLIENT_SECRET` | For public Spotify playlists | Spotify application client secret |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Preview/Production | Managed Redis REST credentials for Daily snapshots |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | Existing Vercel Redis integration | Compatibility names accepted when the Upstash names are not injected |
| `CRON_SECRET` | Production | Bearer secret for `/api/cron/daily` |
| `NEXT_PUBLIC_APP_URL` | No | Canonical URL used in shared results; defaults to the current browser origin |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | No | Enables anonymous product events when used together with `NEXT_PUBLIC_POSTHOG_HOST` |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog ingest host for the configured project |

PostHog is optional and disabled when either public value is missing. When enabled, Songless uses cookieless `localStorage` persistence, explicit allow-listed events, no user identification, no autocapture, and no session recording.

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run test:unit
npm run test:integration
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e:smoke
npm run verify
```

`test:e2e` runs the deterministic browser suite (all modes plus recovery, audio retry, and sharing). The former long-running suite is retained under `tests/e2e/legacy` and can be run explicitly with `npm run test:e2e:legacy`; it depends on live provider behavior and is not a default CI gate. Provider-only Node checks are available with `npm run test:live:unit`.

Live YouTube matching can also be checked manually and is not part of the default CI gates:

```bash
npm run smoke:youtube -- --title "Blinding Lights" --artists "The Weeknd"
```

## Project Structure

```text
app/
  api/spotify/              Public Spotify playlist route
  api/youtube/              YouTube playlist and search routes
  game/                     Shared audio and lyrics game screen
  playlist/                 Guest and custom playlist loading
components/game/            Progress, playback, guessing, and lyrics panels
hooks/                      Track state, validated game state, and audio playback
lib/
  curated-song-seeds.ts     Curated song catalog with multi-snippet lyrics
  curated-track-analysis.ts Static audio-start analysis results
  curated-tracks.ts         Runtime merge and deterministic Daily/genre selection
  daily-snapshot.ts         Versioned snapshot schema, checksum, and invariants
  daily-snapshot-redis.ts   Managed Redis adapter with put-if-absent and locks
  daily-response.ts         Client-side Daily payload validation
  genre-taxonomy.ts         Provider/allowlist genre classification
  audio-start-detector.ts   Audio feature extraction and start detector
  game-session.ts           Session v2 validation and legacy migration
  game-modal-state.ts       Persisted result-modal checkpoint for refresh recovery
  game-navigation.ts        Mode-aware exit labels, routes, and progress checks
  daily-progress.ts         UTC daily streak and rolling local history
  genre-progress.ts         Five-track genre runs and local progression
  resumable-session.ts      Validated interrupted-run discovery and discard
  analytics.ts              Optional privacy-safe PostHog event adapter
  lyrics-clues.ts           Title/artist masking and staged clue reveal
  lyrics-runs.ts            Five-track Lyrics Quick Mix and recent-track history
  youtube.ts                Playlist parsing and verified fallback matching
scripts/
  run-e2e.js                Cross-platform Playwright server lifecycle
  smoke-youtube.ts          Opt-in live fallback verification
tests/
  fixtures/                 Deterministic tracks, provider payloads, and state
  support/                  Shared test utilities for future browser flows
  unit/                     Pure domain, selection, persistence, and adapter tests
  integration/              Fixture/API/session contract tests
  e2e/smoke/                Home-to-game smoke journeys
  e2e/modes/                Full runs for Daily, Lyrics, Genre, and Playlist
  e2e/recovery/             Refresh, provider failure, and suggestion recovery
  e2e/sharing/              Result-sharing journey
  e2e/legacy/               Previous provider-dependent regression suite
  live/                     Explicit provider smoke tests
```

## Known Limitations

- YouTube playlist and search support parses YouTube page data and can break if YouTube changes its response structure.
- YouTube playback depends on video availability, embedding permissions, and browser autoplay rules.
- Partial Lyrics Mode uses curated authentic lyric snippets.
- Adding a new Daily track requires a reviewed audio-start manifest and verified source metadata first. If Redis or `CRON_SECRET` is missing in Production, `npm run check-env` fails the deployment preflight.

## Deployment

The app is compatible with Vercel. Provision a managed Redis integration for Preview and Production, then set `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*` compatibility names) and `CRON_SECRET`. Production preflight fails when Redis or `CRON_SECRET` is missing; Preview remains deployable for non-Daily review flows but `/api/daily` returns `503` until Redis is provisioned. Run the Daily cron once to prime the current UTC snapshot before opening traffic. Configure `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` when public Spotify playlist loading is needed; no Spotify redirect URI is required. User progress remains localStorage; Redis stores only Daily snapshots.
