import type { GameMode } from "@/lib/tracks"

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

export async function copyShareText(clipboard: Pick<Clipboard, "writeText">, text: string) {
  await clipboard.writeText(text)
}
