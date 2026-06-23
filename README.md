# SonglessUnlimited

A Spotify-powered music guessing game. Log in with your Spotify account, load any playlist, and try to name each song from progressively longer audio clips.

Inspired by games like [Heardle](https://www.heardle.app/) and Songless — but with your own playlists and full-track playback via the Spotify Web Playback SDK.

## Features

- **Spotify OAuth** — sign in with your Spotify account
- **Any playlist** — paste a playlist URL or ID to play your own library
- **Six-stage guessing** — hear more of the song with each stage (0.5s → 15s)
- **Shuffle mode** — randomize track order before starting
- **Playback controls** — play, pause, skip stages, and submit guesses at any time
- **No backend database** — tokens and playlist data are stored in the browser (`localStorage`)

## Requirements

- [Node.js](https://nodejs.org/) 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) application
- **Spotify Premium** — required for the Web Playback SDK (full-track streaming)

## How to play

1. Sign in with Spotify on the home page.
2. Paste a playlist URL or ID on the playlist page and click **Load Playlist**.
3. Optionally enable **Shuffle Tracks**, then click **Start Game**.
4. Listen to a short clip and type your guess. Each song has up to six stages:

   | Stage | Clip length |
   |-------|-------------|
   | 1     | 0.5s        |
   | 2     | 1s          |
   | 3     | 2s          |
   | 4     | 4s          |
   | 5     | 8s          |
   | 6     | 15s         |

5. Guess correctly to advance, or skip to the next stage for a longer preview. After stage 6, the round ends if you haven't guessed correctly.

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/your-username/songless.git
cd songless
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your Spotify credentials:

```bash
cp env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Client ID from the Spotify Developer Dashboard |
| `SPOTIFY_CLIENT_SECRET` | Client secret from the Spotify Developer Dashboard |
| `SPOTIFY_REDIRECT_URI` | OAuth redirect URL (see below) |

For local development, set the redirect URI to the callback page:

```
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```

### 3. Set up Spotify

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Under **Redirect URIs**, add the same URL as `SPOTIFY_REDIRECT_URI` (e.g. `http://localhost:3000/callback`).
3. Copy the **Client ID** and **Client Secret** into `.env.local`.

The app requests these scopes: `streaming`, `user-read-email`, `user-read-private`, `user-modify-playback-state`, `user-read-playback-state`, `playlist-read-private`, `playlist-read-collaborative`.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Verify your environment variables:

```bash
npm run check-env
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run dev:network` | Dev server accessible on the local network |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run check-env` | Validate required environment variables |

## Project structure

```
app/
  page.tsx              # Login — redirects to Spotify OAuth
  callback/page.tsx     # OAuth callback — exchanges code for tokens
  playlist/page.tsx     # Load a playlist and start the game
  game/page.tsx         # Main game UI and Spotify Web Playback SDK
  api/spotify/          # Server routes (config, callback, playlist, refresh)
components/
  game-modal.tsx        # Correct / game-over dialog
hooks/
  use-spotify-auth.ts   # Token storage and refresh
  tracks-store.tsx      # Playlist state (React context + localStorage)
lib/
  spotify-config.ts     # Spotify OAuth configuration
  utils.ts              # Shared helpers (e.g. token refresh)
```

## Deployment

The app is designed for [Vercel](https://vercel.com). Set the same three environment variables in the Vercel dashboard, using your production callback URL:

```
SPOTIFY_REDIRECT_URI=https://your-domain.vercel.app/callback
```

Add that URL to your Spotify app's Redirect URIs as well.

See [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) for a step-by-step Vercel deployment guide.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api) & [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)

## Troubleshooting

| Issue | What to check |
|-------|---------------|
| OAuth redirect error | `SPOTIFY_REDIRECT_URI` must exactly match a Redirect URI in the Spotify Dashboard |
| "Configuration Error" on login | `SPOTIFY_CLIENT_ID` is missing or not loaded |
| Playback doesn't work | Spotify Premium is required; free accounts cannot use the Web Playback SDK |
| Redirected back to playlist | No tracks loaded — load a playlist first; check `game_tracks` in `localStorage` |
| Token expired | Clear storage and sign in again: `localStorage.clear()` in the browser console |

For detailed debugging steps and expected console log flow, see [test-flow.md](./test-flow.md).

## Related docs

- [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) — Vercel deployment
- [test-flow.md](./test-flow.md) — Game rules and debugging checklist
- [SPOTIFY_OAUTH_UPDATE.md](./SPOTIFY_OAUTH_UPDATE.md) — OAuth configuration notes

## License

Private project — all rights reserved.
