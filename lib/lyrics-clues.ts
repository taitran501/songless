import type { GameTrack } from "@/lib/tracks"

const REVEAL_COUNTS = [4, 7, 10, 13, 16, Number.MAX_SAFE_INTEGER] as const

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
  const revealCount = REVEAL_COUNTS[Math.max(0, Math.min(stage, REVEAL_COUNTS.length - 1))]

  return words
    .map((word, index) => {
      if (word === "____") return word
      return index < revealCount ? word : "----"
    })
    .join(" ")
}
