# Songless

A Spotify-powered music guessing game. Log in with your Spotify account, load any playlist, and try to name each song from progressively longer audio clips.

Inspired by games like [Heardle](https://www.heardle.app/) and Songless — but with your own playlists and full-track playback via the Spotify Web Playback SDK.

## Features

- **Spotify OAuth** — sign in with your Spotify account
- **Any playlist** — paste a playlist URL or ID to play your own library
- **Recent Playlists** — remembers the last 6 playlists loaded for quick access
- **Six-stage guessing** — hear more of the song with each stage (0.5s → 15s)
- **Shuffle mode** — randomize track order before starting
- **Playback controls** — play, pause, skip stages, and submit guesses at any time
- **Autologin & State Persistence** — saves session tokens and in-progress game states in the browser (`localStorage`)
- **Vercel Deploy Ready** — optimized for standard cloud deployment with dynamic redirect URI resolution

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
git clone https://github.com/taitran501/songless.git
cd songless
npm install
```

### 2. Configure environment variables

Create a `.env.local` file and fill in your Spotify credentials:

```bash
cp env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Client ID from the Spotify Developer Dashboard |
| `SPOTIFY_CLIENT_SECRET` | Client secret from the Spotify Developer Dashboard |
| `SPOTIFY_REDIRECT_URI` | (Optional) Explicit OAuth redirect URL |

*Note: If `SPOTIFY_REDIRECT_URI` is omitted, the app dynamically constructs the redirect URI matching the current domain (e.g. `http://localhost:3000/callback` or `https://your-domain.vercel.app/callback`).*

### 3. Set up Spotify Developer App

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Under **Redirect URIs**, add the callback URL(s) you intend to use:
   - For local development: `http://localhost:3000/callback`
   - For production: `https://your-domain.vercel.app/callback`
3. Copy the **Client ID** and **Client Secret** into your env configuration.

The app requests these scopes: `streaming`, `user-read-email`, `user-read-private`, `user-modify-playback-state`, `user-read-playback-state`, `playlist-read-private`, `playlist-read-collaborative`.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test:e2e` | Run Playwright E2E tests |

## Project structure

```
app/
  page.tsx              # Login — redirects to Spotify OAuth
  callback/page.tsx     # OAuth callback — exchanges code for tokens
  playlist/page.tsx     # Load a playlist and start the game
  game/page.tsx         # Main game UI and Spotify Web Playback SDK
  api/spotify/          # Server API routes (config, callback, playlist, refresh)
components/
  game-modal.tsx        # Correct / game-over dialog
hooks/
  use-spotify-auth.ts   # Token storage, auto-login and session refresh
  tracks-store.tsx      # Playlist state (React context + localStorage)
lib/
  spotify-config.ts     # Spotify API config constants
  utils.ts              # Styling helpers
tests/
  e2e/songless.spec.ts  # Playwright E2E integration test suite
```

## Deployment

The app is designed to run seamlessly on [Vercel](https://vercel.com).
Set the environment variables `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the Vercel dashboard.

Ensure you whitelist your Vercel deployment's domains in your Spotify Developer App settings (e.g. `https://your-domain.vercel.app/callback`).

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api) & [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- [Playwright](https://playwright.dev/) (E2E Testing)

## Troubleshooting

| Issue | What to check |
|-------|---------------|
| OAuth redirect error | Check Spotify App settings; the domain you are visiting must have its `/callback` exact match whitelisted |
| "Configuration Error" on login | `SPOTIFY_CLIENT_ID` is missing or not loaded from environment variables |
| Playback doesn't work (403) | Spotify Premium is required. Make sure you also have an active Spotify instance (Desktop or Mobile app) open on the same account. |
| Redirected back to playlist | No tracks loaded — load a playlist first; check `game_tracks` in `localStorage` |

## License

Private project — all rights reserved.

