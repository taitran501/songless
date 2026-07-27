import type { GameTrack } from "@/lib/tracks"

const REVEAL_RATIOS = [0.22, 0.32, 0.44, 0.58, 0.74, 1] as const

function removeVietnameseTones(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
}

function clueTokens(value: string) {
  return removeVietnameseTones(value)
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function isTargetWord(word: string, tokens: Set<string>) {
  const cleanWord = removeVietnameseTones(word).replace(/[^A-Za-z0-9]/g, "").toLowerCase()
  return cleanWord.length >= 3 && tokens.has(cleanWord)
}

export function maskTitleAndArtistWords(text: string, track: Pick<GameTrack, "name" | "artists">) {
  const tokens = new Set([...clueTokens(track.name), ...clueTokens(track.artists)].map(t => t.toLowerCase()))
  
  const words = text.split(/\s+/)
  return words.map(word => {
    if (isTargetWord(word, tokens)) {
      return word.replace(/[A-Za-z0-9À-ỹ]/g, "_")
    }
    return word
  }).join(" ")
}

export function buildLyricsClue(track: GameTrack, stage: number) {
  const snippet = track.lyricsSnippets?.[0] || "No lyric clue is available for this track."
  const tokens = new Set([...clueTokens(track.name), ...clueTokens(track.artists)].map(t => t.toLowerCase()))
  
  const words = snippet.split(/\s+/).filter(Boolean)
  
  const revealableIndices: number[] = []
  words.forEach((word, index) => {
    if (!isTargetWord(word, tokens)) {
      revealableIndices.push(index)
    }
  })

  const boundedStage = Math.max(0, Math.min(stage, REVEAL_RATIOS.length - 1))
  const ratio = REVEAL_RATIOS[boundedStage]
  const revealableCount = revealableIndices.length
  const revealCount =
    ratio === 1
      ? revealableCount
      : Math.max(1, Math.min(revealableCount - 1, Math.floor(revealableCount * ratio)))

  let revealed = 0
  return words
    .map((word, index) => {
      if (isTargetWord(word, tokens)) {
        return word.replace(/[a-zA-Z0-9À-ỹà-ỹ]/g, "_")
      }
      
      if (revealed < revealCount) {
        revealed++
        return word
      }
      
      return word.replace(/[a-zA-Z0-9À-ỹà-ỹ]/g, "-")
    })
    .join(" ")
}
