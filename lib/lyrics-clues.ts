import type { GameTrack } from "@/lib/tracks"

const REVEAL_RATIOS = [0.22, 0.32, 0.44, 0.58, 0.74, 1] as const

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function clueTokens(value: string) {
  return value
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

export function maskTitleAndArtistWords(text: string, track: Pick<GameTrack, "name" | "artists">) {
  const tokens = new Set([...clueTokens(track.name), ...clueTokens(track.artists)])
  let masked = text

  for (const token of tokens) {
    masked = masked.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi"), "____")
  }

  return masked
}

export function buildLyricsClue(track: GameTrack, stage: number) {
  const snippet = track.lyricsSnippets?.[0] || "No lyric clue is available for this track."
  const masked = maskTitleAndArtistWords(snippet, track)
  const words = masked.split(/\s+/).filter(Boolean)
  const boundedStage = Math.max(0, Math.min(stage, REVEAL_RATIOS.length - 1))
  const ratio = REVEAL_RATIOS[boundedStage]
  const revealableCount = words.filter((word) => word !== "____").length
  const revealCount =
    ratio === 1
      ? revealableCount
      : Math.max(1, Math.min(revealableCount - 1, Math.floor(revealableCount * ratio)))
  let revealed = 0

  return words
    .map((word) => {
      if (word === "____") return word
      if (revealed < revealCount) {
        revealed++
        return word
      }
      revealed++
      return "----"
    })
    .join(" ")
}
