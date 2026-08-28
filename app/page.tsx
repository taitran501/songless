"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  FileText,
  Flame,
  Headphones,
  ListMusic,
  Loader2,
  Music,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useTracks } from "@/hooks/tracks-store"
import {
  captureProductEvent,
  getRunAnalyticsContext,
} from "@/lib/analytics"
import { getUtcDateKey } from "@/lib/curated-tracks"
import { parseDailyResponse } from "@/lib/daily-response"
import { fetchWithTimeout } from "@/lib/request-timeout"
import {
  EMPTY_DAILY_PROGRESS,
  getRecentDailyDays,
  readDailyProgress,
  type DailyProgressState,
} from "@/lib/daily-progress"
import { createGameSession, writeGameSession } from "@/lib/game-session"
import {
  EMPTY_GENRE_PROGRESS,
  readGenreProgress,
  selectGenrePracticeTracks,
  type GenreProgressRecord,
} from "@/lib/genre-progress"
import {
  readRecentLyricsTrackIds,
  rememberLyricsRun,
  selectLyricsRunTracks,
} from "@/lib/lyrics-runs"
import {
  discardResumableGameSession,
  readResumableGameSession,
  type ResumableGameSession,
} from "@/lib/resumable-session"
import type { TrackGenre } from "@/lib/tracks"

const GENRES: TrackGenre[] = ["vpop", "usuk", "rap"]
const GENRE_LABELS: Record<TrackGenre, string> = {
  vpop: "VPop",
  usuk: "USUK",
  rap: "Rap",
}
const EQUALIZER_HEIGHTS = [30, 58, 42, 78, 52, 88, 65, 46, 72, 38, 62, 48]

function emptyGenreProgress() {
  return Object.fromEntries(
    GENRES.map((genre) => [genre, EMPTY_GENRE_PROGRESS])
  ) as Record<TrackGenre, GenreProgressRecord>
}

export default function HomePage() {
  const router = useRouter()
  const { setTracks } = useTracks()
  const [genreProgress, setGenreProgress] =
    useState<Record<TrackGenre, GenreProgressRecord>>(emptyGenreProgress)
  const [dailyProgress, setDailyProgress] =
    useState<DailyProgressState>(EMPTY_DAILY_PROGRESS)
  const [resumable, setResumable] = useState<ResumableGameSession | null>(null)
  const [confirmIntent, setConfirmIntent] = useState<"discard" | "start" | null>(null)
  const pendingStartRef = useRef<(() => void) | null>(null)
  const homeViewedRef = useRef(false)
  const todayDateKey = getUtcDateKey()
  const todayDailyRecord =
    dailyProgress.history.find((record) => record.dateKey === todayDateKey) ?? null
  const recentDailyDays = getRecentDailyDays(todayDateKey, dailyProgress)
  const todayDateLabel = new Date(`${todayDateKey}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })

  useEffect(() => {
    setGenreProgress(
      Object.fromEntries(
        GENRES.map((genre) => [genre, readGenreProgress(localStorage, genre)])
      ) as Record<TrackGenre, GenreProgressRecord>
    )
    setDailyProgress(readDailyProgress(localStorage))
    setResumable(readResumableGameSession(localStorage))
    if (!homeViewedRef.current) {
      homeViewedRef.current = true
      captureProductEvent({ name: "home_viewed" })
    }
  }, [])

  const requestNewRun = (start: () => void) => {
    if (!resumable) {
      start()
      return
    }
    pendingStartRef.current = start
    setConfirmIntent("start")
  }

  const handleGuestPlay = () => requestNewRun(() => router.push("/playlist"))

  const continueRun = () => {
    if (!resumable) return
    setTracks(resumable.tracks)
    captureProductEvent({
      name: "run_resumed",
      properties: {
        ...getRunAnalyticsContext(resumable.session),
        trackNumber: resumable.state.currentIndex + 1,
        stage: resumable.state.currentStage + 1,
        totalTracks: resumable.tracks.length,
      },
    })
    router.push("/game")
  }

  const confirmDiscard = () => {
    if (!resumable) return
    discardResumableGameSession(localStorage, resumable)
    setResumable(null)
    setConfirmIntent(null)
    const pendingStart = pendingStartRef.current
    pendingStartRef.current = null
    pendingStart?.()
  }

  const [isDailyLoading, setIsDailyLoading] = useState(false)
  const [dailyError, setDailyError] = useState<string | null>(null)

  const startDailyChallenge = async () => {
    const dateKey = getUtcDateKey()
    setIsDailyLoading(true)
    setDailyError(null)

    try {
      const res = await fetchWithTimeout(`/api/daily?date=${dateKey}`, {}, 20_000)
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Daily challenge is temporarily unavailable."
        )
      }
      const tracks = parseDailyResponse(await res.json(), dateKey)
      const playlistId = `daily-audio-${dateKey}`
      const session = createGameSession({
        kind: "daily",
        playbackMode: "audio",
        id: playlistId,
        dateKey,
      })

      setTracks(tracks)
      localStorage.setItem("full_playlist_tracks", JSON.stringify(tracks))
      writeGameSession(localStorage, session)
      captureProductEvent({
        name: "run_started",
        properties: {
          ...getRunAnalyticsContext(session),
          totalTracks: tracks.length,
        },
      })
      router.push("/game")
    } catch (err) {
      console.warn("Failed to fetch dynamic daily:", err)
      setDailyError(
        err instanceof Error
          ? err.message
          : "Daily challenge is temporarily unavailable. Please try again."
      )
    } finally {
      setIsDailyLoading(false)
    }
  }

  const startLyricsMode = () => {
    const session = createGameSession({
      kind: "lyrics",
      playbackMode: "lyrics",
      id: "lyrics-quick-mix-v2",
    })
    const tracks = selectLyricsRunTracks({
      runId: session.runId,
      recentTrackIds: readRecentLyricsTrackIds(localStorage),
    })

    setTracks(tracks)
    localStorage.setItem("full_playlist_tracks", JSON.stringify(tracks))
    rememberLyricsRun(localStorage, tracks)
    writeGameSession(localStorage, session)
    captureProductEvent({
      name: "run_started",
      properties: {
        ...getRunAnalyticsContext(session),
        totalTracks: tracks.length,
      },
    })
    router.push("/game")
  }

  const startGenrePractice = (genre: TrackGenre) => {
    const session = createGameSession({
      kind: "genre",
      playbackMode: "audio",
      id: `genre-${genre}`,
      genre,
    })
    const tracks = selectGenrePracticeTracks(genre, session.runId)

    setTracks(tracks)
    localStorage.setItem("full_playlist_tracks", JSON.stringify(tracks))
    writeGameSession(localStorage, session)
    captureProductEvent({
      name: "run_started",
      properties: {
        ...getRunAnalyticsContext(session),
        totalTracks: tracks.length,
      },
    })
    router.push("/game")
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020617] font-sans text-[#dce5d9]">
      <div className="pointer-events-none absolute left-[-10%] top-[-15%] h-[45%] w-[50%] rounded-full bg-indigo-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-10%] h-[55%] w-[60%] rounded-full bg-[#10b981]/5 blur-[150px]" />
      <div className="pointer-events-none absolute right-[12%] top-[35%] h-[35%] w-[35%] rounded-full bg-cyan-500/5 blur-[120px]" />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8 text-center animate-fade-in sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#10b981]/20 bg-[#10b981]/10 px-3 py-1.5">
            <Music className="h-3.5 w-3.5 text-[#10b981]" />
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-[#34d399]">
              Music Guessing Game
            </span>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.5rem]">
            <span className="bg-gradient-to-r from-[#10b981] via-emerald-300 to-[#10b981] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(16,185,129,0.25)]">
              Songless
            </span>
            <span className="font-light text-white">Unlimited</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#a8b0bf] sm:text-base">
            Short music runs for a daily challenge, lyrics clues, playlists, or focused genre practice.
          </p>
        </header>

        {resumable && (
          <section
            data-testid="continue-run-banner"
            className="mb-5 flex flex-col gap-4 rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.06] p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div>
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                Run in progress
              </span>
              <h2 className="mt-1 font-display text-lg font-bold text-white">
                Continue{" "}
                {resumable.session.kind === "lyrics"
                  ? "Lyrics Quick Mix"
                  : resumable.session.kind === "daily"
                    ? "Daily Challenge"
                    : resumable.session.kind === "genre"
                      ? `${resumable.session.genre?.toUpperCase()} Practice`
                      : "Playlist"}
              </h2>
              <p className="mt-1 text-sm text-[#9ca3af]">
                Track {resumable.state.currentIndex + 1} of {resumable.tracks.length} ·{" "}
                {resumable.session.playbackMode === "lyrics" ? "Clue" : "Stage"}{" "}
                {resumable.state.currentStage + 1} of 6
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={continueRun}
                className="flex-1 rounded-xl bg-cyan-300 font-bold text-[#041015] hover:bg-cyan-200 sm:flex-none"
              >
                CONTINUE RUN
              </Button>
              <Button
                onClick={() => setConfirmIntent("discard")}
                variant="outline"
                className="flex-1 rounded-xl border-white/10 bg-transparent text-[#a8b0bf] hover:bg-white/5 hover:text-white sm:flex-none"
              >
                DISCARD
              </Button>
            </div>
          </section>
        )}

        <section
          data-testid="home-daily-card"
          className="group relative mb-5 overflow-hidden rounded-3xl border border-[#10b981]/30 bg-[#08121a]/85 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/5 transition-colors hover:border-[#34d399]/55 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#10b981]/10 via-transparent to-indigo-500/[0.06]" />
          <div className="relative grid items-center gap-7 md:grid-cols-[1fr_300px]">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#10b981]/30 bg-[#10b981]/12 sm:h-14 sm:w-14">
                <CalendarDays className="h-6 w-6 text-[#34d399] sm:h-7 sm:w-7" />
              </div>
              <div>
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-[#34d399]">
                  Featured · 3 songs today
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
                  Daily Challenge
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8b0bf]">
                  The same balanced mix for everyone: one VPop, one USUK, and one Rap track.
                </p>
                <Button
                  onClick={() => requestNewRun(startDailyChallenge)}
                  disabled={isDailyLoading}
                  className="mt-5 h-11 w-full rounded-xl bg-[#10b981] px-6 font-bold text-black shadow-lg transition-all hover:bg-[#34d399] hover:shadow-[0_0_24px_rgba(16,185,129,0.28)] sm:w-auto"
                >
                  {isDailyLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading today's hits...
                    </>
                  ) : dailyError ? (
                    "Retry Today's Challenge"
                  ) : todayDailyRecord ? (
                    "Play Again"
                  ) : (
                    "Start Today's Challenge"
                  )}
                </Button>
                {dailyError && (
                  <p
                    role="alert"
                    data-testid="daily-error"
                    className="mt-3 max-w-md text-sm text-red-300"
                  >
                    {dailyError}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#030712]/45 p-4">
              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#7d8999]">Current</p>
                  <p className="mt-1 inline-flex items-center gap-1 font-display text-lg font-bold text-white">
                    <Flame className="h-4 w-4 text-orange-300" />
                    {dailyProgress.currentStreak}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#7d8999]">Best</p>
                  <p className="mt-1 inline-flex items-center gap-1 font-display text-lg font-bold text-white">
                    <Trophy className="h-4 w-4 text-amber-300" />
                    {dailyProgress.bestStreak}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#7d8999]">
                    Today · {todayDateLabel}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-white">
                    {todayDailyRecord ? todayDailyRecord.bestScore : "—"}
                  </p>
                </div>
              </div>
              <div data-testid="daily-week" className="grid grid-cols-7 gap-1.5">
                {recentDailyDays.map(({ dateKey, record }) => {
                  const date = new Date(`${dateKey}T00:00:00.000Z`)
                  const dateLabel = date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })
                  const dayLabel = date.toLocaleDateString("en-US", {
                    weekday: "long",
                    timeZone: "UTC",
                  })
                  return (
                  <div key={dateKey} className="text-center">
                    <span className="block text-[9px] font-semibold uppercase text-[#697386]">
                      {date.toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}
                    </span>
                    <span
                      aria-label={`${dayLabel}, ${dateLabel}${dateKey === todayDateKey ? ", today" : ""}${record ? `, ${record.bestScore} points` : ", not completed"}`}
                      className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${
                        record
                          ? "border-[#10b981]/50 bg-[#10b981]/20 text-[#6ee7b7]"
                          : dateKey === todayDateKey
                            ? "border-white/25 bg-white/[0.05] text-white"
                            : "border-white/10 text-[#4b5563]"
                      }`}
                      title={`${dateLabel}${dateKey === todayDateKey ? " · Today" : ""} — ${record ? `${record.bestScore} points` : "Not completed"}`}
                    >
                      {record ? "✓" : "·"}
                    </span>
                  </div>
                  )
                })}
              </div>
              <div aria-hidden="true" className="mt-4 hidden h-8 items-end justify-center gap-1.5 md:flex">
                {EQUALIZER_HEIGHTS.map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className="w-1.5 rounded-full bg-gradient-to-t from-[#059669] to-[#6ee7b7] opacity-60 transition-all duration-300 group-hover:opacity-100"
                    style={{ height: `${Math.max(20, height)}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          data-testid="home-mode-grid"
          className="grid grid-cols-1 gap-5 lg:grid-cols-3"
        >
          <article
            data-testid="home-mode-card"
            className="flex min-h-[330px] flex-col rounded-3xl border border-indigo-300/20 bg-[#090d16]/75 p-6 shadow-2xl ring-1 ring-white/5 transition-colors hover:border-indigo-300/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-400/10">
              <FileText className="h-6 w-6 text-indigo-300" />
            </div>
            <span className="mt-5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">
              5 songs · no audio
            </span>
            <h2 className="mt-1 font-display text-xl font-bold text-white">Lyrics Quick Mix</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[#a8b0bf]">
              Solve five lyric clues across VPop, USUK, and Rap. Each clue reveals more without exposing the title.
            </p>
            <Button
              onClick={() => requestNewRun(startLyricsMode)}
              variant="outline"
              className="mt-6 h-11 w-full rounded-xl border-indigo-300/25 bg-indigo-300/[0.04] font-semibold text-white hover:bg-indigo-300/10 hover:text-white"
            >
              Start Lyrics Quick Mix
            </Button>
          </article>

          <article
            data-testid="home-mode-card"
            className="flex min-h-[330px] flex-col rounded-3xl border border-sky-300/20 bg-[#090d16]/75 p-6 shadow-2xl ring-1 ring-white/5 transition-colors hover:border-sky-300/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/25 bg-sky-400/10">
              <ListMusic className="h-6 w-6 text-sky-300" />
            </div>
            <span className="mt-5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">
              YouTube · public Spotify
            </span>
            <h2 className="mt-1 font-display text-xl font-bold text-white">Playlist Mode</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[#a8b0bf]">
              Bring a playlist, choose the run length, and play without signing in.
            </p>
            <Button
              onClick={handleGuestPlay}
              variant="outline"
              className="mt-6 h-11 w-full rounded-xl border-sky-300/25 bg-sky-300/[0.04] font-semibold text-white hover:bg-sky-300/10 hover:text-white"
            >
              Open Playlist Setup
            </Button>
          </article>

          <article
            data-testid="home-mode-card"
            className="flex min-h-[330px] flex-col rounded-3xl border border-cyan-300/20 bg-[#090d16]/75 p-6 shadow-2xl ring-1 ring-white/5 transition-colors hover:border-cyan-300/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10">
              <Headphones className="h-6 w-6 text-cyan-300" />
            </div>
            <span className="mt-5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
              5 songs per run
            </span>
            <h2 className="mt-1 font-display text-xl font-bold text-white">Practice by Genre</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#a8b0bf]">
              Build a local streak and improve your personal best in one genre.
            </p>

            <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
              {GENRES.map((genre) => {
                const progress = genreProgress[genre]
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => requestNewRun(() => startGenrePractice(genre))}
                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] px-2 py-3 text-center transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/10"
                  >
                    <span className="block text-sm font-bold text-white">{GENRE_LABELS[genre]}</span>
                    <span className="mt-1 flex items-center justify-center gap-2 text-[10px] text-[#8f9aaa]">
                      <span className="inline-flex items-center gap-0.5" title="Best score">
                        <Trophy className="h-3 w-3 text-amber-300" />
                        {progress.bestScore}
                      </span>
                      <span className="inline-flex items-center gap-0.5" title="Best streak">
                        <Flame className="h-3 w-3 text-orange-300" />
                        {progress.bestStreak}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </article>
        </section>

        <p className="mt-7 text-center text-xs text-[#697386]">
          Progress stays on this device. Public playlist mode requires no user login.
        </p>

        <AlertDialog
          open={confirmIntent !== null}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmIntent(null)
              pendingStartRef.current = null
            }
          }}
        >
          <AlertDialogContent className="border-white/10 bg-[#090d16] text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmIntent === "start"
                  ? "Start a new run and discard current progress?"
                  : "Discard this run?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#9ca3af]">
                Your current guesses, score, and track progress will be cleared.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent text-white hover:bg-white/5 hover:text-white">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDiscard}
                className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
              >
                {confirmIntent === "start" ? "Discard and start" : "Discard run"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}
