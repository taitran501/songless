# SonglessUnlimited

Guess songs from tiny audio clips, challenge your friends with the same daily set, or play without headphones using lyric clues.

## Game Modes

### Daily Challenge

- Guess 5 popular songs from a mix of VPop, USUK, and Rap.
- Everyone gets the same songs each day, making scores easy to compare.
- Come back tomorrow for a new challenge.
- Share your score and emoji result without revealing the answers.

### Partial Lyrics Mode

- Play anywhere without audio or headphones.
- Read a short clue and guess the song while its title and artist stay hidden.
- Each wrong guess reveals a little more, with six chances to find the answer.

### Spotify Playlist Mode

- Connect Spotify and turn your favorite playlist into a guessing game.
- You can also load a YouTube playlist after connecting.
- Spotify playback may require Premium and an active Spotify device.

### Guest Playlist Mode

- Jump straight into the game without signing in.
- Paste a YouTube playlist or a public Spotify playlist to get started.

The current mode is always visible while you play, and you can return home or leave the game at any time.

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

- `lib/curated-song-seeds.ts`: song, artist, genre, YouTube video ID, source type, and lyric clue.
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

The script updates `lib/curated-track-analysis.ts` and generates `audio-start-report.md`. Review that report before making a new song available in Daily Challenge. A manually reviewed timestamp can be used when automatic detection is not accurate enough.

## Local Setup

Install dependencies:

```bash
npm install
```

Create local environment values from the example:

```bash
cp env.example .env.local
```

Spotify configuration:

| Variable | Description |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | Optional explicit callback URL |

For local development, add this redirect URI in the Spotify Developer Dashboard:

```text
http://localhost:3000/callback
```

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

## Project Structure

```text
app/
  api/spotify/              Spotify OAuth, refresh, playlist, and search routes
  api/youtube/              YouTube playlist and search routes
  game/                     Shared audio and lyrics game screen
  playlist/                 Spotify and guest playlist loading
components/game/            Progress, playback, guessing, and lyrics panels
hooks/                      Track state, game state, auth, and audio playback
lib/
  curated-song-seeds.ts     Curated song catalog
  curated-track-analysis.ts Static audio-start analysis results
  curated-tracks.ts         Runtime merge and deterministic daily selection
  audio-start-detector.ts   Audio feature extraction and start detector
  lyrics-clues.ts           Title/artist masking and staged clue reveal
scripts/
  analyze-audio-start.ts    Local yt-dlp/ffmpeg ingest and report workflow
tests/                      Unit and Playwright E2E tests
```

## Known Limitations

- YouTube playlist and search support parses YouTube page data and can break if YouTube changes its response structure.
- YouTube playback depends on video availability, embedding permissions, and browser autoplay rules.
- Spotify tokens are stored in `localStorage` in this version.
- Partial Lyrics Mode uses curated English lyric-style clues, not licensed verbatim lyrics or a live lyrics API.
- Adding a new Daily track requires running the local audio-start analyzer first.

## Deployment

The app is compatible with Vercel. Configure `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the deployment environment for Spotify login and guest public Spotify playlist loading. Daily and Partial Lyrics data are static and require no database.
