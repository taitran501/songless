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
- Read authentic lyric snippets from popular songs while title and artist stay hidden.
- Each song includes multiple distinct lyric clues for a varied replay experience.
- Each wrong guess reveals a little more, with six chances to find the answer.

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
5. Missing all six stages reveals the answer with no points.

Your progress and score are saved automatically in the browser, so an interrupted game can be continued later.

## Adding Daily Songs

Daily tracks use YouTube, but the game starts from the beginning of the music instead of the opening scene of a music video. A local analysis tool helps contributors find that timestamp before adding a song to the Daily pool.

The catalog is split into:

- `lib/curated-song-seeds.ts`: song, artist, genre, YouTube video ID, source type, and lyric clues.
- `lib/curated-track-analysis.ts`: detected start time, confidence, review status, and optional manual override.
- `lib/curated-tracks.ts`: merges both sources into runtime tracks and selects the daily mix.

The analyzer checks the first 90 seconds of a video and creates a review report with timestamped YouTube links. Downloaded audio is temporary and is never committed to the repository.

Install `yt-dlp` and `ffmpeg`, then run:

```bash
npm run analyze:audio-start
```

Useful options:

```bash
npm run analyze:audio-start -- --track vpop-see-tinh
npm run analyze:audio-start -- --limit 5 --no-write
npm run analyze:audio-start -- --fresh
```

The script updates `lib/curated-track-analysis.ts`. A manually reviewed timestamp can be used when automatic detection is not accurate enough.

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
| `NEXT_PUBLIC_APP_URL` | No | Canonical URL used in shared results; defaults to the current browser origin |

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run test:unit
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

Live YouTube matching can be checked manually and is not part of the default CI gates:

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
  curated-tracks.ts         Runtime merge and deterministic daily selection
  audio-start-detector.ts   Audio feature extraction and start detector
  game-session.ts           Session v2 validation and legacy migration
  genre-progress.ts         Five-track genre runs and local progression
  lyrics-clues.ts           Title/artist masking and staged clue reveal
  youtube.ts                Playlist parsing and verified fallback matching
scripts/
  analyze-audio-start.ts    Local yt-dlp/ffmpeg ingest workflow
  run-e2e.js                Cross-platform Playwright server lifecycle
  smoke-youtube.ts          Opt-in live fallback verification
tests/                      Unit and Playwright E2E tests
```

## Known Limitations

- YouTube playlist and search support parses YouTube page data and can break if YouTube changes its response structure.
- YouTube playback depends on video availability, embedding permissions, and browser autoplay rules.
- Partial Lyrics Mode uses curated authentic lyric snippets.
- Adding a new Daily track requires running the local audio-start analyzer first.

## Deployment

The app is compatible with Vercel. Daily, Partial Lyrics, and genre progression require no database. Configure `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` only when public Spotify playlist loading is needed; no Spotify redirect URI is required.
