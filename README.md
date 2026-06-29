# SonglessUnlimited

A playlist-based music guessing game. Listen to short clips, guess the song, and unlock longer clips after each miss.

## Modes

- **Spotify mode**: connect Spotify, load Spotify or YouTube playlists, and play with Spotify-backed search suggestions.
- **Guest YouTube mode**: skip login and load a YouTube playlist directly.

Spotify playback may require a Spotify Premium account and an active Spotify device, depending on the track and playback path. YouTube mode does not require Spotify login.

## Gameplay

1. Choose Spotify mode or Guest YouTube mode.
2. Load a playlist URL or ID.
3. Optionally shuffle the tracks.
4. Start the game.
5. Guess the song across six stages: `0.5s`, `1s`, `2s`, `4s`, `8s`, and `15s`.
6. A correct guess advances to the next track. Missing all stages reveals the answer.

## Local Setup

Install dependencies:

```bash
npm install
```

Create local env values from the example:

```bash
cp env.example .env.local
```

Required for Spotify mode:

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
npm run lint
npm run test:unit
npx tsc --noEmit
npm run build
npm run test:e2e
```

## Project Structure

```text
app/
  api/spotify/       Spotify OAuth, refresh, and playlist routes
  api/youtube/       YouTube playlist and search routes
  game/              Main game page
  playlist/          Playlist loading page
components/game/     Game UI panels
hooks/               Auth, track store, game state, playback hooks
lib/                 Shared track, guessing, Spotify, and YouTube helpers
tests/               Unit and Playwright E2E tests
```

## Known Limitations

- YouTube playlist and search support uses HTML scraping. It can break if YouTube changes page structure.
- Spotify tokens are stored in `localStorage` in this version.
- Guest mode supports YouTube playlists and public Spotify playlists.

## Deployment

The app is compatible with Vercel. Configure `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the deployment environment for Spotify login and guest public Spotify playlist loading.
