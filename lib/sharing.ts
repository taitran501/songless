import type { GameMode } from "@/lib/tracks"
import type { GameSessionKind } from "@/lib/game-session"
import type { TrackRunResult } from "@/lib/game-state"

interface ShareTextInput {
  correct: boolean
  guesses: string[]
  trackIndex: number
  mode: GameMode
  dailyDate?: string | null
  score: number
  appUrl: string
}

export function buildEmojiGrid(correct: boolean, guesses: string[]) {
  const grid: string[] = guesses.slice(0, 6).map((guess, index) => {
    if (correct && index === guesses.length - 1) return "🟩"
    return guess === "SKIPPED" ? "⬜" : "🟥"
  })

  while (grid.length < 6) grid.push("⬛")
  return grid.join("")
}

export function buildTrackResultGrid(result: TrackRunResult) {
  if (result.status === "unknown") return "❔❔❔❔❔❔"

  const grid = result.attempts.slice(0, 6).map<string>((attempt) => {
    if (attempt === "correct") return "🟩"
    if (attempt === "skip") return "⬜"
    return "🟥"
  })
  while (grid.length < 6) grid.push("⬛")
  return grid.join("")
}

export function resolveShareUrl(configuredUrl?: string, currentOrigin?: string) {
  const value = configuredUrl?.trim() || currentOrigin?.trim()
  if (!value) throw new Error("No application URL is available for sharing.")
  return value.replace(/\/+$/, "")
}

export function buildShareText({
  correct,
  guesses,
  trackIndex,
  mode,
  dailyDate,
  score,
  appUrl,
}: ShareTextInput) {
  const label = dailyDate
    ? `SonglessUnlimited Daily ${dailyDate}`
    : mode === "lyrics"
      ? "SonglessUnlimited Lyrics"
      : "SonglessUnlimited"
  const icon = mode === "lyrics" ? "📝" : "🔊"
  return `${label} #${trackIndex + 1}\nScore: ${score}\n${icon} ${buildEmojiGrid(correct, guesses)}\n${appUrl}`
}

export function buildRunShareText(input: {
  kind: GameSessionKind
  dateKey?: string | null
  score: number
  solved: number
  totalTracks: number
  bestRunStreak: number
  results: readonly TrackRunResult[]
  appUrl: string
}) {
  const modeLabel =
    input.kind === "daily"
      ? `Daily ${input.dateKey ?? ""}`.trim()
      : input.kind === "lyrics"
        ? "Lyrics Quick Mix"
        : input.kind === "genre"
          ? "Genre Practice"
          : "Playlist"
  const rows = input.results.slice(0, input.totalTracks).map(buildTrackResultGrid)
  while (rows.length < input.totalTracks) rows.push("❔❔❔❔❔❔")

  return [
    `SonglessUnlimited ${modeLabel}`,
    `${input.solved}/${input.totalTracks} solved · ${input.score} points`,
    `Best run streak: ${input.bestRunStreak}`,
    ...rows,
    input.appUrl,
  ].join("\n")
}

export async function copyShareText(clipboard: Pick<Clipboard, "writeText">, text: string) {
  await clipboard.writeText(text)
}
